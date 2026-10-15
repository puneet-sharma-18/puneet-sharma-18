"""Market data and headlines from free public sources (Yahoo Finance, Google News RSS).

Data is delayed and unofficial. Good enough for planning, not for execution; confirm on Groww.
"""
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.utils import parsedate_to_datetime

USER_AGENT = "Mozilla/5.0 (trading-desk)"

MACRO_TICKERS = {
    "Brent crude ($)": "BZ=F",
    "USD/INR": "INR=X",
    "Nifty 50": "^NSEI",
    "India VIX": "^INDIAVIX",
    "Gold ($/oz)": "GC=F",
}


@dataclass
class Quote:
    symbol: str
    price: float
    prev_close: float

    @property
    def change_pct(self):
        if not self.prev_close:
            return 0.0
        return (self.price - self.prev_close) / self.prev_close * 100


@dataclass
class Headline:
    title: str
    source: str
    published: str
    link: str


def http_get(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def nse_ticker(symbol):
    """Plain NSE symbol -> Yahoo ticker. Already-qualified tickers pass through."""
    if symbol.startswith("^") or "=" in symbol or symbol.endswith((".NS", ".BO")):
        return symbol
    return f"{symbol}.NS"


def parse_chart(symbol, payload):
    meta = json.loads(payload)["chart"]["result"][0]["meta"]
    return Quote(
        symbol=symbol,
        price=float(meta["regularMarketPrice"]),
        prev_close=float(meta.get("chartPreviousClose") or meta.get("previousClose") or 0),
    )


def get_quote(ticker, fetch=http_get):
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{urllib.parse.quote(ticker)}?range=5d&interval=1d"
    )
    return parse_chart(ticker, fetch(url))


def get_quotes(tickers, fetch=http_get):
    """Return ({ticker: Quote}, {ticker: error message}). One failure doesn't stop the rest."""
    quotes, errors = {}, {}
    for t in tickers:
        try:
            quotes[t] = get_quote(t, fetch)
        except Exception as exc:  # network, bad symbol, schema change
            errors[t] = f"{type(exc).__name__}: {exc}"
    return quotes, errors


def parse_rss(payload, limit):
    root = ET.fromstring(payload)
    items = []
    for item in root.iter("item"):
        title = item.findtext("title", "").strip()
        source = item.findtext("source", "").strip()
        raw_date = item.findtext("pubDate", "")
        try:
            published = parsedate_to_datetime(raw_date).strftime("%Y-%m-%d %H:%M")
        except (TypeError, ValueError):
            published = raw_date
        # Google News appends " - Source" to titles; drop the duplicate.
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3]
        items.append(Headline(title, source, published, item.findtext("link", "")))
        if len(items) >= limit:
            break
    return items


def get_news(query, limit=5, fetch=http_get):
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": f"{query} when:7d", "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    )
    return parse_rss(fetch(url), limit)
