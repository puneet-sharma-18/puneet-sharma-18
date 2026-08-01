"""The MCP server exposing NotebookLM tools over stdio.

Built on the official MCP Python SDK's ``FastMCP`` helper. The server is
credential-aware: it loads config from the environment at import time and
constructs the configured auth strategy lazily on first use, so a missing
credential produces a clear tool-level error instead of a crash on startup.
"""

from __future__ import annotations

from typing import Any

# The high-level server class was named ``FastMCP`` in mcp<2 and renamed to
# ``MCPServer`` in mcp>=2. The tool/run API is identical, so support both.
try:  # mcp >= 2.0
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # pragma: no cover - older SDKs
    from mcp.server.fastmcp import FastMCP as _Server

from .auth import AuthError, build_auth
from .client import NotebookLMClient
from .config import Config, ConfigError

mcp = _Server("notebooklm")

# Lazily-initialised singletons. Kept module-level so tools share one client and
# one (refreshable) auth strategy.
_client: NotebookLMClient | None = None
_init_error: str | None = None


async def _get_client() -> NotebookLMClient:
    """Return the shared client, building it (and surfacing config errors) once."""
    global _client, _init_error
    if _client is not None:
        return _client
    if _init_error is not None:
        raise AuthError(_init_error)
    try:
        config = Config.from_env()
        auth = build_auth(config)
    except (ConfigError, AuthError) as exc:
        _init_error = str(exc)
        raise AuthError(_init_error) from exc
    _client = NotebookLMClient(config, auth)
    return _client


@mcp.tool()
async def auth_status() -> dict[str, Any]:
    """Check whether the configured NotebookLM credentials are valid.

    Use this first to confirm the server can authenticate before calling other
    tools. Returns the auth mode in use and whether NotebookLM accepted the
    credentials.
    """
    try:
        client = await _get_client()
    except AuthError as exc:
        return {"authenticated": False, "detail": str(exc)}
    return await client.verify()


@mcp.tool()
async def list_notebooks() -> dict[str, Any]:
    """List the notebooks available to the authenticated NotebookLM account.

    NotebookLM exposes no stable public API, so this verifies authentication and
    reports how listing should be wired against the ``batchexecute`` RPC. Replace
    the body with the concrete RPC call for your deployment.
    """
    client = await _get_client()
    status = await client.verify()
    if not status.get("authenticated"):
        return {"ok": False, "reason": "not authenticated", "detail": status}
    return {
        "ok": True,
        "note": (
            "Authenticated. Notebook listing is deployment-specific: issue the "
            "batchexecute RPC for your NotebookLM surface using the authenticated "
            "client (auth headers are attached automatically)."
        ),
        "auth": status,
    }


def main() -> None:
    """Console-script entry point: run the server over stdio."""
    mcp.run()


if __name__ == "__main__":
    main()
