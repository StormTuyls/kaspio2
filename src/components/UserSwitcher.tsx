import type { Member } from "../types";

type Props = {
  members: Member[];
  currentUserId: string | null;
  onChange: (id: string) => void;
};

export function UserSwitcher({ members, currentUserId, onChange }: Props) {
  if (members.length === 0) return null;
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="hidden text-ink-600 dark:text-ink-500 sm:inline">Bekijk als</span>
      <select
        value={currentUserId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[160px] truncate rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-900 shadow-sm focus:border-ink-300 focus:outline-none focus:ring-4 focus:ring-ink-100 sm:max-w-none sm:px-3 sm:text-sm dark:border-ink-800 dark:bg-ink-900 dark:text-ink-100 dark:focus:ring-ink-500/20"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · {m.role === "admin" ? "Admin" : "Beheerder"}
          </option>
        ))}
      </select>
    </label>
  );
}
