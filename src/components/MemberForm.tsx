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
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">Naam *</span>
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
        <span className="mb-2 block text-sm font-medium text-navy-700 dark:text-navy-200">Rol *</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole("pot_owner")}
            className={`rounded-xl border-2 p-3 text-left transition ${
              role === "pot_owner"
                ? "border-mint-500 bg-mint-50 dark:bg-mint-900/20"
                : "border-navy-100 hover:border-navy-200 dark:border-navy-700 dark:hover:border-navy-600"
            }`}
          >
            <div className="text-sm font-semibold text-navy-900 dark:text-navy-50">Potjesbeheerder</div>
            <div className="text-xs text-navy-500 dark:text-navy-300">Ziet enkel eigen potje(s)</div>
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`rounded-xl border-2 p-3 text-left transition ${
              role === "admin"
                ? "border-mint-500 bg-mint-50 dark:bg-mint-900/20"
                : "border-navy-100 hover:border-navy-200 dark:border-navy-700 dark:hover:border-navy-600"
            }`}
          >
            <div className="text-sm font-semibold text-navy-900 dark:text-navy-50">Admin</div>
            <div className="text-xs text-navy-500 dark:text-navy-300">Ziet alles, beheert leden</div>
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" className="btn-accent">
          {initial ? "Opslaan" : "Lid toevoegen"}
        </button>
      </div>
    </form>
  );
}
