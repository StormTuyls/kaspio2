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
    <div className="min-h-screen bg-canvas">
      <div className="grid min-h-screen lg:grid-cols-2">
        <SidePanel />
        <div className="flex flex-col px-6 py-8 lg:px-14">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-2 self-start text-sm font-medium text-navy-500 hover:text-navy-900"
          >
            ← Terug
          </button>

          <div className="mx-auto w-full max-w-md flex-1">
            <div className="mb-6 flex items-center gap-2 lg:hidden">
              <Mark />
              <span className="text-lg font-bold text-navy-900">Potly</span>
            </div>

            <div className="card p-7">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-canvas p-1">
                <button
                  onClick={() => setMode("login")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "login" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"
                  }`}
                >
                  Inloggen
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "signup" ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"
                  }`}
                >
                  Aanmelden
                </button>
              </div>

              {mode === "login" ? <LoginForm onAuth={onAuth} /> : <SignupForm onAuth={onAuth} />}
            </div>

            <p className="mt-6 text-center text-xs text-navy-400">
              Tijdens de bèta worden je gegevens lokaal in je browser opgeslagen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900">
      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-mint-500 ring-2 ring-white" />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    </span>
  );
}

function SidePanel() {
  return (
    <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_30%_20%,rgba(47,191,113,0.25),transparent_60%),radial-gradient(50%_40%_at_80%_80%,rgba(77,163,255,0.25),transparent_60%)]" />
      <div className="relative flex items-center gap-2">
        <Mark />
        <span className="text-lg font-bold">Potly</span>
      </div>
      <div className="relative mt-auto">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-mint-300">
          Gemaakt voor teams
        </p>
        <h2 className="mb-6 text-3xl font-bold leading-tight">
          “Eindelijk weten we
          <br />
          wat van wie is — zonder
          <br />
          spreadsheet-chaos.”
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint-500/20 text-base font-semibold">
            JV
          </div>
          <div>
            <div className="text-sm font-semibold">Jelle Vandeweerd</div>
            <div className="text-xs text-navy-200">Penningmeester, KSA Tielt</div>
          </div>
        </div>
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
      <h2 className="text-xl font-bold text-navy-900">Welkom terug</h2>
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
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-accent w-full">
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
      <h2 className="text-xl font-bold text-navy-900">Maak je organisatie aan</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Jouw naam">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Jan Janssens"
            className="input"
          />
        </Field>
        <Field label="Organisatie">
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
            placeholder="Tournee Productions"
            className="input"
          />
        </Field>
      </div>
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
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-accent w-full">
        {busy ? "Bezig…" : "Account aanmaken"}
      </button>
      <p className="text-center text-xs text-navy-400">
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
      <span className="mb-1.5 block text-sm font-medium text-navy-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  );
}
