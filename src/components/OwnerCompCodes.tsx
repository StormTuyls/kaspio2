import { useState } from "react";
import { createCompCode } from "../data";

/**
 * Owner-only paneel: genereer een gratis Pro/Team-testcode + deelbare link.
 * Alleen zichtbaar voor platform-admins (de app-eigenaar). De link
 * https://.../?comp=CODE tilt de org van wie 'm inwisselt naar het gekozen tier.
 */
export function OwnerCompCodes() {
  const [tier, setTier] = useState<"pro" | "team">("pro");
  const [max, setMax] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = code ? `${window.location.origin}/?comp=${code}` : "";

  async function generate() {
    setBusy(true);
    setError(null);
    setCode(null);
    setCopied(false);
    const res = await createCompCode(tier, Math.max(1, max), note.trim() || null);
    setBusy(false);
    if (res.error || !res.code) {
      setError(res.error ?? "Genereren mislukt");
      return;
    }
    setCode(res.code);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiëren mislukt , selecteer de link handmatig.");
    }
  }

  return (
    <div className="card border-amber-200 p-6 dark:border-amber-900/40">
      <div className="mb-1 flex items-center gap-2">
        <span className="badge-amber">Owner</span>
        <h2 className="text-base font-semibold text-navy-900 dark:text-navy-50">
          Test-/promocodes
        </h2>
      </div>
      <p className="mb-4 text-sm text-navy-500 dark:text-navy-300">
        Genereer een link die de organisatie van wie 'm inwisselt gratis naar Pro
        of Team tilt. Voor testers en demo's. Enkel jij ziet dit.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
            Tier
          </span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as "pro" | "team")}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
          >
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
            Max. keer inwisselen
          </span>
          <input
            type="number"
            min={1}
            value={max}
            onChange={(e) => setMax(Number(e.target.value))}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
            Notitie (optioneel)
          </span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="bv. beta-testers"
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
          />
        </label>
      </div>

      <button onClick={generate} disabled={busy} className="btn-accent mt-4 text-sm disabled:opacity-50">
        {busy ? "Bezig…" : "Genereer link"}
      </button>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {code && (
        <div className="mt-4 rounded-xl border border-navy-100 bg-canvas p-3 dark:border-navy-700/60 dark:bg-navy-800/40">
          <p className="mb-2 text-xs font-medium text-navy-500 dark:text-navy-300">
            Deelbare link ({tier === "pro" ? "Pro" : "Team"}):
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-lg border border-navy-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-navy-700 dark:bg-navy-900 dark:text-navy-50"
            />
            <button onClick={copy} className="btn-secondary text-sm">
              {copied ? "Gekopieerd" : "Kopieer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
