import { useState } from "react";
import type { FormEvent } from "react";
import { Mark } from "../components/Logo";
import { signOut, supabase } from "../supabase";

type Props = {
  userId: string;
  fullName: string;
  onCreated: () => void;
};

/**
 * Toont wanneer een ingelogde user nog geen organisatie heeft.
 * Kan gebeuren als:
 *   - Signup-flow geïnterrumpeerd is (geen org aangemaakt)
 *   - User uit een oude staat zonder org
 *   - Iemand handmatig was toegevoegd zonder membership
 */
export function OrgOnboardingView({ userId, fullName, onCreated }: Props) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Geef je organisatie een naam.");
      return;
    }
    setBusy(true);
    const orgInsert = { name: trimmed, owner_id: userId };
    const { error: err } = await supabase
      .from("organisations")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(orgInsert as any);
    setBusy(false);
    if (err) {
      setError(`Kon organisatie niet aanmaken: ${err.message}`);
      return;
    }
    onCreated();
  }

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
          <h1 className="mb-2 text-xl font-bold text-navy-900 dark:text-white">
            Welkom {fullName.split(" ")[0]}!
          </h1>
          <p className="mb-6 text-sm text-navy-500 dark:text-navy-300">
            Voor je begint, maak je eerste organisatie aan. Dat is de container
            voor je potjes en transacties. Je kunt er later leden bijuitnodigen.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
                Naam van je organisatie
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
              <span className="mt-1 block text-xs text-navy-400 dark:text-navy-300">
                Kan altijd later worden aangepast in de instellingen.
              </span>
            </label>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-accent w-full"
            >
              {busy ? "Bezig…" : "Organisatie aanmaken"}
            </button>
          </form>
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
