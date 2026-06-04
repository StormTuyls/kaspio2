import { formatEuro } from "../storage";
import type { Transaction } from "../types";

type Props = {
  transactions: Transaction[];
};

export function BalanceChart({ transactions }: Props) {
  if (transactions.length === 0) return null;

  const sorted = [...transactions].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn));

  let running = 0;
  const points = sorted.map((tx) => {
    running += tx.direction === "in" ? tx.amount : -tx.amount;
    return { date: tx.occurredOn, balance: running };
  });

  const width = 600;
  const height = 200;
  const padX = 44;
  const padY = 22;

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.balance);
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(0, ...ys);
  const yRange = Math.max(1, maxY - minY);
  const xMax = Math.max(1, xs.length - 1);

  const toX = (i: number) => padX + (i / xMax) * (width - padX * 2);
  const toY = (v: number) => height - padY - ((v - minY) / yRange) * (height - padY * 2);
  const zeroY = toY(0);

  if (points.length === 1) {
    points.unshift({ date: points[0].date, balance: 0 });
  }

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.balance).toFixed(1)}`)
    .join(" ");

  const areaPath =
    `M ${toX(0).toFixed(1)} ${zeroY.toFixed(1)} ` +
    points.map((p, i) => `L ${toX(i).toFixed(1)} ${toY(p.balance).toFixed(1)}`).join(" ") +
    ` L ${toX(points.length - 1).toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const last = points[points.length - 1];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-navy-900 dark:text-navy-50">Saldo over tijd</h3>
          <p className="text-xs text-navy-400 dark:text-navy-300">Cumulatief verloop</p>
        </div>
        <span className="text-base font-bold text-navy-900 dark:text-navy-50">
          {formatEuro(last.balance)}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full text-teal-500">
        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          className="stroke-navy-100 dark:stroke-navy-700"
          stroke="currentColor"
          strokeDasharray="4 4"
        />
        <path d={areaPath} className="fill-teal-500/15" />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(p.balance)}
            r={3.5}
            className="fill-white dark:fill-navy-900"
            stroke="currentColor"
            strokeWidth="2"
          />
        ))}
        <text x={padX} y={height - 4} className="fill-navy-300 text-[10px] dark:fill-navy-400">
          {points[0].date}
        </text>
        <text
          x={width - padX}
          y={height - 4}
          textAnchor="end"
          className="fill-navy-300 text-[10px] dark:fill-navy-400"
        >
          {last.date}
        </text>
        <text x={4} y={padY + 8} className="fill-navy-300 text-[10px] dark:fill-navy-400">
          {formatEuro(maxY)}
        </text>
        {minY < 0 && (
          <text x={4} y={height - padY} className="fill-navy-300 text-[10px] dark:fill-navy-400">
            {formatEuro(minY)}
          </text>
        )}
      </svg>
    </div>
  );
}
