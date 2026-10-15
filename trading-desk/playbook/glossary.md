# Glossary

Grouped by what you'll use them for. Learn the first two sections well before the rest.

## Price & charts

- **Candlestick**: one bar showing open, high, low, close (OHLC) for a period. Green/hollow =
  closed above open.
- **Tick**: the smallest price move allowed (₹0.05 for most NSE stocks at the time of writing;
  NSE has been moving to price-band-based tick sizes, so check). Also used loosely for each
  individual trade print.
- **Trend**: series of higher highs + higher lows (uptrend) or lower highs + lower lows
  (downtrend). "The trend is your friend" = don't buy a stock making lower lows.
- **Support / resistance**: price zones where buying / selling has repeatedly appeared.
  Broken support often becomes resistance.
- **Breakout / breakdown**: close above resistance / below support, ideally on high volume.
  A *false breakout* reverses within 1–3 sessions; common trap.
- **Gap up / gap down**: open far from previous close, usually after overnight news.
- **Moving average (MA/EMA)**: average of last N closes. 50-DMA and 200-DMA are the most
  watched. Price above a rising 200-DMA = long-term uptrend. *Golden cross*: 50 crosses above
  200; *death cross*: below.
- **RSI**: momentum oscillator 0–100. >70 overbought, <30 oversold; in strong trends it stays
  extreme for a long time, so it's not a sell/buy signal alone.
- **MACD**: trend/momentum indicator from two EMAs; signal-line crossovers mark momentum shifts.
- **VWAP**: volume-weighted average price for the day. Institutions benchmark against it.
- **Volume / delivery %**: how many shares traded and what share was actually delivered
  (not squared off intraday). High delivery % on a rise = genuine buying.
- **52-week high/low**: stocks near 52w highs with rising volume tend to be strong; near 52w
  lows = something is wrong until proven otherwise.
- **Drawdown**: fall from peak value. Max drawdown = worst peak-to-trough.

## Orders (Groww)

- **Market order**: fills now at whatever price. Avoid in illiquid stocks.
- **Limit order**: fills only at your price or better.
- **Stop-loss (SL / SL-M)**: becomes active when trigger price is hit. SL places a limit order,
  SL-M a market order.
- **GTT (Good Till Triggered)**: standing order valid up to a year; use for stops and targets
  on delivery holdings.
- **CNC / Delivery** vs **MIS / Intraday**: delivery holds shares in demat; intraday must be
  squared off same day (and uses leverage).
- **Circuit / price band**: max daily move allowed (2/5/10/20%). A stock locked in upper circuit
  has no sellers; you usually can't get in, and when it breaks it can fall fast.

## Fundamentals

- **EPS, P/E**: earnings per share; price ÷ EPS. Compare with the stock's own history and peers.
- **P/B, ROE, ROCE**: book value multiple; return on equity / capital employed. ROCE > 15%
  sustained = good business.
- **Debt/Equity, interest coverage**: leverage and ability to service it.
- **Free cash flow**: operating cash minus capex. Profits that never become cash are a red flag.
- **Promoter holding / pledge**: falling promoter stake or rising pledged shares = caution.
- **Margins (gross, EBITDA)**: for oil-linked businesses, watch how crude moves margins with a
  1–2 quarter lag (see `macro/oil-shock-map.md`).

## Flows & macro

- **FII / FPI**: foreign institutional / portfolio investors. Heavy FII selling pressures
  large caps and the rupee.
- **DII**: domestic institutions (MFs, insurers). SIP inflows let DIIs absorb FII selling.
- **Brent / WTI**: global crude benchmarks. India imports ~85% of its oil, mostly priced off
  Brent / the Indian basket.
- **INR/USD**: weak rupee raises import costs (oil, electronics), helps exporters (IT, pharma).
- **Repo rate / RBI policy**: higher oil → higher inflation → fewer rate cuts → pressure on
  banks, NBFCs, real estate, autos.
- **CAD (current account deficit)**: widens when oil is expensive; a classic India risk.
- **India VIX**: expected Nifty volatility. Spikes on fear; > 20 = nervous market.
- **Crack spread / GRM**: refiner's margin between crude cost and product prices. Diesel
  shortages widen it → good for refiners like Reliance.
- **Under-recovery / marketing margin**: OMCs' loss when retail fuel prices are held below
  cost. The government often freezes pump prices during spikes.

## Derivatives (learn, don't trade yet)

- **Futures / options, F&O**: leveraged contracts. Call = right to buy, put = right to sell.
- **Open interest (OI)**: outstanding contracts. Price ↑ + OI ↑ = long build-up; price ↓ + OI ↑ =
  short build-up; price ↑ + OI ↓ = short covering; price ↓ + OI ↓ = long unwinding.
- **PCR (put-call ratio)**: sentiment gauge; very high = fear (contrarian bullish), very low =
  complacency.
- **Max pain**: strike where option buyers lose most at expiry; prices sometimes gravitate there.
- **Short selling**: selling first, buying later. In Indian cash market only intraday for
  retail; overnight shorts need futures/options.
- **Expiry**: weekly/monthly settlement days; volatility and manipulation risk are highest here.

## Manipulation & traps: what to recognise (and stay out of)

- **Pump and dump**: an operator accumulates an illiquid small-cap, promotes it through
  Telegram/WhatsApp/YouTube "tips", sells into the retail buying. Signs: tiny market cap, sudden
  volume spike with no news, repeated upper circuits, aggressive promotion. SEBI regularly
  bans entities for this.
- **Circular trading**: a group trades among itself to fake volume and price.
- **Stop hunting**: price is pushed briefly below an obvious support to trigger retail stops,
  then reverses. Defence: stops slightly beyond the obvious level, smaller size.
- **Bull/bear trap**: a fake breakout/breakdown that reverses. Defence: wait for a closing basis
  confirmation and volume.
- **Front-running / insider trading**: illegal; one reason big moves sometimes precede news.
- **Operator stocks / "multibagger" tips**: if a stranger is giving you a free tip, you're
  likely the exit liquidity.
- **Spoofing / layering**: placing large fake orders in the order book to move price, then
  cancelling. Don't read too much into big bids/offers on the market depth screen.
- **Results-day / expiry-day spikes**: volatility is engineered and liquid; avoid fresh
  positions in the last hour of expiry.

Verify any suspicious stock on NSE/BSE "surveillance measures" (ASM/GSM lists). Stocks in ASM
or GSM stages are flagged for unusual activity.
