# Workflow

Ask Claude to run any of these. With the Groww MCP connected it pulls live holdings;
otherwise it uses `portfolio/holdings.csv` and `python3 -m desk report`.

## Pre-market (08:30–09:15 IST), 10 minutes

Prompt: *"Run the pre-market brief."*

1. Overnight: US close, Asian markets, GIFT Nifty, Brent, USD/INR, US 10-yr yield.
2. Headlines for holdings + watchlist + macro keywords (`desk report`).
3. Any holding near its stop or target? Any results/AGM/ex-dividend today?
4. Decide: **today is a no-action day** (default) or list at most 1–2 specific planned actions
   with prices. Write them down before the open.

## Post-market (after 15:30 IST), 10 minutes

Prompt: *"Run the post-market review."*

1. What moved in the portfolio and why (stock → sector → index → macro → technical).
2. FII/DII provisional figures.
3. Stops/targets hit? Update GTTs on Groww if a stop should trail.
4. Journal any trade taken today (`journal/TEMPLATE.md`).

## Weekly (weekend), 30 minutes

Prompt: *"Weekly review."*

- Portfolio vs Nifty 50 for the week. Sector and oil exposure.
- Re-read thesis of every satellite position. Still valid? Time stop?
- Watchlist: anything reaching an entry zone? Prepare the trade plan (entry, stop, target, size).
- Macro: has the oil/war situation changed? Update `macro/briefing-*.md` if so.
- Rule-break check: any rule in `rules.md` broken this week? Why?

## Monthly, 1 hour

- Full P&L including charges and tax. Win rate, average win vs average loss.
- Mutual fund review against `portfolio/mf-plan.md`. Rebalance only if allocation drifts > 5%.
- Results season (Jan/Apr/Jul/Oct): read results of every holding, update thesis.

## Event-driven: macro shock (war, oil spike, crash)

Prompt: *"Macro shock playbook for <event>."*

1. **Don't act in the first hour.** Gaps on war news often partly reverse.
2. Map the channel: which of your holdings sit in a hurt or helped sector
   (`macro/oil-shock-map.md`, `desk exposure`)?
3. For each hurt holding: trading position → follow the stop. Long-term holding → does the
   shock change 3-year earnings or only next quarter? Usually only next quarter.
4. Opportunity list: quality names in hurt sectors that fall into your buy zone are candidates
   for the core bucket in tranches over weeks, not in one go.
5. Define what de-escalation looks like (ceasefire, Brent back below a level, Hormuz flows
   normalising) and which trades you'd make then. Write it down now.
