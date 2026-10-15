"""Build the daily markdown report."""
from datetime import date

from . import data
from .portfolio import alerts_for, load_sectors, oil_exposure

NEWS_PER_TOPIC = 3
MACRO_NEWS_TOPICS = [
    "Brent crude oil price",
    "Saudi Arabia Houthi Strait of Hormuz oil",
    "Sensex Nifty FII crude",
]


def _inr(x):
    sign = "-" if x < 0 else ""
    return f"{sign}₹{abs(x):,.0f}"


def build_report(holdings, fetch=data.http_get, with_news=True, today=None):
    today = today or date.today()
    sectors = load_sectors()
    lines = [f"# Desk report: {today.isoformat()}", "",
             "_Delayed public data. Confirm on Groww before acting._", ""]

    macro, macro_err = data.get_quotes(data.MACRO_TICKERS.values(), fetch)
    lines += ["## Macro", "", "| Indicator | Last | Day % |", "|---|---:|---:|"]
    for name, ticker in data.MACRO_TICKERS.items():
        q = macro.get(ticker)
        lines.append(f"| {name} | {q.price:,.2f} | {q.change_pct:+.2f}% |" if q
                     else f"| {name} | n/a | |")
    lines.append("")

    tickers = {h.symbol: data.nse_ticker(h.symbol) for h in holdings}
    quotes, errors = data.get_quotes(tickers.values(), fetch)
    prices = {s: quotes[t].price for s, t in tickers.items() if t in quotes}

    lines += ["## Holdings", "",
              "| Symbol | Bucket | Qty | Avg | LTP | Day % | P&L | P&L % | Oil |",
              "|---|---|---:|---:|---:|---:|---:|---:|---|"]
    total_cost = total_value = 0.0
    all_alerts = []
    for h in holdings:
        q = quotes.get(tickers[h.symbol])
        oil = sectors.get(h.symbol, ("", None))[1]
        oil_txt = f"{oil:+d}" if oil is not None else "?"
        if not q:
            lines.append(f"| {h.symbol} | {h.bucket} | {h.qty:g} | {h.avg_price:,.2f} "
                         f"| n/a | | | | {oil_txt} |")
            continue
        value = h.qty * q.price
        pnl = value - h.cost
        total_cost += h.cost
        total_value += value
        lines.append(
            f"| {h.symbol} | {h.bucket} | {h.qty:g} | {h.avg_price:,.2f} | {q.price:,.2f} "
            f"| {q.change_pct:+.2f}% | {_inr(pnl)} | {pnl / h.cost * 100:+.1f}% | {oil_txt} |"
        )
        all_alerts += [f"**{h.symbol}**: {a}" for a in alerts_for(h, q.price)]
    if total_cost:
        pnl = total_value - total_cost
        lines += ["", f"**Priced value:** {_inr(total_value)} · **Cost:** {_inr(total_cost)} · "
                      f"**Unrealised P&L:** {_inr(pnl)} ({pnl / total_cost * 100:+.1f}%)"]
    lines.append("")

    lines += ["## Alerts", ""]
    lines += [f"- {a}" for a in all_alerts] or ["- None. No stop or target within reach."]
    lines.append("")

    shares, net = oil_exposure(holdings, prices, sectors)
    lines += ["## Oil sensitivity", ""]
    for label, pct in sorted(shares.items(), key=lambda kv: -kv[1]):
        lines.append(f"- {label}: {pct:.1f}%")
    lines += ["", f"Net oil score: **{net:+.2f}** (−2 = portfolio suffers most from higher "
                  "crude, +2 = benefits most). See `macro/oil-shock-map.md`.", ""]

    if with_news:
        lines += ["## Headlines (last 7 days)", ""]
        topics = [(t, t) for t in MACRO_NEWS_TOPICS] + [
            (h.symbol, f"{h.symbol} share NSE") for h in holdings
        ]
        for label, query in topics:
            try:
                items = data.get_news(query, NEWS_PER_TOPIC, fetch)
            except Exception as exc:
                lines.append(f"- _{label}: news unavailable ({type(exc).__name__})_")
                continue
            if not items:
                continue
            lines.append(f"**{label}**")
            lines += [f"- {n.published} · [{n.title}]({n.link}) ({n.source})" for n in items]
            lines.append("")

    failed = {**macro_err, **errors}
    if failed:
        lines += ["## Data errors", ""] + [f"- {t}: {e}" for t, e in failed.items()] + [""]
    return "\n".join(lines)
