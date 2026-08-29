import { useState } from "react";
import { formatEuro, formatEuroCompact } from "../storage";
import type { Transaction } from "../types";

type Props = {
  /** Transacties binnen het bereik van de gebruiker (admin/reader: alle; pot-owner: eigen). */
  transactions: Transaction[];
};

type Period = "day" | "week" | "month" | "year";

const PERIODS: { id: Period; label: string; buckets: number; sub: string }[] = [
  { id: "day", label: "Dag", buckets: 14, sub: "Laatste 14 dagen" },
  { id: "week", label: "Week", buckets: 12, sub: "Laatste 12 weken" },
  { id: "month", label: "Maand", buckets: 12, sub: "Laatste 12 maanden" },
  { id: "year", label: "Jaar", buckets: 6, sub: "Laatste 6 jaar" },
];

const WIDTH = 600;
const HEIGHT = 200;
const PAD_X = 52;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Periode-key van een transactie-datum (YYYY-MM-DD) voor de gekozen granulariteit. */
function periodKey(dateStr: string, period: Period): string {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (period === "year") return `${y}`;
  if (period === "month") return `${y}-${pad2(m)}`;
  if (period === "day") return `${y}-${pad2(m)}-${pad2(d)}`;
  // week: maandag van die week
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return fmtDate(dt);
}

/** Opeenvolgende periode-keys eindigend op vandaag. */
function trailingKeys(period: Period, count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  if (period === "year") {
    const y = now.getFullYear();
    for (let k = 0; k < count; k++) keys.unshift(`${y - k}`);
  } else if (period === "month") {
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let k = 0; k < count; k++) {
      keys.unshift(`${y}-${pad2(m)}`);
      m--;
      if (m === 0) {
        m = 12;
        y--;
      }
    }
  } else if (period === "day") {
    for (let k = 0; k < count; k++) {
      const d = new Date(now);
      d.setDate(now.getDate() - k);
      keys.unshift(fmtDate(d));
    }
  } else {
    // week: maandag van deze week, telkens 7 dagen terug
    const base = new Date(now);
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    for (let k = 0; k < count; k++) {
      const d = new Date(base);
      d.setDate(base.getDate() - 7 * k);
      keys.unshift(fmtDate(d));
    }
  }
  return keys;
}

function labelFor(key: string, period: Period, multiYear: boolean): string {
  if (period === "year") return key;
  if (period === "month") {
    const [y, m] = key.split("-").map(Number);
    const lbl = new Intl.DateTimeFormat("nl-BE", { month: "short" }).format(
      new Date(y, m - 1, 1),
    );
    return multiYear ? `${lbl} '${String(y).slice(2)}` : lbl;
  }
  // day & week: key = YYYY-MM-DD -> d/m
  const [, m, d] = key.split("-").map(Number);
  return `${d}/${m}`;
}

export function CashflowChart({ transactions }: Props) {
  const [period, setPeriod] = useState<Period>("month");
  if (transactions.length === 0) return null;

  const conf = PERIODS.find((p) => p.id === period)!;

  // Aggregeer inkomend/uitgaand per periode-key.
  const byKey = new Map<string, { in: number; out: number }>();
  for (const t of transactions) {
    const key = periodKey(t.occurredOn, period);
    const e = byKey.get(key) ?? { in: 0, out: 0 };
    if (t.direction === "in") e.in += t.amount;
    else e.out += t.amount;
    byKey.set(key, e);
  }

  const keys = trailingKeys(period, conf.buckets);
  const data = keys.map((k) => ({
    key: k,
    in: byKey.get(k)?.in ?? 0,
    out: byKey.get(k)?.out ?? 0,
  }));
  const multiYear =
    period === "month" && new Set(keys.map((k) => k.slice(0, 4))).size > 1;
  const hasData = data.some((d) => d.in > 0 || d.out > 0);
  // Te veel dag-labels: toon er om de twee.
  const labelEvery = period === "day" ? 2 : 1;

  const maxVal = niceCeil(Math.max(1, ...data.map((d) => Math.max(d.in, d.out))));
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const toH = (v: number) => (v / maxVal) * plotH;

  const groupW = (WIDTH - PAD_X * 2) / data.length;
  const barW = Math.min(22, Math.max(4, (groupW - 8) / 2));

  return (
    <div className="rounded-md border border-ink-300/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.1)] dark:border-ink-800/60 dark:bg-ink-950 dark:shadow-none">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-tight text-ink-900 dark:text-ink-100">
            Cashflow
          </h3>
          <p className="text-xs text-ink-600 dark:text-ink-500">{conf.sub}</p>
        </div>
        <div className="inline-flex rounded-xl bg-ink-100 p-1 dark:bg-ink-900">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                period === p.id
                  ? "bg-white text-ink-700 shadow-sm dark:bg-ink-800 dark:text-white"
                  : "text-ink-700 hover:text-ink-800 dark:text-ink-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1 flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 text-ink-700 dark:text-ink-500">
          <span className="h-2.5 w-2.5 rounded-sm bg-in-600" /> Inkomend
        </span>
        <span className="flex items-center gap-1.5 text-ink-700 dark:text-ink-500">
          <span className="h-2.5 w-2.5 rounded-sm bg-uit-600" /> Uitgaand
        </span>
      </div>

      {hasData ? (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full">
          {/* Gridlines op 0, 50%, 100% */}
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={baseY - f * plotH}
                y2={baseY - f * plotH}
                className="stroke-slate-100 dark:stroke-navy-700/60"
                stroke="currentColor"
                strokeDasharray={f === 0 ? "0" : "4 4"}
              />
              <text
                x={PAD_X - 8}
                y={baseY - f * plotH + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px] tabular-nums"
                style={{ fontFamily: "var(--font-num)" }}
              >
                {formatEuroCompact(maxVal * f)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD_X + groupW * i + groupW / 2;
            const inX = cx - barW - 1;
            const outX = cx + 1;
            const lbl = labelFor(d.key, period, multiYear);
            return (
              <g key={d.key}>
                {d.in > 0 && (
                  <rect
                    x={inX}
                    y={baseY - toH(d.in)}
                    width={barW}
                    height={toH(d.in)}
                    rx={3}
                    className="fill-in-600"
                  >
                    <title>{`${lbl} , inkomend ${formatEuro(d.in)}`}</title>
                  </rect>
                )}
                {d.out > 0 && (
                  <rect
                    x={outX}
                    y={baseY - toH(d.out)}
                    width={barW}
                    height={toH(d.out)}
                    rx={3}
                    className="fill-uit-600"
                  >
                    <title>{`${lbl} , uitgaand ${formatEuro(d.out)}`}</title>
                  </rect>
                )}
                {i % labelEvery === 0 && (
                  <text
                    x={cx}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {lbl}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="flex h-44 items-center justify-center text-center text-sm text-ink-600 dark:text-ink-500">
          Geen transacties in deze periode.
        </div>
      )}
    </div>
  );
}
