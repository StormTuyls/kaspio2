import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { login, signup } from "../auth";
import type { UserAccount } from "../auth";

type Mode = "login" | "signup";

type Props = {
  initialMode: Mode;
  onAuth: (account: UserAccount) => void;
  onBack: () => void;
};

export function AuthView({ initialMode, onAuth, onBack }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 self-start text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          ← Terug
        </button>

        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">Potjesbeheer</span>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setMode("login")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                mode === "login" ? "bg-white text-gray-900 shadow" : "text-gray-500"
              }`}
            >
              Inloggen
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                mode === "signup" ? "bg-white text-gray-900 shadow" : "text-gray-500"
              }`}
            >
              Aanmelden
            </button>
          </div>

          {mode === "login" ? <LoginForm onAuth={onAuth} /> : <SignupForm onAuth={onAuth} />}
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Tijdens de bèta worden je gegevens lokaal in je browser opgeslagen.
        </p>
      </div>
    </div>
  );
}

function LoginForm({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const account = await login(email, password);
      onAuth(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Welkom terug</h2>
      <Field label="E-mailadres">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input"
        />
      </Field>
      <Field label="Wachtwoord">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="input"
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Bezig…" : "Inloggen"}
      </button>
    </form>
  );
}

function SignupForm({ onAuth }: { onAuth: (a: UserAccount) => void }) {
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const account = await signup({ fullName, organizationName, email, password });
      onAuth(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Maak je organisatie aan</h2>
      <Field label="Jouw naam">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Bijv. Jan Janssens"
          className="input"
        />
      </Field>
      <Field label="Organisatie">
        <input
          type="text"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
          placeholder="Bijv. Tournee Productions"
          className="input"
        />
      </Field>
      <Field label="E-mailadres">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input"
        />
      </Field>
      <Field label="Wachtwoord" hint="Minstens 6 tekens">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="input"
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Bezig…" : "Account aanmaken"}
      </button>
      <p className="text-center text-xs text-gray-500">
        Door verder te gaan ga je akkoord met onze (denkbeeldige) voorwaarden.
      </p>
    </form>
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
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
