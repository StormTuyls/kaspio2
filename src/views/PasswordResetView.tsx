import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Mark } from "../components/Logo";
import { signOut, updateUserPassword } from "../supabase";

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
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 dark:bg-navy-950">
        <div className="card max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-mint-100 text-2xl text-mint-700">
            ✓
          </div>
          <h1 className="mb-2 text-xl font-bold text-navy-900 dark:text-white">
            Wachtwoord aangepast
          </h1>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            Je wordt zo doorgestuurd naar de app.
          </p>
        </div>
      </div>
    );
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
            Stel een nieuw wachtwoord in
          </h1>
          <p className="mb-6 text-sm text-navy-500 dark:text-navy-300">
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
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
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
              className="block w-full text-center text-xs text-navy-400 hover:text-navy-700 dark:hover:text-navy-100"
            >
              Annuleren en uitloggen
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
        {label}
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
