# Trading Desk

A personal system for planning, tracking and reviewing Indian equity and mutual fund
investments, built to work with Claude and the Groww MCP connector.

The point of it is to make decisions **written down, rule-based and reviewable** rather
than reactive. It does not predict prices and it does not trade on its own.

```
trading-desk/
├── CLAUDE.md                 How Claude should operate this desk (read first)
├── playbook/
│   ├── rules.md              Risk & position-sizing rules: the non-negotiables
│   ├── glossary.md           Terminology: charts, F&O, flows, manipulation patterns
│   └── workflow.md           Daily / weekly / monthly / event-driven routines
├── macro/
│   ├── oil-shock-map.md      How crude moves hit each Indian sector (winners/losers)
│   └── briefing-2026-10.md   Current situation: Saudi–Houthi / Iran war, Brent, India
├── portfolio/
│   ├── holdings.example.csv  Template: copy to holdings.csv (git-ignored)
│   ├── watchlist.csv         Stocks you're tracking but don't own
│   ├── sectors.csv           Symbol → sector + oil sensitivity map
│   └── mf-plan.md            Mutual fund / long-term allocation plan
├── journal/
│   └── TEMPLATE.md           One file per trade: thesis, entry, exit, lesson
├── reports/                  Generated daily reports (git-ignored)
└── desk/                     Python tool (stdlib only, no installs)
```

## Quick start

```bash
cd trading-desk
cp portfolio/holdings.example.csv portfolio/holdings.csv   # then fill in your real positions
python3 -m desk report          # prices, P&L, stop/target alerts, oil exposure, headlines
python3 -m desk exposure        # how much of your portfolio is oil-sensitive
python3 -m desk news "Brent crude India"   # headlines for any topic
python3 -m unittest discover tests
```

`desk report` writes `reports/YYYY-MM-DD.md`. Prices come from Yahoo Finance (`.NS`
symbols) and headlines from Google News RSS. Both are free and delayed, fine for planning,
not for scalping.

If you connect the **Groww MCP** in Claude, Claude can read your live holdings and positions
directly from Groww instead of `holdings.csv`. See `CLAUDE.md`.

## Privacy

This repository is **public**. `portfolio/holdings.csv`, `reports/` and `journal/*.md`
(except the template) are git-ignored so your positions and P&L never get pushed. If you want
those under version control, move the desk to a **private** repository first.

## Disclaimer

This is a personal decision-support tool, not investment advice. Market data can be delayed
or wrong; always confirm on Groww before acting. Every order is your decision.
