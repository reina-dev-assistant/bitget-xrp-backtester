#!/usr/bin/env node

const SYMBOL = 'XRPUSDT';
const PRODUCT_TYPE = 'USDT-FUTURES';
const GRANULARITY = '30m';
const HTF_GRANULARITY = '1H';
const START = '2026-01-01T00:00:00Z';
const END = new Date().toISOString();

const cfg = {
  breakoutLen: 30,
  emaFast: 50,
  emaSlow: 200,
  atrLen: 14,
  volLen: 20,
  volumeMult: 1.3,
  rr: 1.5,
  maxHoldBars: 8,
  closePosMin: 0.65,
  upperWickMult: 1.2,
  slAtrMult: 0.2,
  maxRiskPct: 0.02,
  minAtrPct: 0.002,
  feeSlippagePct: 0.0016,
  useHtfFilter: false,
  htfGranularity: HTF_GRANULARITY,
  htfMode: 'ema-close', // 'ema-close', 'ema-only', 'close-only'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function ema(values, len) {
  const k = 2 / (len + 1);
  const out = [];
  let prev = values[0];
  for (const v of values) {
    prev = v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function sma(values, len) {
  return values.map((_, i) => i + 1 < len ? null : avg(values.slice(i + 1 - len, i + 1)));
}

function atr(candles, len) {
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });
  return sma(tr, len);
}

function granularityMs(granularity) {
  if (granularity === '30m') return 30 * 60 * 1000;
  if (granularity === '1H') return 60 * 60 * 1000;
  if (granularity === '4H') return 4 * 60 * 60 * 1000;
  throw new Error(`Unsupported granularity: ${granularity}`);
}

async function fetchCandles(granularity = GRANULARITY) {
  const stepMs = 200 * granularityMs(granularity);
  let cursor = Date.parse(START);
  const end = Date.parse(END);
  const rows = [];

  while (cursor < end) {
    const batchEnd = Math.min(cursor + stepMs - 30 * 60 * 1000, end);
    const qs = new URLSearchParams({
      symbol: SYMBOL,
      productType: PRODUCT_TYPE,
      granularity,
      startTime: String(cursor),
      endTime: String(batchEnd),
      limit: '200',
    });
    const url = `https://api.bitget.com/api/v2/mix/market/history-candles?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const json = await res.json();
    if (json.code !== '00000') throw new Error(JSON.stringify(json));
    rows.push(...json.data);
    cursor = batchEnd + granularityMs(granularity);
    await sleep(80);
  }

  const uniq = new Map(rows.map((r) => [Number(r[0]), r]));
  return [...uniq.values()].sort((a, b) => Number(a[0]) - Number(b[0])).map((r) => ({
    time: new Date(Number(r[0])).toISOString(),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

function buildHtfTrend(candles, htfCandles) {
  if (!cfg.useHtfFilter) return candles.map(() => true);

  const closes = htfCandles.map((c) => c.close);
  const htfEma50 = ema(closes, cfg.emaFast);
  const htfEma200 = ema(closes, cfg.emaSlow);
  const htf = htfCandles.map((c, i) => ({
    ms: Date.parse(c.time),
    ok:
      cfg.htfMode === 'ema-only'
        ? htfEma50[i] > htfEma200[i]
        : cfg.htfMode === 'close-only'
          ? c.close > htfEma200[i]
          : htfEma50[i] > htfEma200[i] && c.close > htfEma200[i],
  }));

  let j = 0;
  return candles.map((c) => {
    const t = Date.parse(c.time);
    while (j + 1 < htf.length && htf[j + 1].ms <= t) j++;
    return htf[j]?.ok ?? false;
  });
}

function backtest(candles, htfCandles = []) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ema50 = ema(closes, cfg.emaFast);
  const ema200 = ema(closes, cfg.emaSlow);
  const atr14 = atr(candles, cfg.atrLen);
  const volMa = sma(volumes, cfg.volLen);
  const trades = [];
  const htfTrendOk = buildHtfTrend(candles, htfCandles);
  let nextAllowed = 0;

  for (let i = Math.max(cfg.emaSlow, cfg.breakoutLen, cfg.atrLen, cfg.volLen); i < candles.length - 1; i++) {
    if (i < nextAllowed) continue;
    const c = candles[i];
    const prevHighs = candles.slice(i - cfg.breakoutLen, i).map((x) => x.high);
    const resistance = Math.max(...prevHighs);
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const closePos = range === 0 ? 0 : (c.close - c.low) / range;
    const upperWick = c.high - Math.max(c.open, c.close);

    const signal =
      ema50[i] > ema200[i] &&
      htfTrendOk[i] &&
      c.close > ema50[i] &&
      c.close > ema200[i] &&
      c.close > resistance &&
      c.volume > cfg.volumeMult * volMa[i] &&
      c.close > c.open &&
      closePos >= cfg.closePosMin &&
      upperWick <= body * cfg.upperWickMult &&
      atr14[i] / c.close >= cfg.minAtrPct;

    if (!signal) continue;

    const entry = c.close;
    const stopBase = Math.min(...candles.slice(i - 4, i + 1).map((x) => x.low));
    const stop = stopBase - cfg.slAtrMult * atr14[i];
    const risk = entry - stop;
    const riskPct = risk / entry;
    if (risk <= 0 || riskPct > cfg.maxRiskPct) continue;

    const tp = entry + risk * cfg.rr;
    const end = Math.min(candles.length - 1, i + cfg.maxHoldBars);
    let exitIdx = end;
    let exit = candles[end].close;
    let reason = 'TIMEOUT';

    for (let j = i + 1; j <= end; j++) {
      if (candles[j].low <= stop) { exitIdx = j; exit = stop; reason = 'SL'; break; }
      if (candles[j].high >= tp) { exitIdx = j; exit = tp; reason = 'TP'; break; }
    }

    const netReturn = (exit - entry) / entry - cfg.feeSlippagePct;
    trades.push({ entryTime: c.time, exitTime: candles[exitIdx].time, entry, exit, stop, tp, reason, netReturnPct: netReturn * 100, r: netReturn / riskPct });
    nextAllowed = exitIdx + 1;
  }
  return trades;
}

function summarize(trades) {
  let equity = 1, peak = 1, maxDd = 0;
  for (const t of trades) {
    equity *= 1 + t.netReturnPct / 100;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, (peak - equity) / peak);
  }
  const wins = trades.filter((t) => t.netReturnPct > 0);
  const gp = wins.reduce((s, t) => s + t.netReturnPct, 0);
  const gl = Math.abs(trades.filter((t) => t.netReturnPct <= 0).reduce((s, t) => s + t.netReturnPct, 0));
  return {
    symbol: `${SYMBOL} ${PRODUCT_TYPE}`,
    timeframe: GRANULARITY,
    start: START,
    end: END,
    trades: trades.length,
    winRate: trades.length ? +(wins.length / trades.length * 100).toFixed(2) : 0,
    profitFactor: gl ? +(gp / gl).toFixed(2) : null,
    netReturnPct: +((equity - 1) * 100).toFixed(2),
    maxDrawdownPct: +(maxDd * 100).toFixed(2),
    avgTradePct: trades.length ? +(trades.reduce((s, t) => s + t.netReturnPct, 0) / trades.length).toFixed(3) : 0,
    expectancyR: trades.length ? +(trades.reduce((s, t) => s + t.r, 0) / trades.length).toFixed(3) : 0,
    config: cfg,
  };
}

(async () => {
  const candles = await fetchCandles();
  const htfCandles = cfg.useHtfFilter ? await fetchCandles(cfg.htfGranularity) : [];
  const trades = backtest(candles, htfCandles);
  const summary = summarize(trades);
  console.log(JSON.stringify({ summary, trades }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
