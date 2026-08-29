import { useState } from "react";
import type { FormEvent } from "react";
import { Mark } from "../components/Logo";
import { signOut, updateUserPassword } from "../supabase";

import { Veld as Field } from "../components/Veld";
import { Foutmelding } from "../components/Foutmelding";
type Props = {
  /** Wordt aangeroepen wanneer het wachtwoord succesvol is geüpdatet. */
  onDone: () => void;
};

/**
 * PasswordResetView wordt getoond wanneer de user uit de "reset password"
 * mail terugkomt. Supabase heeft dan een tijdelijke session aangemaakt
 * (event PASSWORD_RECOVERY in onAuthStateChange). Die session kan enkel
 * gebruikt worden om het wachtwoord te updaten.
 */
export function PasswordResetView({ onDone }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Wachtwoord moet minstens 8 tekens zijn.");
      return;
    }
    if (password !== confirm) {
      setError("De twee wachtwoorden komen niet overeen.");
      return;
    }

    setStatus("busy");
    try {
      const { error: err } = await updateUserPassword(password);
      if (err) throw err;
      setStatus("success");
      // Geef de user even tijd om de success-state te zien voor we doorroepen
      setTimeout(() => onDone(), 1500);
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Iets ging mis.");
    }
  }

  async function cancel() {
    await signOut();
    onDone();
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-6 dark:bg-ink-950">
        <div className="card max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-in-100 text-2xl text-in-600">
            ✓
          </div>
          <h1 className="mb-2 text-xl font-bold text-ink-900 dark:text-white">
            Wachtwoord aangepast
          </h1>
          <p className="text-sm text-basis">
            Je wordt zo doorgestuurd naar de app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-6 dark:bg-ink-950">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Mark size={36} />
          <span className="text-lg font-bold text-ink-900 dark:text-white">
            Kaspio
          </span>
        </div>

        <div className="card p-7">
          <h1 className="mb-2 text-xl font-bold text-ink-900 dark:text-white">
            Stel een nieuw wachtwoord in
          </h1>
          <p className="mb-6 text-sm text-basis">
            Kies een sterk wachtwoord. Daarna ben je weer ingelogd.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Nieuw wachtwoord" hint="Minstens 8 tekens">
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="input"
                autoFocus
              />
            </Field>
            <Field label="Bevestig wachtwoord">
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="input"
              />
            </Field>

            {error && (
              <Foutmelding>
                {error}
              </Foutmelding>
            )}

            <button
              type="submit"
              disabled={status === "busy"}
              className="btn-accent w-full"
            >
              {status === "busy" ? "Bezig…" : "Wachtwoord opslaan"}
            </button>

            <button
              type="button"
              onClick={cancel}
              className="block w-full text-center text-xs text-zacht hover:text-ink-800 dark:hover:text-ink-200"
            >
              Annuleren en uitloggen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

