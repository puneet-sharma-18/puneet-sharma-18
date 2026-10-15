"""Load holdings, compute P&L, stop/target alerts and oil-sensitivity exposure."""
import csv
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORTFOLIO_DIR = ROOT / "portfolio"

OIL_LABELS = {-2: "strongly hurt", -1: "hurt", 0: "neutral", 1: "helped", 2: "strongly helped"}

# Alert when price is within this % of the stop or target.
NEAR_PCT = 3.0


def _num(value):
    value = (value or "").strip()
    return float(value) if value else None


@dataclass
class Holding:
    symbol: str
    qty: float
    avg_price: float
    bucket: str = ""
    stop: float = None
    target: float = None
    thesis: str = ""

    @property
    def cost(self):
        return self.qty * self.avg_price


def load_holdings(path=None):
    path = Path(path) if path else PORTFOLIO_DIR / "holdings.csv"
    if not path.exists():
        example = PORTFOLIO_DIR / "holdings.example.csv"
        raise FileNotFoundError(
            f"{path} not found. Copy {example} to {path} and fill in your positions."
        )
    with open(path, newline="") as f:
        return [
            Holding(
                symbol=row["symbol"].strip().upper(),
                qty=float(row["qty"]),
                avg_price=float(row["avg_price"]),
                bucket=(row.get("bucket") or "").strip(),
                stop=_num(row.get("stop")),
                target=_num(row.get("target")),
                thesis=(row.get("thesis") or "").strip(),
            )
            for row in csv.DictReader(f)
            if (row.get("symbol") or "").strip()
        ]


def load_sectors(path=None):
    path = Path(path) if path else PORTFOLIO_DIR / "sectors.csv"
    with open(path, newline="") as f:
        return {
            row["symbol"].strip().upper(): (row["sector"], int(row["oil_sensitivity"]))
            for row in csv.DictReader(f)
        }


def alerts_for(h, price):
    """Human-readable alerts for one holding at the given price."""
    out = []
    if h.stop is not None:
        if price <= h.stop:
            out.append(f"STOP HIT: {price:.2f} <= stop {h.stop:.2f}. Rule says exit")
        elif (price - h.stop) / price * 100 <= NEAR_PCT:
            out.append(f"near stop: {price:.2f} vs stop {h.stop:.2f}")
    if h.target is not None:
        if price >= h.target:
            out.append(f"TARGET HIT: {price:.2f} >= {h.target:.2f}. Book 1/3-1/2, trail stop")
        elif (h.target - price) / price * 100 <= NEAR_PCT:
            out.append(f"near target: {price:.2f} vs target {h.target:.2f}")
    return out


def oil_exposure(holdings, prices, sectors):
    """Share of current portfolio value by oil-sensitivity score.

    Uses avg_price where no live price is available. Unknown symbols count as 'unmapped'.
    """
    buckets = {}
    total = 0.0
    for h in holdings:
        value = h.qty * prices.get(h.symbol, h.avg_price)
        total += value
        _, score = sectors.get(h.symbol, (None, None))
        key = OIL_LABELS[score] if score is not None else "unmapped"
        buckets[key] = buckets.get(key, 0.0) + value
    if not total:
        return {}, 0.0
    net = sum(
        h.qty * prices.get(h.symbol, h.avg_price) * sectors[h.symbol][1]
        for h in holdings
        if h.symbol in sectors
    ) / total
    return {k: v / total * 100 for k, v in buckets.items()}, net
