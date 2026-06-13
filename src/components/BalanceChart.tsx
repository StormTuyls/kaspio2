import { useState } from "react";
import { formatDate, formatEuro } from "../storage";
import type { Transaction } from "../types";

type Props = {
  transactions: Transaction[];
};

const WIDTH = 600;
const HEIGHT = 220;
const PAD_X = 52;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

/** Mooi afgerond tick-bedrag boven `v` (bv. 1234 -> 1500). */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function BalanceChart({ transactions }: Props) {
  const [hover, setHover] = useState<number | null>(null);

  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) =>
    a.occurredOn.localeCompare(b.occurredOn),
  );

  let running = 0;
  const points = sorted.map((tx) => {
    running += tx.direction === "in" ? tx.amount : -tx.amount;
    return { date: tx.occurredOn, balance: running };
  });
  if (points.length === 1) {
    points.unshift({ date: points[0].date, balance: 0 });
  }

  const ys = points.map((p) => p.balance);
  const rawMax = Math.max(0, ...ys);
  const rawMin = Math.min(0, ...ys);
  const maxY = niceCeil(rawMax) || (rawMin < 0 ? 0 : 1);
  const minY = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const yRange = Math.max(1, maxY - minY);
  const xMax = Math.max(1, points.length - 1);

  const toX = (i: number) => PAD_X + (i / xMax) * (WIDTH - PAD_X * 2);
  const toY = (v: number) =>
    PAD_TOP + (1 - (v - minY) / yRange) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const zeroY = toY(0);

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.balance).toFixed(1)}`)
    .join(" ");

  const area =
    `M ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    points.map((p, i) => `L ${toX(i).toFixed(1)} ${toY(p.balance).toFixed(1)}`).join(" ") +
    ` L ${toX(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const last = points[points.length - 1];
  const negative = last.balance < 0;
  // Teal bij positief saldo, amber bij negatief (consistent met de app-kleuren).
  const accent = negative ? "text-amber-600" : "text-teal-500";
  const areaFill = negative ? "fill-amber-500/15" : "fill-teal-500/15";

  // Y-as ticks: max, 0 (indien in bereik), min
  const yTicks = [maxY, ...(minY < 0 ? [0, minY] : minY === 0 && maxY > 0 ? [0] : [])];

  const seg = (WIDTH - PAD_X * 2) / xMax;
  const hp = hover != null ? points[hover] : null;

  // Tooltip-box afmetingen + clamping binnen het plotgebied
  const tipW = 124;
  const tipH = 38;
  let tipX = hp ? toX(hover!) - tipW / 2 : 0;
  tipX = Math.max(PAD_X - 8, Math.min(WIDTH - PAD_X - tipW + 8, tipX));
  let tipY = hp ? toY(hp.balance) - tipH - 12 : 0;
  if (tipY < PAD_TOP) tipY = hp ? toY(hp.balance) + 12 : 0;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-navy-50">
            Saldo over tijd
          </h3>
          <p className="text-xs text-navy-400 dark:text-navy-300">
            Cumulatief verloop , beweeg over de lijn voor details
          </p>
        </div>
        <span
          className={`text-base font-bold tabular-nums ${
            negative ? "text-amber-700 dark:text-amber-400" : "text-navy-900 dark:text-navy-50"
          }`}
        >
          {formatEuro(last.balance)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`h-48 w-full ${accent}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Y-gridlines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_X}
              x2={WIDTH - PAD_X}
              y1={toY(t)}
              y2={toY(t)}
              className={
                t === 0
                  ? "stroke-navy-200 dark:stroke-navy-600"
                  : "stroke-navy-100 dark:stroke-navy-700/60"
              }
              stroke="currentColor"
              strokeDasharray={t === 0 ? "0" : "4 4"}
            />
            <text
              x={PAD_X - 8}
              y={toY(t) + 3}
              textAnchor="end"
              className="fill-navy-400 text-[10px] tabular-nums dark:fill-navy-400"
            >
              {formatEuro(t)}
            </text>
          </g>
        ))}

        {/* Vlak + lijn */}
        <path d={area} className={areaFill} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Datumlabels aan de uiteinden */}
        <text x={PAD_X} y={HEIGHT - 8} className="fill-navy-400 text-[10px] dark:fill-navy-400">
          {formatDate(points[0].date)}
        </text>
        <text
          x={WIDTH - PAD_X}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-navy-400 text-[10px] dark:fill-navy-400"
        >
          {formatDate(last.date)}
        </text>

        {/* Hover: verticale gids + highlight-punt */}
        {hp && (
          <>
            <line
              x1={toX(hover!)}
              x2={toX(hover!)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              className="stroke-navy-300 dark:stroke-navy-500"
              stroke="currentColor"
              strokeDasharray="3 3"
            />
            <circle
              cx={toX(hover!)}
              cy={toY(hp.balance)}
              r={5}
              fill="currentColor"
              className="stroke-white dark:stroke-navy-900"
              strokeWidth="2.5"
            />
            <g>
              <rect
                x={tipX}
                y={tipY}
                width={tipW}
                height={tipH}
                rx={8}
                className="fill-navy-900 dark:fill-navy-700"
              />
              <text
                x={tipX + tipW / 2}
                y={tipY + 15}
                textAnchor="middle"
                className="fill-white text-[11px] font-semibold tabular-nums"
              >
                {formatEuro(hp.balance)}
              </text>
              <text
                x={tipX + tipW / 2}
                y={tipY + 29}
                textAnchor="middle"
                className="fill-navy-300 text-[10px]"
              >
                {formatDate(hp.date)}
              </text>
            </g>
          </>
        )}

        {/* Onzichtbare hit-zones per punt voor hover */}
        {points.map((_, i) => (
          <rect
            key={i}
            x={toX(i) - seg / 2}
            y={PAD_TOP}
            width={seg}
            height={HEIGHT - PAD_TOP - PAD_BOTTOM}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
}
