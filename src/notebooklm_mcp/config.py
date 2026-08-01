"""Configuration loading for the NotebookLM MCP server.

Settings are read from environment variables so the server can be launched by an
MCP host (Claude Desktop, etc.) without editing code. All values have sane
defaults; only the credentials for your chosen auth mode are required.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Auth modes the server understands.
AUTH_MODE_COOKIE = "cookie"
AUTH_MODE_OAUTH = "oauth"
VALID_AUTH_MODES = frozenset({AUTH_MODE_COOKIE, AUTH_MODE_OAUTH})

# NotebookLM has no official public API. The consumer product is driven by
# Google's internal "batchexecute" RPC endpoints under this origin, which is why
# cookie/SAPISIDHASH auth is the default strategy.
DEFAULT_BASE_URL = "https://notebooklm.google.com"


class ConfigError(RuntimeError):
    """Raised when the environment is missing or has invalid configuration."""


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None or value == "":
        return default
    return value


@dataclass(slots=True)
class Config:
    """Resolved server configuration.

    Attributes:
        auth_mode: Either ``cookie`` or ``oauth``.
        base_url: NotebookLM origin used for requests and SAPISIDHASH signing.
        cookie_string: Raw ``Cookie:`` header value (cookie mode).
        cookie_file: Path to a Netscape/JSON cookie export (cookie mode).
        oauth_client_secrets: Path to a Google OAuth client-secrets JSON.
        oauth_token_file: Where the OAuth refresh/access token is cached.
        oauth_scopes: Space-separated OAuth scopes.
        request_timeout: Per-request timeout in seconds.
    """

    auth_mode: str = AUTH_MODE_COOKIE
    base_url: str = DEFAULT_BASE_URL

    # Cookie auth
    cookie_string: str | None = None
    cookie_file: Path | None = None

    # OAuth auth
    oauth_client_secrets: Path | None = None
    oauth_token_file: Path | None = None
    oauth_scopes: tuple[str, ...] = field(
        default_factory=lambda: ("https://www.googleapis.com/auth/cloud-platform",)
    )

    request_timeout: float = 30.0

    @classmethod
    def from_env(cls) -> Config:
        """Build a :class:`Config` from environment variables and validate it."""
        auth_mode = (_env("NOTEBOOKLM_AUTH_MODE", AUTH_MODE_COOKIE) or "").lower()
        if auth_mode not in VALID_AUTH_MODES:
            raise ConfigError(
                f"NOTEBOOKLM_AUTH_MODE must be one of {sorted(VALID_AUTH_MODES)}, "
                f"got {auth_mode!r}"
            )

        cookie_file = _env("NOTEBOOKLM_COOKIE_FILE")
        oauth_client_secrets = _env("NOTEBOOKLM_OAUTH_CLIENT_SECRETS")
        oauth_token_file = _env("NOTEBOOKLM_OAUTH_TOKEN_FILE")

        scopes_raw = _env(
            "NOTEBOOKLM_OAUTH_SCOPES",
            "https://www.googleapis.com/auth/cloud-platform",
        )
        scopes = tuple(s for s in (scopes_raw or "").split() if s)

        timeout_raw = _env("NOTEBOOKLM_REQUEST_TIMEOUT", "30")
        try:
            timeout = float(timeout_raw)  # type: ignore[arg-type]
        except (TypeError, ValueError) as exc:
            raise ConfigError(
                f"NOTEBOOKLM_REQUEST_TIMEOUT must be a number, got {timeout_raw!r}"
            ) from exc

        config = cls(
            auth_mode=auth_mode,
            base_url=_env("NOTEBOOKLM_BASE_URL", DEFAULT_BASE_URL),  # type: ignore[arg-type]
            cookie_string=_env("NOTEBOOKLM_COOKIE"),
            cookie_file=Path(cookie_file).expanduser() if cookie_file else None,
            oauth_client_secrets=(
                Path(oauth_client_secrets).expanduser() if oauth_client_secrets else None
            ),
            oauth_token_file=(
                Path(oauth_token_file).expanduser() if oauth_token_file else None
            ),
            oauth_scopes=scopes,
            request_timeout=timeout,
        )
        config.validate()
        return config

    def validate(self) -> None:
        """Ensure the credentials required by the selected auth mode are present."""
        if self.auth_mode == AUTH_MODE_COOKIE:
            if not self.cookie_string and not self.cookie_file:
                raise ConfigError(
                    "Cookie auth requires NOTEBOOKLM_COOKIE (a raw Cookie header) "
                    "or NOTEBOOKLM_COOKIE_FILE (a cookie export path)."
                )
            if self.cookie_file and not self.cookie_file.exists():
                raise ConfigError(f"Cookie file not found: {self.cookie_file}")
        elif self.auth_mode == AUTH_MODE_OAUTH:
            if not self.oauth_client_secrets:
                raise ConfigError(
                    "OAuth auth requires NOTEBOOKLM_OAUTH_CLIENT_SECRETS "
                    "(path to a Google OAuth client-secrets JSON)."
                )
            if not self.oauth_client_secrets.exists():
                raise ConfigError(
                    f"OAuth client secrets not found: {self.oauth_client_secrets}"
                )
            if not self.oauth_scopes:
                raise ConfigError("OAuth auth requires at least one scope.")
