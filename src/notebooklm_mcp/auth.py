"""Authentication strategies for NotebookLM.

NotebookLM has no official public API for the consumer product. Two realistic
ways to authenticate exist, and both are implemented here behind a small
:class:`AuthStrategy` interface:

1. **Cookie / SAPISIDHASH** (default). NotebookLM's web client talks to Google's
   internal ``batchexecute`` RPC endpoints. Those accept a browser session
   authenticated with Google's ``SAPISID`` cookie via the ``SAPISIDHASH``
   ``Authorization`` scheme. You export the cookies from a logged-in browser and
   the server signs each request. This is the same mechanism the web UI uses.

2. **OAuth 2.0** (optional, ``oauth`` extra). For NotebookLM Enterprise /
   Agentspace deployments that expose a real Google Cloud API, a standard OAuth
   bearer token is used instead. The Google client libraries handle the flow and
   refresh; we just attach the token.

Each strategy produces the HTTP headers (and cookies, if any) needed to
authenticate a request. Nothing here logs or persists secrets.
"""

from __future__ import annotations

import hashlib
import http.cookiejar
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path

from .config import (
    AUTH_MODE_COOKIE,
    AUTH_MODE_OAUTH,
    Config,
)

# Cookie names that carry the Google session. SAPISID (or its __Secure- variant)
# is the one used to compute the SAPISIDHASH signature.
_SAPISID_NAMES = ("SAPISID", "__Secure-3PAPISID", "__Secure-1PAPISID", "APISID")


class AuthError(RuntimeError):
    """Raised when credentials are missing, malformed, or rejected."""


@dataclass(slots=True)
class AuthContext:
    """Everything needed to authenticate a single outgoing request.

    ``headers`` are merged onto the request; ``cookies`` are attached to the
    cookie jar. Kept as plain dicts so the client stays transport-agnostic.
    """

    headers: dict[str, str] = field(default_factory=dict)
    cookies: dict[str, str] = field(default_factory=dict)


class AuthStrategy(ABC):
    """Interface all auth strategies implement."""

    @abstractmethod
    def context(self, *, origin: str) -> AuthContext:
        """Return the headers/cookies for a request against ``origin``.

        Args:
            origin: The scheme+host the request targets, e.g.
                ``https://notebooklm.google.com``. Used for SAPISIDHASH signing.
        """

    def close(self) -> None:  # noqa: B027  # pragma: no cover - optional hook
        """Release any held resources. Override if needed (default: no-op)."""


# --------------------------------------------------------------------------- #
# Cookie parsing helpers
# --------------------------------------------------------------------------- #


def parse_cookie_header(cookie_header: str) -> dict[str, str]:
    """Parse a raw ``Cookie:`` header value into a name -> value mapping.

    Accepts the exact string you'd copy from a browser's network tab, e.g.
    ``"SID=abc; HSID=def; SAPISID=ghi"``. Whitespace around pairs is ignored;
    values may themselves contain ``=`` (only the first one splits).
    """
    cookies: dict[str, str] = {}
    for part in cookie_header.split(";"):
        part = part.strip()
        if not part or "=" not in part:
            continue
        name, value = part.split("=", 1)
        name = name.strip()
        if name:
            cookies[name] = value.strip()
    if not cookies:
        raise AuthError("No cookies could be parsed from the provided cookie string.")
    return cookies


def load_cookie_file(path: Path) -> dict[str, str]:
    """Load cookies from a file.

    Supports two common export formats:

    * **JSON** — a list of ``{"name": ..., "value": ...}`` objects (the shape
      produced by most "Export cookies" browser extensions), or a flat
      ``{name: value}`` object.
    * **Netscape** — the classic ``cookies.txt`` tab-separated format.
    """
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise AuthError(f"Cookie file is empty: {path}")

    if text[0] in "[{":
        return _load_json_cookies(text, path)
    return _load_netscape_cookies(path)


def _load_json_cookies(text: str, path: Path) -> dict[str, str]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AuthError(f"Cookie file {path} is not valid JSON: {exc}") from exc

    cookies: dict[str, str] = {}
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and "name" in entry and "value" in entry:
                cookies[str(entry["name"])] = str(entry["value"])
    elif isinstance(data, dict):
        cookies = {str(k): str(v) for k, v in data.items()}

    if not cookies:
        raise AuthError(
            f"No cookies found in JSON file {path}. Expected a list of "
            '{"name", "value"} objects or a {name: value} object.'
        )
    return cookies


def _load_netscape_cookies(path: Path) -> dict[str, str]:
    jar = http.cookiejar.MozillaCookieJar()
    try:
        jar.load(str(path), ignore_discard=True, ignore_expires=True)
    except (http.cookiejar.LoadError, OSError) as exc:
        raise AuthError(f"Could not parse Netscape cookie file {path}: {exc}") from exc
    cookies = {cookie.name: cookie.value or "" for cookie in jar}
    if not cookies:
        raise AuthError(f"No cookies found in Netscape cookie file {path}.")
    return cookies


def find_sapisid(cookies: dict[str, str]) -> str:
    """Return the SAPISID-family cookie value used for signing, or raise."""
    for name in _SAPISID_NAMES:
        value = cookies.get(name)
        if value:
            return value
    raise AuthError(
        "Session cookies are missing SAPISID (or __Secure-3PAPISID / APISID). "
        "Re-export your Google cookies while signed in to NotebookLM."
    )


def compute_sapisidhash(
    sapisid: str,
    origin: str,
    *,
    timestamp: int | None = None,
) -> str:
    """Compute a Google ``SAPISIDHASH`` authorization value.

    The scheme is ``SAPISIDHASH <ts>_<sha1(ts SP sapisid SP origin)>`` where
    ``ts`` is the current Unix time in seconds. ``origin`` must be the bare
    scheme+host (no trailing path), e.g. ``https://notebooklm.google.com``.

    ``timestamp`` is injectable so the computation is deterministic in tests.
    """
    if not sapisid:
        raise AuthError("Cannot compute SAPISIDHASH without a SAPISID cookie value.")
    ts = int(time.time()) if timestamp is None else timestamp
    origin = origin.rstrip("/")
    digest = hashlib.sha1(f"{ts} {sapisid} {origin}".encode()).hexdigest()
    return f"SAPISIDHASH {ts}_{digest}"


# --------------------------------------------------------------------------- #
# Strategies
# --------------------------------------------------------------------------- #


class CookieAuth(AuthStrategy):
    """SAPISIDHASH auth backed by exported Google session cookies."""

    def __init__(self, cookies: dict[str, str]):
        if not cookies:
            raise AuthError("CookieAuth requires a non-empty cookie mapping.")
        self._cookies = dict(cookies)
        # Validate up front so failures surface at startup, not first request.
        self._sapisid = find_sapisid(self._cookies)

    @classmethod
    def from_config(cls, config: Config) -> CookieAuth:
        if config.cookie_string:
            cookies = parse_cookie_header(config.cookie_string)
        elif config.cookie_file:
            cookies = load_cookie_file(config.cookie_file)
        else:  # pragma: no cover - guarded by Config.validate()
            raise AuthError("No cookie source configured.")
        return cls(cookies)

    def context(self, *, origin: str) -> AuthContext:
        authorization = compute_sapisidhash(self._sapisid, origin)
        headers = {
            "Authorization": authorization,
            # Google's RPC endpoints check that the request originates from the
            # product's own origin.
            "Origin": origin.rstrip("/"),
            "X-Goog-AuthUser": "0",
        }
        return AuthContext(headers=headers, cookies=dict(self._cookies))


class OAuthAuth(AuthStrategy):
    """OAuth 2.0 bearer-token auth for NotebookLM Enterprise / Agentspace.

    Uses the Google auth libraries (installed via the ``oauth`` extra) to run the
    installed-app flow once, cache the token, and refresh it transparently.
    """

    def __init__(self, config: Config):
        self._config = config
        self._credentials = None  # lazily loaded google.oauth2.credentials.Credentials

    def _load(self):
        if self._credentials is not None:
            return self._credentials
        try:
            from google.auth.transport.requests import Request
            from google.oauth2.credentials import Credentials
            from google_auth_oauthlib.flow import InstalledAppFlow
        except ImportError as exc:  # pragma: no cover - depends on optional extra
            raise AuthError(
                "OAuth mode requires the optional dependencies. Install with "
                "`pip install 'notebooklm-mcp[oauth]'`."
            ) from exc

        scopes = list(self._config.oauth_scopes)
        token_file = self._config.oauth_token_file
        creds = None
        if token_file and token_file.exists():
            creds = Credentials.from_authorized_user_file(str(token_file), scopes)

        if creds and creds.valid:
            self._credentials = creds
            return creds

        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(self._config.oauth_client_secrets), scopes
            )
            creds = flow.run_local_server(port=0)

        if token_file:
            token_file.parent.mkdir(parents=True, exist_ok=True)
            token_file.write_text(creds.to_json(), encoding="utf-8")

        self._credentials = creds
        return creds

    def context(self, *, origin: str) -> AuthContext:
        creds = self._load()
        from google.auth.transport.requests import Request

        if not creds.valid and creds.refresh_token:
            creds.refresh(Request())
        if not creds.token:
            raise AuthError("OAuth flow did not yield an access token.")
        return AuthContext(headers={"Authorization": f"Bearer {creds.token}"})


def build_auth(config: Config) -> AuthStrategy:
    """Construct the auth strategy selected by ``config.auth_mode``."""
    if config.auth_mode == AUTH_MODE_COOKIE:
        return CookieAuth.from_config(config)
    if config.auth_mode == AUTH_MODE_OAUTH:
        return OAuthAuth(config)
    raise AuthError(f"Unsupported auth mode: {config.auth_mode!r}")  # pragma: no cover
