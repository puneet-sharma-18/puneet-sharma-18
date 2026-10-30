# notebooklm-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that
lets an MCP host (Claude Desktop, IDEs, agents) talk to **Google NotebookLM**,
with a clean, pluggable **authentication** layer.

> ⚠️ **Unofficial.** NotebookLM has no official public API for the consumer
> product. This server authenticates the way the NotebookLM web client does —
> using your Google session cookies — and also supports OAuth 2.0 for
> NotebookLM Enterprise / Agentspace deployments that expose a real API. Use it
> with your own account and in line with Google's Terms of Service.

## Why auth is the hard part

Because there's no public API, the interesting work is *getting authenticated
requests through*. This project handles that with two interchangeable
strategies behind a small `AuthStrategy` interface:

| Mode | When to use | How it authenticates |
| --- | --- | --- |
| `cookie` (default) | Consumer NotebookLM (`notebooklm.google.com`) | Exported Google session cookies, signed per-request with a Google **`SAPISIDHASH`** `Authorization` header — the same scheme the web UI uses. |
| `oauth` | NotebookLM Enterprise / Agentspace with a Google Cloud API | Standard OAuth 2.0 bearer token via the Google auth libraries, with automatic refresh. |

Neither strategy logs or persists secrets; cookies/tokens stay in memory (OAuth
tokens are cached only to the path you configure).

## Install

```bash
pip install -e .            # cookie mode
pip install -e '.[oauth]'   # add OAuth support
pip install -e '.[dev]'     # add test/lint tooling
```

Requires Python 3.10+.

## Configure

Copy `.env.example` to `.env` and fill in the values for your mode, or export the
variables directly. All configuration is via environment variables so an MCP host
can launch the server unattended.

### Cookie mode (default)

1. Sign in to <https://notebooklm.google.com> in your browser.
2. Export your Google cookies — either copy the raw `Cookie:` request header from
   the Network tab, or use a "cookies.txt"/JSON cookie-export extension.
3. Provide them via **one** of:
   - `NOTEBOOKLM_COOKIE="SID=...; SAPISID=...; ..."`
   - `NOTEBOOKLM_COOKIE_FILE=/path/to/cookies.json`

The export must include a `SAPISID` (or `__Secure-3PAPISID` / `APISID`) cookie —
that's what the `SAPISIDHASH` signature is built from. The server validates this
at startup.

### OAuth mode

```bash
NOTEBOOKLM_AUTH_MODE=oauth
NOTEBOOKLM_OAUTH_CLIENT_SECRETS=/path/to/client_secrets.json
NOTEBOOKLM_OAUTH_TOKEN_FILE=/path/to/token.json          # optional cache
NOTEBOOKLM_OAUTH_SCOPES="https://www.googleapis.com/auth/cloud-platform"
```

The first run opens a browser for consent; the token is cached and refreshed
automatically thereafter.

## Run

```bash
notebooklm-mcp          # console script
python -m notebooklm_mcp # module form
```

The server speaks MCP over stdio. Register it with your host, e.g. Claude
Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "notebooklm-mcp",
      "env": {
        "NOTEBOOKLM_AUTH_MODE": "cookie",
        "NOTEBOOKLM_COOKIE_FILE": "/absolute/path/to/cookies.json"
      }
    }
  }
}
```

## Tools

| Tool | Description |
| --- | --- |
| `auth_status` | Verify the configured credentials are accepted by NotebookLM. Call this first. |
| `list_notebooks` | Confirms auth and returns guidance for wiring notebook listing against the `batchexecute` RPC for your deployment. |

The authentication layer is complete and tested; the resource-level RPC calls
are intentionally left as thin, clearly-marked wrappers because NotebookLM's
undocumented RPC surface changes over time. The authenticated `NotebookLMClient`
attaches valid credentials to every request, so adding a new tool is just a
matter of issuing the request.

## How SAPISIDHASH works

For each request the server computes:

```
Authorization: SAPISIDHASH <ts>_<sha1("<ts> <SAPISID> <origin>")>
```

where `ts` is the current Unix time and `origin` is
`https://notebooklm.google.com`. The timestamp is part of the signed payload, so
the header is recomputed per request (see `auth.compute_sapisidhash`).

## Development

```bash
pip install -e '.[dev]'
pytest        # run the test suite
ruff check .  # lint
```

The test suite covers cookie parsing (header, JSON, and Netscape formats),
SAPISID discovery, `SAPISIDHASH` computation against a reference digest, the
`CookieAuth` strategy, and environment-driven configuration validation.

## Project layout

```
src/notebooklm_mcp/
  config.py   # env-driven configuration + validation
  auth.py     # AuthStrategy, CookieAuth (SAPISIDHASH), OAuthAuth
  client.py   # authenticated async HTTP client
  server.py   # FastMCP server + tools
tests/        # auth + config tests
```

## Security notes

- Cookies and tokens are your Google credentials — treat them like passwords.
  `.gitignore` excludes common secret file names, and the server never logs them.
- Session cookies expire; when they do, `auth_status` reports `authenticated:
  false` and re-exporting fixes it.
- Prefer `NOTEBOOKLM_COOKIE_FILE` over inlining the raw cookie string in a shell
  history or config.

## License

MIT
