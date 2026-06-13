import { formatEuro } from "../storage";
import type { Transaction } from "../types";

type Props = {
  /** Transacties binnen het bereik van de gebruiker (admin/reader: alle; pot-owner: eigen). */
  transactions: Transaction[];
  months?: number;
};

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

/** Genereer `count` opeenvolgende maand-keys (YYYY-MM) eindigend op `end`. */
function lastMonths(end: string, count: number): string[] {
  let [y, m] = end.split("-").map(Number);
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

function monthLabel(key: string, showYear: boolean): string {
  const [y, m] = key.split("-").map(Number);
  const lbl = new Intl.DateTimeFormat("nl-BE", { month: "short" }).format(
    new Date(y, m - 1, 1),
  );
  return showYear ? `${lbl} '${String(y).slice(2)}` : lbl;
}

export function CashflowChart({ transactions, months = 6 }: Props) {
  if (transactions.length === 0) return null;

  // Som inkomend/uitgaand per maand-key
  const byMonth = new Map<string, { in: number; out: number }>();
  let latest = "";
  for (const t of transactions) {
    const key = t.occurredOn.slice(0, 7);
    if (key > latest) latest = key;
    const e = byMonth.get(key) ?? { in: 0, out: 0 };
    if (t.direction === "in") e.in += t.amount;
    else e.out += t.amount;
    byMonth.set(key, e);
  }
  if (!latest) return null;

  const keys = lastMonths(latest, months);
  const data = keys.map((k) => ({
    key: k,
    in: byMonth.get(k)?.in ?? 0,
    out: byMonth.get(k)?.out ?? 0,
  }));
  const multiYear = new Set(keys.map((k) => k.slice(0, 4))).size > 1;

  const maxVal = niceCeil(Math.max(1, ...data.map((d) => Math.max(d.in, d.out))));
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseY = PAD_TOP + plotH;
  const toH = (v: number) => (v / maxVal) * plotH;

  const groupW = (WIDTH - PAD_X * 2) / data.length;
  const barW = Math.min(22, (groupW - 10) / 2);

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-navy-50">
            Cashflow per maand
          </h3>
          <p className="text-xs text-navy-400 dark:text-navy-300">
            Laatste {months} maanden
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-navy-500 dark:text-navy-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" /> Inkomend
          </span>
          <span className="flex items-center gap-1.5 text-navy-500 dark:text-navy-300">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Uitgaand
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-44 w-full">
        {/* Gridlines op 0, 50%, 100% */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={baseY - f * plotH}
              y2={baseY - f * plotH}
              className="stroke-navy-100 dark:stroke-navy-700/60"
              stroke="currentColor"
              strokeDasharray={f === 0 ? "0" : "4 4"}
            />
            <text
              x={PAD_X - 8}
              y={baseY - f * plotH + 3}
              textAnchor="end"
              className="fill-navy-400 text-[10px] tabular-nums"
            >
              {formatEuro(maxVal * f)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD_X + groupW * i + groupW / 2;
          const inX = cx - barW - 1;
          const outX = cx + 1;
          return (
            <g key={d.key}>
              {d.in > 0 && (
                <rect
                  x={inX}
                  y={baseY - toH(d.in)}
                  width={barW}
                  height={toH(d.in)}
                  rx={3}
                  className="fill-teal-500"
                >
                  <title>{`${monthLabel(d.key, true)} , inkomend ${formatEuro(d.in)}`}</title>
                </rect>
              )}
              {d.out > 0 && (
                <rect
                  x={outX}
                  y={baseY - toH(d.out)}
                  width={barW}
                  height={toH(d.out)}
                  rx={3}
                  className="fill-amber-500"
                >
                  <title>{`${monthLabel(d.key, true)} , uitgaand ${formatEuro(d.out)}`}</title>
                </rect>
              )}
              <text
                x={cx}
                y={HEIGHT - 8}
                textAnchor="middle"
                className="fill-navy-400 text-[10px]"
              >
                {monthLabel(d.key, multiYear)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
