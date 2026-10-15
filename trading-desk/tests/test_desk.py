import json
import tempfile
import unittest
from pathlib import Path

from desk import data
from desk.portfolio import Holding, alerts_for, load_holdings, load_sectors, oil_exposure
from desk.report import build_report

ROOT = Path(__file__).resolve().parent.parent

PRICES = {"BZ=F": (104.0, 106.0), "ONGC.NS": (226.0, 230.0), "INDIGO.NS": (5000.0, 4900.0)}

RSS = b"""<?xml version="1.0"?><rss><channel>
<item><title>Brent slips as Saudi pledges supply - Reuters</title><source>Reuters</source>
<pubDate>Thu, 15 Oct 2026 06:00:00 GMT</pubDate><link>https://example.com/a</link></item>
</channel></rss>"""


def fake_fetch(url):
    if "news.google.com" in url:
        return RSS
    for ticker, (price, prev) in PRICES.items():
        if ticker.replace("=", "%3D").replace("^", "%5E") in url:
            return json.dumps({"chart": {"result": [{"meta": {
                "regularMarketPrice": price, "chartPreviousClose": prev}}]}}).encode()
    raise OSError("unknown ticker")


class DeskTests(unittest.TestCase):
    def test_ticker_mapping(self):
        self.assertEqual(data.nse_ticker("ONGC"), "ONGC.NS")
        self.assertEqual(data.nse_ticker("BZ=F"), "BZ=F")
        self.assertEqual(data.nse_ticker("^NSEI"), "^NSEI")

    def test_quote_change(self):
        q = data.get_quote("BZ=F", fake_fetch)
        self.assertAlmostEqual(q.change_pct, -1.8868, places=3)

    def test_rss_strips_source_suffix(self):
        (h,) = data.parse_rss(RSS, 5)
        self.assertEqual(h.title, "Brent slips as Saudi pledges supply")
        self.assertEqual(h.published, "2026-10-15 06:00")

    def test_alerts(self):
        h = Holding("ONGC", 10, 245, stop=228, target=290)
        self.assertIn("STOP HIT", alerts_for(h, 226)[0])
        self.assertIn("near stop", alerts_for(h, 233)[0])
        self.assertIn("TARGET HIT", alerts_for(h, 295)[0])
        self.assertEqual(alerts_for(h, 255), [])
        self.assertEqual(alerts_for(Holding("X", 1, 1), 5), [])

    def test_oil_exposure(self):
        sectors = {"ONGC": ("Upstream", 2), "INDIGO": ("Aviation", -2)}
        hs = [Holding("ONGC", 10, 100), Holding("INDIGO", 1, 1000), Holding("ZZZ", 1, 1000)]
        shares, net = oil_exposure(hs, {}, sectors)
        self.assertAlmostEqual(shares["strongly helped"], 100 / 3)
        self.assertAlmostEqual(shares["unmapped"], 100 / 3)
        self.assertAlmostEqual(net, 0.0)

    def test_example_holdings_are_mapped(self):
        sectors = load_sectors()
        for h in load_holdings(ROOT / "portfolio" / "holdings.example.csv"):
            self.assertIn(h.symbol, sectors)

    def test_missing_holdings_file_message(self):
        with self.assertRaisesRegex(FileNotFoundError, "holdings.example.csv"):
            load_holdings(Path(tempfile.gettempdir()) / "does-not-exist.csv")

    def test_report_handles_partial_failures(self):
        hs = [Holding("ONGC", 150, 245, "satellite", 228, 290),
              Holding("INDIGO", 10, 4800, "satellite", 4400, 5600),
              Holding("NOPE", 1, 10)]
        text = build_report(hs, fetch=fake_fetch)
        self.assertIn("STOP HIT", text)
        self.assertIn("| Brent crude ($) | 104.00 | -1.89% |", text)
        self.assertIn("| NOPE |", text)
        self.assertIn("## Data errors", text)
        self.assertIn("Brent slips as Saudi pledges supply", text)


if __name__ == "__main__":
    unittest.main()
