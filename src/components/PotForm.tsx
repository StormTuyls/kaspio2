import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Member, Pot } from "../types";

type Props = {
  initial?: Pot;
  members: Member[];
  onSubmit: (values: { name: string; ownerId: string; targetAmount?: number }) => void;
  onCancel: () => void;
};

export function PotForm({ initial, members, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? members[0]?.id ?? "");
  const [target, setTarget] = useState(initial?.targetAmount?.toString() ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !ownerId) return;
    const targetAmount = target ? Number(target) : undefined;
    onSubmit({
      name: name.trim(),
      ownerId,
      targetAmount: Number.isFinite(targetAmount) && targetAmount! > 0 ? targetAmount : undefined,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Naam van het potje" required>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Tournee 2026"
          className="input"
          required
        />
      </Field>
      <Field label="Verantwoordelijke" required>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="input"
          required
        >
          {members.length === 0 && <option value="">Geen leden — voeg eerst iemand toe</option>}
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.role === "admin" ? "(Admin)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Doelbedrag (optioneel)">
        <input
          type="number"
          step="0.01"
          min="0"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0,00"
          className="input"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Annuleren
        </button>
        <button type="submit" className="btn-primary" disabled={!ownerId}>
          {initial ? "Opslaan" : "Potje aanmaken"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
