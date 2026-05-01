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
      <span className="hidden text-gray-500 sm:inline">Ingelogd als:</span>
      <select
        value={currentUserId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.role === "admin" ? "Admin" : "Beheerder"})
          </option>
        ))}
      </select>
    </label>
  );
}
