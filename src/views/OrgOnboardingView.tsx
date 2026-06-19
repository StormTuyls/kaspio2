import { useState } from "react";
import type { FormEvent } from "react";
import { Mark } from "../components/Logo";
import { CreateOrgForm } from "../components/CreateOrgForm";
import { signOut } from "../supabase";

type Props = {
  fullName: string;
  onCreate: (name: string) => Promise<{ error: string | null }>;
  /** Lid worden van een bestaande org via een invite-code/-link. */
  onJoinWithCode: (code: string) => Promise<{ error: string | null }>;
};

/**
 * Toont wanneer een ingelogde user nog geen organisatie heeft. Twee keuzes:
 * een nieuwe org aanmaken, of lid worden van een bestaande via een code.
 */
export function OrgOnboardingView({ fullName, onCreate, onJoinWithCode }: Props) {
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 dark:bg-navy-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Mark size={36} />
          <span className="text-lg font-bold text-navy-900 dark:text-white">
            Kaspio
          </span>
        </div>

        <div className="card p-7">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-canvas p-1 dark:bg-navy-800">
            <button
              onClick={() => setMode("create")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                mode === "create"
                  ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                  : "text-navy-500 dark:text-navy-300"
              }`}
            >
              Nieuwe organisatie
            </button>
            <button
              onClick={() => setMode("join")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                mode === "join"
                  ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                  : "text-navy-500 dark:text-navy-300"
              }`}
            >
              Lid worden met code
            </button>
          </div>

          {mode === "create" ? (
            <CreateOrgForm
              title={`Welkom ${fullName.split(" ")[0]}!`}
              description="Maak je eerste organisatie aan. Je kunt er later leden bij uitnodigen of een tweede organisatie maken."
              onCreate={onCreate}
            />
          ) : (
            <JoinOrgForm onJoin={onJoinWithCode} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-navy-400">
          Liever uitloggen?{" "}
          <button
            onClick={() => signOut()}
            className="font-medium text-navy-700 hover:underline dark:text-navy-200"
          >
            Klik hier
          </button>
        </p>
      </div>
    </div>
  );
}

function JoinOrgForm({
  onJoin,
}: {
  onJoin: (code: string) => Promise<{ error: string | null }>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const res = await onJoin(trimmed);
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // Bij succes wordt de org geselecteerd en navigeert de app vanzelf weg.
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-navy-900 dark:text-white">
        Lid worden van een organisatie
      </h2>
      <p className="text-sm text-navy-500 dark:text-navy-300">
        Een uitnodigingscode of -link gekregen van een beheerder? Plak 'm hier
        en je wordt meteen lid.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Uitnodigingscode of -link
        </span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="INV-XXXXXXXX of de volledige link"
          autoComplete="off"
          spellCheck={false}
          className="input font-mono"
        />
      </label>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !code.trim()}
        className="btn-accent w-full"
      >
        {busy ? "Bezig…" : "Word lid"}
      </button>
    </form>
  );
}
