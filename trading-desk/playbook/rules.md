# Rules

Edit the numbers to fit you, but once set, change them only on a weekend, never mid-trade.
Most retail losses come from breaking your own rules under stress, not from bad analysis.

## 1. Split the money into buckets

| Bucket | Share of capital | Horizon | What lives here |
|---|---|---|---|
| Core (long-term) | 60–70% | 3+ years | Index funds, flexi-cap MFs, quality compounders |
| Satellite (swing/positional) | 20–30% | weeks to months | Thesis-driven stock trades with stops |
| Opportunistic / learning | ≤10% | days to weeks | Event trades (e.g. oil shock), small size |
| Emergency fund | outside the desk | n/a | 6 months of expenses in liquid fund / FD |

Money from the core bucket never moves into a trade because "this one is obvious".

## 2. Position sizing

- **Risk per trade ≤ 1% of total capital.** Risk = (entry − stop) × quantity.
  Example: ₹10 lakh capital → max risk ₹10,000. Entry ₹500, stop ₹470 → risk ₹30/share
  → max 333 shares (₹1.66 lakh position).
- **Single stock ≤ 10% of portfolio**, single sector ≤ 25%.
- **Oil-sensitive exposure** (see `sectors.csv`): know the number. `python3 -m desk exposure`.
- Add to winners, never average down a trading position. Averaging down is allowed only in the
  core bucket, only on a schedule (SIP/STP), never because the price fell.

## 3. Every trade has three numbers before entry

1. **Thesis**: one sentence on why it should move, and what would prove it wrong.
2. **Stop-loss**: a price where the thesis is wrong (below support, below a swing low), not
   a % picked from the air. Place it on Groww as a stop-loss / GTT order.
3. **Target / review level**: where you take partial profit or re-assess.

Reward-to-risk should be ≥ 2:1. If the stop is so far away that the size becomes tiny,
skip the trade.

## 4. Selling rules

- **Stop hit → exit.** No "let me wait till tomorrow".
- **Thesis broken → exit**, even if the stop isn't hit (e.g. you bought an OMC on falling crude
  and crude spikes 15%).
- **Target hit → sell 1/3 to 1/2**, trail the stop on the rest.
- **Long-term holding falls 20%?** Not a sell signal by itself. Re-check the business:
  earnings, debt, management, competitive position. Sell on business deterioration, not price.
- Time stop: a swing trade that hasn't moved in 6–8 weeks frees its capital.

## 5. Behaviour limits

- Max 3 new positions per week. Max 2 consecutive losing trades → pause new trades for 5
  sessions and review the journal.
- Monthly drawdown of −6% on the satellite bucket → satellite trading stops for the month.
- No trades in the first 15 minutes after market open (09:15–09:30 IST) or on a headline
  alone. Wait for the close or for the move to hold.
- No F&O until 6 months of journaled, rule-following cash trades show a positive edge.
  SEBI's own studies have found ~9 in 10 individual F&O traders lose money.
- No tips from Telegram/WhatsApp/YouTube "operators". See *manipulation* in `glossary.md`.

## 6. Tax awareness (India, check current rates every Budget)

- Equity STCG (held < 12 months) and LTCG (≥ 12 months, above the annual exemption) are
  taxed differently. Holding just past 12 months can matter.
- Every sale is a taxable event; churn costs brokerage, STT and tax. Count them in P&L.
