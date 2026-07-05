# Bitget XRP Backtester

Standalone Node.js backtester for `XRPUSDT` Bitget USDT futures.

No npm dependencies. Requires Node.js 18+.

## Run

```bash
node bitget-backtest.js > result.json
```

Or:

```bash
npm run backtest > result.json
```

Then send the `summary` section from `result.json`.

## Strategy

Current strategy: **XRP Breakout Volume Long v1**.

Defaults:

```text
symbol: XRPUSDT
productType: USDT-FUTURES
timeframe: 30m
start: 2026-01-01
breakoutLen: 30
volumeMult: 1.3
rr: 1.5
maxHoldBars: 8
closePosMin: 0.65
upperWickMult: 1.2
slAtrMult: 0.2
maxRiskPct: 0.02
minAtrPct: 0.002
feeSlippagePct: 0.0016
useHtfFilter: true
htfGranularity: 1H
htfMode: ema-close
```

Edit `cfg` at the top of `bitget-backtest.js` to test params.

Suggested small tests:

```text
rr: 1.2 / 1.5 / 2.0
volumeMult: 1.3 / 1.5 / 2.0
maxHoldBars: 8 / 12 / 18
```

## Final candidate — 30m Breakout Long

Setelah eksperimen 5m, 15m, short breakout, dan mean reversion — satu-satunya yang punya edge konsisten:

Strategy: **30m breakout long, hanya saat HTF bullish (1H EMA50 > EMA200 & close > EMA200)**.

Config final:

```js
breakoutLen: 30,
volumeMult: 1.3,
rr: 1.5,
maxHoldBars: 8,
closePosMin: 0.65,
upperWickMult: 1.2,
slAtrMult: 0.2,
maxRiskPct: 0.02,
minAtrPct: 0.002,
useHtfFilter: true,
htfGranularity: '1H',
htfMode: 'ema-close',
```

### Backtest 2025–now (all regimes)

```text
Trades: 63    Winrate: 49.21%
PF: 1.55      Net: +13.08%
DD: 8.11%     Avg: +0.202%
Exp: +0.112R
```

### Backtest 2026 only (bullish)

```text
Trades: 17    Winrate: 64.71%
PF: 4.82      Net: +10.03%
DD: 0.75%     Avg: +0.569%
Exp: +0.393R
```

**Cron signal checker** aktif tiap 30 menit — deliver ke Telegram saat ada signal. No-trade saat HTF non-bullish.
