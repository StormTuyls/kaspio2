import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { PotGroup, PotTargetKind } from "../types";
import { rootGroups, subGroups } from "../storage";

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
  /** Bijgestelde verwachting. undefined = geen prognose, dan geldt het budget. */
  forecastAmount?: number | null;
  targetKind: PotTargetKind;
  description?: string;
  groupId?: string | null;
};

type Props = {
  initial?: {
    name: string;
    color: string;
    targetAmount?: number;
    forecastAmount?: number;
    targetKind?: PotTargetKind;
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
  const [forecast, setForecast] = useState(
    initial?.forecastAmount?.toString() ?? "",
  );
  const [targetKind, setTargetKind] = useState<PotTargetKind>(
    initial?.targetKind ?? "saving",
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
      if (!Number.isFinite(v)) {
        setError("Vul een geldig bedrag in.");
        return;
      }
      // 0 betekent hetzelfde als een leeg veld, dus dat weigeren we liever dan
      // stil een doel op te slaan dat nergens getoond wordt.
      if (v === 0) {
        setError("Laat het veld leeg als dit potje geen doel of budget heeft.");
        return;
      }
      targetAmount = v;
    }
    // Prognose mag leeg blijven; dan is het budget nog steeds het plan. Een
    // prognose zonder budget mag ook: soms weet je wat het gaat worden voor er
    // iets afgesproken is.
    let forecastAmount: number | null = null;
    if (forecast.trim()) {
      const v = Number(forecast);
      if (!Number.isFinite(v)) {
        setError("Vul een geldige prognose in.");
        return;
      }
      forecastAmount = v === 0 ? null : v;
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
        forecastAmount,
        targetKind,
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
          hint="Optioneel. Bv. een tak, ploeg of werkgroep. Potjes in dezelfde groep staan samen in het overzicht. Een nieuwe groep hier wordt altijd een hoofdgroep; verhangen doe je op de groepenpagina."
        >
          <div className="space-y-2">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="input"
            >
              <option value="">Geen groep</option>
              {/* Een hoofdgroep met subgroepen wordt een optgroup met zichzelf
                  bovenaan: een potje mag ook rechtstreeks in de hoofdgroep
                  hangen, en dat moet dus kiesbaar blijven. */}
              {rootGroups(groups!).map((g) => {
                const children = subGroups(groups!, g.id);
                if (children.length === 0) {
                  return (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  );
                }
                return (
                  <optgroup key={g.id} label={g.name}>
                    <option value={g.id}>{g.name} (rechtstreeks)</option>
                    {children.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
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

      <Field
        label="Doel of budget"
        hint={
          targetKind === "budget"
            ? "Optioneel. Het bedrag dat dit potje mag kosten. De balk toont hoeveel daarvan al uitgegeven is."
            : "Optioneel. Het saldo waar dit potje naartoe moet groeien. Een negatief bedrag mag ook, voor een potje dat volgens plan in het rood staat."
        }
      >
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTargetKind("saving")}
              aria-pressed={targetKind === "saving"}
              className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                targetKind === "saving"
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                  : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
              }`}
            >
              Spaardoel
            </button>
            <button
              type="button"
              onClick={() => setTargetKind("budget")}
              aria-pressed={targetKind === "budget"}
              className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                targetKind === "budget"
                  ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
              }`}
            >
              Budget
            </button>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-400">
              €
            </span>
            <input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={targetKind === "budget" ? "500,00" : "0,00"}
              className="input pl-7"
            />
          </div>
        </div>
      </Field>

      <Field
        label="Prognose"
        hint={
          targetKind === "budget"
            ? "Optioneel. Wat je er nu écht denkt uit te geven. Het budget hierboven blijft staan wat het was, zodat je het verschil ziet."
            : "Optioneel. Waar je nu denkt op uit te komen. Het doel hierboven blijft staan wat het was, zodat je het verschil ziet."
        }
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-400">
            €
          </span>
          <input
            type="number"
            step="0.01"
            value={forecast}
            onChange={(e) => setForecast(e.target.value)}
            placeholder="Laat leeg als het budget nog klopt"
            className="input pl-7"
          />
        </div>
      </Field>

      <Field label="Beschrijving" hint="Optioneel. Wat is het doel van dit potje?">
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
