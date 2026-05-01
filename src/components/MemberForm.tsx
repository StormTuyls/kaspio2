import { useState } from "react";
import type { FormEvent } from "react";
import type { Member, Role } from "../types";

type Props = {
  initial?: Member;
  onSubmit: (values: { name: string; role: Role }) => void;
  onCancel: () => void;
};

export function MemberForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState<Role>(initial?.role ?? "pot_owner");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), role });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Naam *</span>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Marie Peeters"
          className="input"
          required
        />
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium text-gray-700">Rol *</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole("pot_owner")}
            className={`rounded-lg border-2 p-3 text-left transition ${
              role === "pot_owner"
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-sm font-semibold text-gray-900">Potjesbeheerder</div>
            <div className="text-xs text-gray-500">Ziet enkel eigen potje(s)</div>
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`rounded-lg border-2 p-3 text-left transition ${
              role === "admin"
                ? "border-indigo-500 bg-indigo-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="text-sm font-semibold text-gray-900">Admin</div>
            <div className="text-xs text-gray-500">Ziet alles, beheert leden</div>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" className="btn-primary">
          {initial ? "Opslaan" : "Lid toevoegen"}
        </button>
      </div>
    </form>
  );
}
