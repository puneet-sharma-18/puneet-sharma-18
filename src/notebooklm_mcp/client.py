"""A thin HTTP client that applies an :class:`~notebooklm_mcp.auth.AuthStrategy`.

This isolates *authentication* (the focus of this project) from whatever RPC
shapes NotebookLM expects. The client's job is: attach valid credentials to
every request, expose a ``verify()`` health check, and give the MCP tools a
place to hang higher-level calls.

Because NotebookLM's consumer surface is an unofficial, undocumented
``batchexecute`` RPC, the resource-level helpers below are intentionally kept as
thin, clearly-marked wrappers rather than pretending to be a stable SDK.
"""

from __future__ import annotations

from typing import Any

import httpx

from .auth import AuthError, AuthStrategy
from .config import Config


class NotebookLMClient:
    """Authenticated HTTP client for NotebookLM."""

    def __init__(self, config: Config, auth: AuthStrategy):
        self._config = config
        self._auth = auth
        self._http = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=config.request_timeout,
            headers={
                # Present as a normal browser client; the RPC endpoints reject
                # obviously-automated user agents.
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
                ),
                "X-Same-Domain": "1",
            },
            follow_redirects=True,
        )

    async def __aenter__(self) -> NotebookLMClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._http.aclose()
        self._auth.close()

    def _authorized(self, headers: dict[str, str] | None = None) -> dict[str, str]:
        """Merge freshly-signed auth headers with any per-request headers."""
        ctx = self._auth.context(origin=self._config.base_url)
        # Cookies are set on the shared client jar; SAPISIDHASH must be recomputed
        # per request because it embeds a timestamp, so it goes in headers here.
        for name, value in ctx.cookies.items():
            self._http.cookies.set(name, value)
        merged = dict(ctx.headers)
        if headers:
            merged.update(headers)
        return merged

    async def request(
        self,
        method: str,
        path: str,
        *,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Perform an authenticated request and raise on auth failures."""
        response = await self._http.request(
            method, path, headers=self._authorized(headers), **kwargs
        )
        if response.status_code in (401, 403):
            raise AuthError(
                f"NotebookLM rejected the request ({response.status_code}). "
                "Your session cookies or OAuth token are likely expired or "
                "missing the required scopes."
            )
        return response

    async def verify(self) -> dict[str, Any]:
        """Confirm the current credentials are accepted by NotebookLM.

        Returns a small status dict rather than raising for non-auth failures, so
        callers (and the MCP ``auth_status`` tool) can report a clear diagnosis.
        """
        try:
            response = await self.request("GET", "/")
        except AuthError as exc:
            return {"authenticated": False, "detail": str(exc)}
        except httpx.HTTPError as exc:
            return {"authenticated": False, "detail": f"network error: {exc}"}

        authenticated = response.status_code < 400
        return {
            "authenticated": authenticated,
            "status_code": response.status_code,
            "auth_mode": self._config.auth_mode,
            "base_url": self._config.base_url,
        }
