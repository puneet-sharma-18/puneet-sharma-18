"""Tests for the authentication layer."""

from __future__ import annotations

import hashlib
import json

import pytest

from notebooklm_mcp.auth import (
    AuthError,
    CookieAuth,
    compute_sapisidhash,
    find_sapisid,
    load_cookie_file,
    parse_cookie_header,
)

# --------------------------------------------------------------------------- #
# Cookie header parsing
# --------------------------------------------------------------------------- #


def test_parse_cookie_header_basic():
    cookies = parse_cookie_header("SID=abc; HSID=def; SAPISID=ghi")
    assert cookies == {"SID": "abc", "HSID": "def", "SAPISID": "ghi"}


def test_parse_cookie_header_values_with_equals():
    cookies = parse_cookie_header("token=a=b=c; x=1")
    assert cookies["token"] == "a=b=c"
    assert cookies["x"] == "1"


def test_parse_cookie_header_tolerates_whitespace_and_empties():
    cookies = parse_cookie_header("  SID=abc ;; ; SAPISID=ghi ;")
    assert cookies == {"SID": "abc", "SAPISID": "ghi"}


def test_parse_cookie_header_empty_raises():
    with pytest.raises(AuthError):
        parse_cookie_header("; ; ;")


# --------------------------------------------------------------------------- #
# Cookie file loading
# --------------------------------------------------------------------------- #


def test_load_cookie_file_json_list(tmp_path):
    path = tmp_path / "cookies.json"
    path.write_text(
        json.dumps(
            [
                {"name": "SID", "value": "abc", "domain": ".google.com"},
                {"name": "SAPISID", "value": "ghi"},
            ]
        )
    )
    cookies = load_cookie_file(path)
    assert cookies == {"SID": "abc", "SAPISID": "ghi"}


def test_load_cookie_file_json_object(tmp_path):
    path = tmp_path / "cookies.json"
    path.write_text(json.dumps({"SID": "abc", "SAPISID": "ghi"}))
    assert load_cookie_file(path) == {"SID": "abc", "SAPISID": "ghi"}


def test_load_cookie_file_netscape(tmp_path):
    path = tmp_path / "cookies.txt"
    path.write_text(
        "# Netscape HTTP Cookie File\n"
        ".google.com\tTRUE\t/\tTRUE\t0\tSID\tabc\n"
        ".google.com\tTRUE\t/\tTRUE\t0\tSAPISID\tghi\n"
    )
    cookies = load_cookie_file(path)
    assert cookies["SID"] == "abc"
    assert cookies["SAPISID"] == "ghi"


def test_load_cookie_file_empty_raises(tmp_path):
    path = tmp_path / "cookies.json"
    path.write_text("   ")
    with pytest.raises(AuthError):
        load_cookie_file(path)


def test_load_cookie_file_bad_json_raises(tmp_path):
    path = tmp_path / "cookies.json"
    path.write_text("{not valid json")
    with pytest.raises(AuthError):
        load_cookie_file(path)


# --------------------------------------------------------------------------- #
# SAPISID discovery
# --------------------------------------------------------------------------- #


def test_find_sapisid_prefers_sapisid():
    assert find_sapisid({"SAPISID": "primary", "APISID": "fallback"}) == "primary"


def test_find_sapisid_falls_back_to_secure_variant():
    assert find_sapisid({"__Secure-3PAPISID": "secure"}) == "secure"


def test_find_sapisid_missing_raises():
    with pytest.raises(AuthError):
        find_sapisid({"SID": "abc"})


# --------------------------------------------------------------------------- #
# SAPISIDHASH computation
# --------------------------------------------------------------------------- #


def test_compute_sapisidhash_matches_reference():
    ts = 1_700_000_000
    sapisid = "my-sapisid"
    origin = "https://notebooklm.google.com"
    expected_digest = hashlib.sha1(f"{ts} {sapisid} {origin}".encode()).hexdigest()

    result = compute_sapisidhash(sapisid, origin, timestamp=ts)

    assert result == f"SAPISIDHASH {ts}_{expected_digest}"


def test_compute_sapisidhash_strips_trailing_slash():
    ts = 42
    a = compute_sapisidhash("s", "https://x.google.com/", timestamp=ts)
    b = compute_sapisidhash("s", "https://x.google.com", timestamp=ts)
    assert a == b


def test_compute_sapisidhash_requires_sapisid():
    with pytest.raises(AuthError):
        compute_sapisidhash("", "https://x.google.com", timestamp=1)


def test_compute_sapisidhash_uses_now_by_default():
    r1 = compute_sapisidhash("s", "https://x.google.com")
    assert r1.startswith("SAPISIDHASH ")
    ts_part = r1.split(" ", 1)[1].split("_", 1)[0]
    assert ts_part.isdigit()


# --------------------------------------------------------------------------- #
# CookieAuth strategy
# --------------------------------------------------------------------------- #


def test_cookie_auth_context_has_signed_authorization():
    auth = CookieAuth({"SID": "abc", "SAPISID": "ghi"})
    ctx = auth.context(origin="https://notebooklm.google.com")

    assert ctx.headers["Authorization"].startswith("SAPISIDHASH ")
    assert ctx.headers["Origin"] == "https://notebooklm.google.com"
    assert ctx.headers["X-Goog-AuthUser"] == "0"
    assert ctx.cookies == {"SID": "abc", "SAPISID": "ghi"}


def test_cookie_auth_rejects_empty_cookies():
    with pytest.raises(AuthError):
        CookieAuth({})


def test_cookie_auth_rejects_cookies_without_sapisid():
    with pytest.raises(AuthError):
        CookieAuth({"SID": "abc"})


def test_cookie_auth_context_signature_changes_with_origin():
    auth = CookieAuth({"SAPISID": "ghi"})
    a = auth.context(origin="https://a.google.com").headers["Authorization"]
    b = auth.context(origin="https://b.google.com").headers["Authorization"]
    # Different origins must yield different signatures (timestamp aside, the
    # origin is part of the signed payload).
    assert a.split("_", 1)[1] != b.split("_", 1)[1] or a != b
