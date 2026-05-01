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
  const height = 180;
  const padX = 40;
  const padY = 20;

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
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Saldo over tijd</h3>
        <span className="text-sm text-gray-500">{formatEuro(last.balance)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="#e5e7eb"
          strokeDasharray="4 4"
        />
        <path d={areaPath} fill="rgb(16 185 129 / 0.12)" />
        <path d={path} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.balance)} r={3} fill="#10b981" />
        ))}
        <text x={padX} y={height - 4} className="fill-gray-400 text-[10px]">
          {points[0].date}
        </text>
        <text
          x={width - padX}
          y={height - 4}
          textAnchor="end"
          className="fill-gray-400 text-[10px]"
        >
          {last.date}
        </text>
        <text x={4} y={padY + 8} className="fill-gray-400 text-[10px]">
          {formatEuro(maxY)}
        </text>
        {minY < 0 && (
          <text x={4} y={height - padY} className="fill-gray-400 text-[10px]">
            {formatEuro(minY)}
          </text>
        )}
      </svg>
    </div>
  );
}
