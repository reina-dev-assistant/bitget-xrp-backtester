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

## Final candidate v2 (after HTF regime filter)

```text
breakoutLen: 30
volumeMult: 1.3
rr: 1.5
maxHoldBars: 8
-closePosMin: 0.65
upperWickMult: 1.2
slAtrMult: 0.2
maxRiskPct: 0.02
minAtrPct: 0.002
useHtfFilter: true
htfGranularity: 1H
htfMode: ema-close
```

Backtest 2025–now (HTF enabled):

```text
Trades: 63
Winrate: 49.21%
Profit Factor: 1.55
Net Return: +13.08%
Max Drawdown: 8.11%
Avg Trade: +0.202%
Expectancy: +0.112R
```

Backtest 2026 only (bullish regime):

```text
Trades: 17
Winrate: 64.71%
Profit Factor: 4.82
Net Return: +10.03%
Max Drawdown: 0.75%
Avg Trade: +0.569%
Expectancy: +0.393R
```

Change one thing at a time. Jangan jadi tuyul CPU.

## HTF regime filter tests

Enable `useHtfFilter` to only take 30m entries during higher-timeframe bullish regimes.

```text
Test 25: useHtfFilter true, htfGranularity 1H, htfMode ema-close
Test 26: useHtfFilter true, htfGranularity 4H, htfMode ema-close
Test 27: useHtfFilter true, htfGranularity 1H, htfMode close-only
```

Modes:

```text
ema-close  = HTF EMA50 > EMA200 and HTF close > EMA200
ema-only   = HTF EMA50 > EMA200
close-only = HTF close > EMA200
```
