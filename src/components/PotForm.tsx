import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { PotGroup } from "../types";

// Kaspio kleurpalet — eerste optie is de primary teal.
const POT_COLORS = [
  { hex: "#1D9E75", label: "Teal" },
  { hex: "#0F6E56", label: "Donker teal" },
  { hex: "#EF9F27", label: "Amber" },
  { hex: "#2289F5", label: "Blauw" },
  { hex: "#8B5CF6", label: "Paars" },
  { hex: "#EC4899", label: "Roze" },
  { hex: "#F43F5E", label: "Rood" },
  { hex: "#84CC16", label: "Limoen" },
];

/** Sentinel voor de inline "nieuwe groep"-flow in de dropdown. */
const NEW_GROUP = "__new__";

export type PotFormValues = {
  name: string;
  color: string;
  targetAmount?: number;
  description?: string;
  groupId?: string | null;
};

type Props = {
  initial?: {
    name: string;
    color: string;
    targetAmount?: number;
    description?: string;
    groupId?: string | null;
  };
  onSubmit: (values: PotFormValues) => void | Promise<void>;
  onCancel: () => void;
  /** Bestaande potgroepen (takken/ploegen). Leeg = veld blijft tonen, voor de eerste groep. */
  groups?: PotGroup[];
  /** Maak een nieuwe groep aan; nodig voor de inline "+ Nieuwe groep" optie. */
  onCreateGroup?: (
    name: string,
  ) => Promise<{ error: string | null; groupId?: string }>;
};

export function PotForm({ initial, onSubmit, onCancel, groups, onCreateGroup }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? POT_COLORS[0].hex);
  const [target, setTarget] = useState(
    initial?.targetAmount?.toString() ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [groupId, setGroupId] = useState<string>(initial?.groupId ?? "");
  const [newGroupName, setNewGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showGroupField = groups !== undefined && onCreateGroup !== undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Geef het potje een naam.");
      return;
    }
    if (trimmed.length > 80) {
      setError("Naam is te lang (max 80 tekens).");
      return;
    }
    let targetAmount: number | undefined;
    if (target.trim()) {
      const v = Number(target);
      if (!Number.isFinite(v) || v <= 0) {
        setError("Doelbedrag moet een positief getal zijn.");
        return;
      }
      targetAmount = v;
    }
    setBusy(true);
    try {
      // Inline nieuwe groep aanmaken indien gekozen
      let finalGroupId: string | null = groupId || null;
      if (groupId === NEW_GROUP) {
        const groupName = newGroupName.trim();
        if (!groupName) {
          setError("Geef de nieuwe groep een naam.");
          setBusy(false);
          return;
        }
        const res = await onCreateGroup!(groupName);
        if (res.error || !res.groupId) {
          setError(res.error ?? "Groep aanmaken mislukt.");
          setBusy(false);
          return;
        }
        finalGroupId = res.groupId;
      }

      await onSubmit({
        name: trimmed,
        color,
        targetAmount,
        description: description.trim() || undefined,
        ...(showGroupField ? { groupId: finalGroupId } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Iets ging mis.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Naam van het potje" required>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Kamp 2026"
          maxLength={80}
          className="input"
          required
        />
      </Field>

      <Field label="Kleur">
        <div className="flex flex-wrap gap-2">
          {POT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setColor(c.hex)}
              aria-label={c.label}
              aria-pressed={color === c.hex}
              className={`relative h-9 w-9 rounded-full transition ${
                color === c.hex
                  ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-navy-900"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && (
                <span
                  className="absolute inset-0 flex items-center justify-center text-white"
                  aria-hidden
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </Field>

      {showGroupField && (
        <Field
          label="Groep"
          hint="Optioneel — bv. een tak, ploeg of werkgroep. Potjes in dezelfde groep staan samen in het overzicht."
        >
          <div className="space-y-2">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="input"
            >
              <option value="">Geen groep</option>
              {groups!.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value={NEW_GROUP}>+ Nieuwe groep…</option>
            </select>
            {groupId === NEW_GROUP && (
              <input
                autoFocus
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Bijv. Welpen, U12, Werkgroep Kerst"
                maxLength={80}
                className="input"
              />
            )}
          </div>
        </Field>
      )}

      <Field label="Doelbedrag" hint="Optioneel — bv. €500 voor het kamp">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-400">
            €
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="0,00"
            className="input pl-7"
          />
        </div>
      </Field>

      <Field label="Beschrijving" hint="Optioneel — wat is het doel van dit potje?">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Bijv. Inkomsten en uitgaven voor het zomer kamp"
          rows={2}
          className="input resize-none"
          maxLength={500}
        />
      </Field>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={busy}
        >
          Annuleren
        </button>
        <button type="submit" className="btn-accent" disabled={busy}>
          {busy ? "Bezig…" : initial ? "Opslaan" : "Potje aanmaken"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-navy-400 dark:text-navy-300">
          {hint}
        </span>
      )}
    </label>
  );
}
