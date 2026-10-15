"""CLI: python3 -m desk {report,exposure,news,quote}"""
import argparse
import sys
from datetime import date

from . import data
from .portfolio import ROOT, load_holdings, load_sectors, oil_exposure
from .report import build_report


def main(argv=None):
    p = argparse.ArgumentParser(prog="desk", description=__doc__)
    p.add_argument("--holdings", help="holdings CSV (default portfolio/holdings.csv)")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("report", help="daily report -> reports/YYYY-MM-DD.md")
    r.add_argument("--no-news", action="store_true")
    r.add_argument("--stdout", action="store_true", help="print instead of writing a file")
    sub.add_parser("exposure", help="oil-sensitivity breakdown (cost basis, offline)")
    n = sub.add_parser("news", help="headlines for a topic")
    n.add_argument("query", nargs="+")
    n.add_argument("-n", type=int, default=8)
    q = sub.add_parser("quote", help="quotes for NSE symbols or Yahoo tickers")
    q.add_argument("symbols", nargs="+")
    args = p.parse_args(argv)

    if args.cmd == "report":
        text = build_report(load_holdings(args.holdings), with_news=not args.no_news)
        if args.stdout:
            print(text)
        else:
            out = ROOT / "reports" / f"{date.today().isoformat()}.md"
            out.parent.mkdir(exist_ok=True)
            out.write_text(text)
            print(f"Wrote {out}")
    elif args.cmd == "exposure":
        holdings = load_holdings(args.holdings)
        sectors = load_sectors()
        shares, net = oil_exposure(holdings, {}, sectors)
        for label, pct in sorted(shares.items(), key=lambda kv: -kv[1]):
            print(f"{label:>16}: {pct:5.1f}%")
        print(f"{'net oil score':>16}: {net:+.2f}  (-2 hurt most by higher crude, +2 helped most)")
        unmapped = [h.symbol for h in holdings if h.symbol not in sectors]
        if unmapped:
            print("Add to portfolio/sectors.csv:", ", ".join(unmapped))
    elif args.cmd == "news":
        for h in data.get_news(" ".join(args.query), args.n):
            print(f"{h.published}  {h.title}  ({h.source})\n    {h.link}")
    elif args.cmd == "quote":
        quotes, errors = data.get_quotes([data.nse_ticker(s.upper()) for s in args.symbols])
        for t, qt in quotes.items():
            print(f"{t:<14} {qt.price:>12,.2f}  {qt.change_pct:+.2f}%")
        for t, e in errors.items():
            print(f"{t:<14} error: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
