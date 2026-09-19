import { useState } from "react";
import { formatDate, formatEuro, formatEuroCompact } from "../storage";
import type { Transaction } from "../types";

type Props = {
  transactions: Transaction[];
};

type Mode = "saldo" | "flow" | "samen";

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
  const [mode, setMode] = useState<Mode>("saldo");

  if (transactions.length === 0) return null;

  // Per dag: totaal inkomend, totaal uitgaand en het cumulatieve eind-van-dag
  // saldo. Per dag samenvatten vermijdt dat de volgorde binnen één dag een
  // misleidende dip toont (uitgave vóór een even grote inkomst).
  const inByDay = new Map<string, number>();
  const outByDay = new Map<string, number>();
  for (const tx of transactions) {
    const m = tx.direction === "in" ? inByDay : outByDay;
    m.set(tx.occurredOn, (m.get(tx.occurredOn) ?? 0) + tx.amount);
  }
  const dates = [...new Set([...inByDay.keys(), ...outByDay.keys()])].sort((a, b) =>
    a.localeCompare(b),
  );
  let acc = 0;
  const days = dates.map((date) => {
    const din = inByDay.get(date) ?? 0;
    const dout = outByDay.get(date) ?? 0;
    acc += din - dout;
    return { date, in: din, out: dout, balance: acc };
  });

  const showLine = mode !== "flow";
  const showBars = mode !== "saldo";

  // Y-bereik op basis van wat getoond wordt (alles in euro, één as).
  const vals: number[] = [0];
  if (showLine) vals.push(...days.map((d) => d.balance));
  if (showBars) {
    vals.push(...days.map((d) => d.in));
    vals.push(...days.map((d) => -d.out));
  }
  const rawMax = Math.max(...vals);
  const rawMin = Math.min(...vals);
  const maxY = niceCeil(rawMax) || 1;
  const minY = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const yRange = Math.max(1, maxY - minY);
  const xMax = Math.max(1, days.length - 1);

  const toX = (i: number) => PAD_X + (i / xMax) * (WIDTH - PAD_X * 2);
  const toY = (v: number) =>
    PAD_TOP + (1 - (v - minY) / yRange) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const zeroY = toY(0);
  const seg = (WIDTH - PAD_X * 2) / xMax;
  const barW = Math.max(4, Math.min(seg * 0.4, 22));

  const linePath = days
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d.balance).toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    days.map((d, i) => `L ${toX(i).toFixed(1)} ${toY(d.balance).toFixed(1)}`).join(" ") +
    ` L ${toX(days.length - 1).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const last = days[days.length - 1];
  const negative = last.balance < 0;
  // In "saldo" kleurt de lijn mee met het saldo; in "samen" tekenen we de lijn
  // in inkt zodat ze losstaat van de teal/amber staven.
  const accent = negative ? "text-uit-600" : "text-in-600";

  const yTicks = [maxY, ...(minY < 0 ? [0, minY] : minY === 0 && maxY > 0 ? [0] : [])];
  const hd = hover != null ? days[hover] : null;

  // Tooltip: regels afhankelijk van de modus.
  const tipRows: { t: string; kind: "bold" | "muted" | "in" | "out" }[] = hd
    ? mode === "saldo"
      ? [
          { t: formatEuro(hd.balance), kind: "bold" },
          { t: formatDate(hd.date), kind: "muted" },
        ]
      : mode === "flow"
        ? [
            { t: formatDate(hd.date), kind: "muted" },
            { t: `+ ${formatEuro(hd.in)}`, kind: "in" },
            { t: `− ${formatEuro(hd.out)}`, kind: "out" },
          ]
        : [
            { t: formatDate(hd.date), kind: "muted" },
            { t: `Saldo ${formatEuro(hd.balance)}`, kind: "bold" },
            { t: `+ ${formatEuro(hd.in)}`, kind: "in" },
            { t: `− ${formatEuro(hd.out)}`, kind: "out" },
          ]
    : [];
  const tipW = 156;
  const tipH = 12 + tipRows.length * 15;
  let tipX = hd ? toX(hover!) - tipW / 2 : 0;
  tipX = Math.max(PAD_X - 8, Math.min(WIDTH - PAD_X - tipW + 8, tipX));
  const tipY = PAD_TOP + 4;

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-sterk">
            Saldo over tijd
          </h3>
          <p className="text-xs text-zacht">
            Tik of beweeg over de grafiek voor details
          </p>
          <div className="mt-2 inline-flex rounded-lg bg-ink-50 p-0.5 text-xs dark:bg-ink-900">
            {(
              [
                ["saldo", "Saldo"],
                ["flow", "In & uit"],
                ["samen", "Samen"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setHover(null);
                }}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium transition ${
                  mode === m
                    ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white"
                    : "text-basis hover:text-ink-900 dark:hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {showBars && (
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-basis">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-in-600" /> Inkomend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-uit-600" /> Uitgaand
              </span>
              {mode === "samen" && (
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5 rounded bg-ink-900 dark:bg-white" /> Saldo
                </span>
              )}
            </div>
          )}
        </div>
        <span
          className={`text-base font-bold tabular-nums ${
            negative ? "text-uit-700 dark:text-uit-400" : "text-sterk"
          }`}
        >
          {formatEuro(last.balance)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`h-48 w-full ${accent}`}
        onMouseLeave={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="bal-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.26" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

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
              {formatEuroCompact(t)}
            </text>
          </g>
        ))}

        {/* Staven: inkomend omhoog (teal), uitgaand omlaag (amber). */}
        {showBars &&
          days.map((d, i) => (
            <g key={d.date}>
              {d.in > 0 && (
                <rect
                  x={toX(i) - barW / 2}
                  y={toY(d.in)}
                  width={barW}
                  height={Math.max(0, zeroY - toY(d.in))}
                  rx={2}
                  className="fill-teal-500"
                />
              )}
              {d.out > 0 && (
                <rect
                  x={toX(i) - barW / 2}
                  y={zeroY}
                  width={barW}
                  height={Math.max(0, toY(-d.out) - zeroY)}
                  rx={2}
                  className="fill-amber-500"
                />
              )}
            </g>
          ))}

        {/* Saldolijn (+ vlak in "saldo"-modus). */}
        {showLine && mode === "saldo" && <path d={areaPath} fill="url(#bal-area-grad)" />}
        {showLine && (
          <path
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            className={mode === "samen" ? "text-ink-800 dark:text-white" : undefined}
          />
        )}
        {showLine &&
          days.length <= 40 &&
          days.map((d, i) => (
            <circle
              key={d.date}
              cx={toX(i)}
              cy={toY(d.balance)}
              r={3}
              className={
                mode === "samen"
                  ? "fill-navy-800 stroke-white dark:fill-white dark:stroke-navy-900"
                  : "stroke-white dark:stroke-navy-900"
              }
              fill={mode === "samen" ? undefined : "currentColor"}
              strokeWidth="1.5"
            />
          ))}

        {/* Datumlabels aan de uiteinden */}
        <text x={PAD_X} y={HEIGHT - 8} className="fill-navy-400 text-[10px] dark:fill-navy-400">
          {formatDate(days[0].date)}
        </text>
        <text
          x={WIDTH - PAD_X}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-navy-400 text-[10px] dark:fill-navy-400"
        >
          {formatDate(last.date)}
        </text>

        {/* Hover: verticale gids + tooltip */}
        {hd && (
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
            {showLine && (
              <circle
                cx={toX(hover!)}
                cy={toY(hd.balance)}
                r={5}
                className={
                  mode === "samen"
                    ? "fill-navy-800 stroke-white dark:fill-white dark:stroke-navy-900"
                    : "stroke-white dark:stroke-navy-900"
                }
                fill={mode === "samen" ? undefined : "currentColor"}
                strokeWidth="2.5"
              />
            )}
            <g>
              <rect
                x={tipX}
                y={tipY}
                width={tipW}
                height={tipH}
                rx={8}
                className="fill-navy-900 dark:fill-navy-700"
              />
              {tipRows.map((r, idx) => (
                <text
                  key={idx}
                  x={tipX + tipW / 2}
                  y={tipY + 16 + idx * 15}
                  textAnchor="middle"
                  className={
                    r.kind === "in"
                      ? "fill-teal-300 text-[11px] font-semibold tabular-nums"
                      : r.kind === "out"
                        ? "fill-amber-300 text-[11px] font-semibold tabular-nums"
                        : r.kind === "bold"
                          ? "fill-white text-[11px] font-semibold tabular-nums"
                          : "fill-navy-300 text-[10px]"
                  }
                >
                  {r.t}
                </text>
              ))}
            </g>
          </>
        )}

        {/* Onzichtbare hit-zones per dag. onPointerDown erbij zodat de tooltip
            ook op touch werkt; enkel onMouseEnter doet daar niets betrouwbaars. */}
        {days.map((d, i) => (
          <rect
            key={d.date}
            x={toX(i) - seg / 2}
            y={PAD_TOP}
            width={seg}
            height={HEIGHT - PAD_TOP - PAD_BOTTOM}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
}
