import { useState } from "react";
import type { FormEvent } from "react";

type Props = {
  /** Wordt aangeroepen met de naam, parent regelt de daadwerkelijke insert. */
  onCreate: (name: string) => Promise<{ error: string | null }>;
  onCancel?: () => void;
  /** Tekst boven het form, default voor onboarding-context. */
  title?: string;
  description?: string;
  submitLabel?: string;
  /** Voor-ingevulde naam (bv. "Persoonlijk" voor solo-gebruikers). */
  defaultName?: string;
};

/**
 * Form-component om een nieuwe organisatie aan te maken. Gebruikt zowel in
 * het onboarding-scherm (eerste org) als in een modal (extra org toevoegen).
 */
export function CreateOrgForm({
  onCreate,
  onCancel,
  title = "Maak een organisatie aan",
  description = "Container voor je potjes en transacties. Je kunt er later leden bij uitnodigen.",
  submitLabel = "Organisatie aanmaken",
  defaultName = "",
}: Props) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Geef de organisatie een naam.");
      return;
    }
    setBusy(true);
    const res = await onCreate(trimmed);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setName("");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="mb-1 text-lg font-bold text-ink-900 dark:text-white">
          {title}
        </h2>
        <p className="text-sm text-ink-700 dark:text-ink-500">{description}</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
          Naam
        </span>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Scouts Berchem"
          maxLength={120}
          required
          className="input"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary"
          >
            Annuleren
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="btn-accent flex-1"
        >
          {busy ? "Bezig…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
