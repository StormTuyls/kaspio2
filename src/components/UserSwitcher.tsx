import type { Member } from "../types";

type Props = {
  members: Member[];
  currentUserId: string | null;
  onChange: (id: string) => void;
};

export function UserSwitcher({ members, currentUserId, onChange }: Props) {
  if (members.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-navy-400 sm:inline">Bekijk als</span>
      <select
        value={currentUserId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-navy-100 bg-white px-3 py-1.5 text-sm font-semibold text-navy-900 shadow-sm focus:border-azure-400 focus:outline-none focus:ring-4 focus:ring-azure-100"
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
