"""Tests for environment-driven configuration."""

from __future__ import annotations

import pytest

from notebooklm_mcp.config import (
    AUTH_MODE_COOKIE,
    AUTH_MODE_OAUTH,
    Config,
    ConfigError,
)

_ENV_KEYS = [
    "NOTEBOOKLM_AUTH_MODE",
    "NOTEBOOKLM_BASE_URL",
    "NOTEBOOKLM_COOKIE",
    "NOTEBOOKLM_COOKIE_FILE",
    "NOTEBOOKLM_OAUTH_CLIENT_SECRETS",
    "NOTEBOOKLM_OAUTH_TOKEN_FILE",
    "NOTEBOOKLM_OAUTH_SCOPES",
    "NOTEBOOKLM_REQUEST_TIMEOUT",
]


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for key in _ENV_KEYS:
        monkeypatch.delenv(key, raising=False)


def test_cookie_mode_from_env(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_COOKIE", "SID=abc; SAPISID=ghi")
    config = Config.from_env()
    assert config.auth_mode == AUTH_MODE_COOKIE
    assert config.cookie_string == "SID=abc; SAPISID=ghi"


def test_cookie_mode_requires_a_source(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_AUTH_MODE", "cookie")
    with pytest.raises(ConfigError):
        Config.from_env()


def test_cookie_file_must_exist(monkeypatch, tmp_path):
    monkeypatch.setenv("NOTEBOOKLM_COOKIE_FILE", str(tmp_path / "nope.json"))
    with pytest.raises(ConfigError):
        Config.from_env()


def test_invalid_auth_mode(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_AUTH_MODE", "banana")
    with pytest.raises(ConfigError):
        Config.from_env()


def test_oauth_mode_requires_client_secrets(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_AUTH_MODE", "oauth")
    with pytest.raises(ConfigError):
        Config.from_env()


def test_oauth_mode_ok(monkeypatch, tmp_path):
    secrets = tmp_path / "client_secrets.json"
    secrets.write_text("{}")
    monkeypatch.setenv("NOTEBOOKLM_AUTH_MODE", "oauth")
    monkeypatch.setenv("NOTEBOOKLM_OAUTH_CLIENT_SECRETS", str(secrets))
    monkeypatch.setenv("NOTEBOOKLM_OAUTH_SCOPES", "scope-a scope-b")
    config = Config.from_env()
    assert config.auth_mode == AUTH_MODE_OAUTH
    assert config.oauth_scopes == ("scope-a", "scope-b")


def test_invalid_timeout(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_COOKIE", "SAPISID=ghi")
    monkeypatch.setenv("NOTEBOOKLM_REQUEST_TIMEOUT", "not-a-number")
    with pytest.raises(ConfigError):
        Config.from_env()


def test_defaults(monkeypatch):
    monkeypatch.setenv("NOTEBOOKLM_COOKIE", "SAPISID=ghi")
    config = Config.from_env()
    assert config.base_url == "https://notebooklm.google.com"
    assert config.request_timeout == 30.0
