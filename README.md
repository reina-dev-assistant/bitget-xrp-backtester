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
breakoutLen: 20
volumeMult: 1.5
rr: 1.5
maxHoldBars: 12
feeSlippagePct: 0.0016
```

Edit `cfg` at the top of `bitget-backtest.js` to test params.

Suggested small tests:

```text
rr: 1.2 / 1.5 / 2.0
volumeMult: 1.3 / 1.5 / 2.0
maxHoldBars: 8 / 12 / 18
```

Change one thing at a time. Jangan jadi tuyul CPU.
