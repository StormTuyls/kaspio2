import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Mark } from "../components/Logo";
import {
  SUPABASE_CONFIGURED,
  resetPasswordForEmail,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  supabase,
} from "../supabase";

type Mode = "login" | "signup";
type LoginMethod = "password" | "magic";

export type AuthError = {
  kind: "expired" | "invalid" | "other";
  description: string;
};

type Props = {
  initialMode: Mode;
  authError?: AuthError | null;
  onAuth: () => void;
  onBack: () => void;
  onDismissError?: () => void;
};

export function AuthView({
  initialMode,
  authError,
  onAuth,
  onBack,
  onDismissError,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="min-h-screen bg-canvas dark:bg-navy-950">
      <div className="grid min-h-screen lg:grid-cols-2">
        <SidePanel />
        <div className="flex flex-col px-6 py-8 lg:px-14">
          <button
            onClick={onBack}
            className="mb-8 flex items-center gap-2 self-start text-sm font-medium text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
          >
            ← Terug
          </button>

          <div className="mx-auto w-full max-w-md flex-1">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <Mark size={36} />
              <span className="text-lg font-bold text-navy-900 dark:text-white">
                Kaspio
              </span>
            </div>

            <div className="card p-7">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-canvas p-1 dark:bg-navy-800">
                <button
                  onClick={() => setMode("login")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                      : "text-navy-500 dark:text-navy-300"
                  }`}
                >
                  Inloggen
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
                      : "text-navy-500 dark:text-navy-300"
                  }`}
                >
                  Aanmelden
                </button>
              </div>

              {!SUPABASE_CONFIGURED && <ConfigWarning />}

              {authError && (
                <AuthErrorBanner error={authError} onDismiss={onDismissError} />
              )}

              {mode === "login" ? (
                <LoginForm
                  onAuth={onAuth}
                  startInForgotMode={authError?.kind === "expired"}
                />
              ) : (
                <SignupForm onAuth={onAuth} />
              )}
            </div>

            <p className="mt-6 text-center text-xs text-navy-400">
              Bèta. We zijn voorzichtig met je gegevens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthErrorBanner({
  error,
  onDismiss,
}: {
  error: AuthError;
  onDismiss?: () => void;
}) {
  const title =
    error.kind === "expired"
      ? "Link is verlopen"
      : error.kind === "invalid"
        ? "Link is ongeldig"
        : "Er ging iets mis";
  const message =
    error.kind === "expired"
      ? "Reset-links zijn één uur geldig en maar één keer bruikbaar. Vraag hieronder een nieuwe aan."
      : error.kind === "invalid"
        ? "Deze link is niet meer geldig. Vraag een nieuwe aan via 'Wachtwoord vergeten'."
        : error.description || "Probeer opnieuw of vraag een nieuwe link aan.";

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
      <div className="mb-1 flex items-start justify-between gap-2">
        <strong>{title}</strong>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-amber-600 hover:text-amber-800"
            aria-label="Sluit melding"
          >
            ×
          </button>
        )}
      </div>
      <p>{message}</p>
    </div>
  );
}

function ConfigWarning() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <strong>Supabase niet geconfigureerd.</strong> Voeg{" "}
      <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> en{" "}
      <code className="rounded bg-amber-100 px-1">
        VITE_SUPABASE_PUBLISHABLE_KEY
      </code>{" "}
      toe aan <code className="rounded bg-amber-100 px-1">.env.local</code>.
    </div>
  );
}

function SidePanel() {
  return (
    <div className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_30%_20%,rgba(47,191,113,0.25),transparent_60%),radial-gradient(50%_40%_at_80%_80%,rgba(77,163,255,0.25),transparent_60%)]" />
      <div className="relative flex items-center gap-2.5">
        <Mark size={36} variant="light" />
        <span className="text-lg font-bold">Kaspio</span>
      </div>
      <div className="relative mt-auto">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-mint-300">
          Build in public
        </p>
        <h2 className="mb-6 text-3xl font-bold leading-tight">
          Eén bankrekening,
          <br />
          meerdere virtuele potjes,
          <br />
          volledige transparantie.
        </h2>
        <p className="text-sm text-navy-200">
          Voor scouts, sportclubs, VZW's, artiestenbureaus en iedereen die met
          gedeelde geldstromen werkt.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// LOGIN FORM
// =============================================================================

function LoginForm({
  onAuth,
  startInForgotMode = false,
}: {
  onAuth: () => void;
  startInForgotMode?: boolean;
}) {
  const [method, setMethod] = useState<LoginMethod>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "busy" | "magic-sent" | "reset-sent"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(startInForgotMode);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("busy");
    try {
      if (forgotMode) {
        const { error: err } = await resetPasswordForEmail(email);
        if (err) throw err;
        setStatus("reset-sent");
      } else if (method === "magic") {
        const { error: err } = await signInWithMagicLink(email);
        if (err) throw err;
        setStatus("magic-sent");
      } else {
        const { error: err } = await signInWithPassword(email, password);
        if (err) throw err;
        onAuth();
      }
    } catch (err) {
      setStatus("idle");
      setError(translateError(err));
    }
  }

  if (status === "magic-sent") {
    return (
      <div className="rounded-lg border border-mint-200 bg-mint-50 px-4 py-5 text-sm text-mint-800">
        <div className="mb-1 font-semibold">Check je mailbox.</div>
        We stuurden een inlog-link naar <strong>{email}</strong>. Klik die en
        je bent ingelogd.
      </div>
    );
  }

  if (status === "reset-sent") {
    return (
      <div className="rounded-lg border border-mint-200 bg-mint-50 px-4 py-5 text-sm text-mint-800">
        <div className="mb-1 font-semibold">Check je mailbox.</div>
        We stuurden een reset-link naar <strong>{email}</strong>. Klik die en
        je kunt een nieuw wachtwoord instellen.
      </div>
    );
  }

  if (forgotMode) {
    return (
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
          Wachtwoord vergeten
        </h2>
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Vul je e-mailadres in, we sturen je een reset-link.
        </p>

        <Field label="E-mailadres">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            autoFocus
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          type="submit"
          disabled={status === "busy" || !SUPABASE_CONFIGURED}
          className="btn-accent w-full"
        >
          {status === "busy" ? "Bezig…" : "Stuur reset-link"}
        </button>

        <button
          type="button"
          onClick={() => {
            setForgotMode(false);
            setError(null);
          }}
          className="block w-full text-center text-xs text-navy-400 hover:text-navy-700 dark:hover:text-navy-100"
        >
          ← Terug naar inloggen
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-navy-900 dark:text-white">
        Welkom terug
      </h2>

      <MethodToggle method={method} onChange={setMethod} />

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

      {method === "password" && (
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
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <button
        type="submit"
        disabled={status === "busy" || !SUPABASE_CONFIGURED}
        className="btn-accent w-full"
      >
        {status === "busy"
          ? "Bezig…"
          : method === "magic"
            ? "Stuur inlog-link"
            : "Inloggen"}
      </button>

      {method === "password" && (
        <button
          type="button"
          onClick={() => {
            setForgotMode(true);
            setError(null);
            setPassword("");
          }}
          className="block w-full text-center text-xs text-navy-400 hover:text-navy-700 dark:hover:text-navy-100"
        >
          Wachtwoord vergeten?
        </button>
      )}
    </form>
  );
}

function MethodToggle({
  method,
  onChange,
}: {
  method: LoginMethod;
  onChange: (m: LoginMethod) => void;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <button
        type="button"
        onClick={() => onChange("password")}
        className={`rounded-md px-2.5 py-1 font-semibold transition ${
          method === "password"
            ? "bg-mint-100 text-mint-800"
            : "text-navy-500 hover:bg-navy-50"
        }`}
      >
        Wachtwoord
      </button>
      <button
        type="button"
        onClick={() => onChange("magic")}
        className={`rounded-md px-2.5 py-1 font-semibold transition ${
          method === "magic"
            ? "bg-mint-100 text-mint-800"
            : "text-navy-500 hover:bg-navy-50"
        }`}
      >
        Magic link
      </button>
    </div>
  );
}

// =============================================================================
// SIGNUP FORM
// =============================================================================

function SignupForm({ onAuth }: { onAuth: () => void }) {
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "confirm-needed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("busy");
    try {
      // Step 1: validate + consume invite code atomically
      const { data: inviteResult, error: inviteErr } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "consume_invite" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { p_code: inviteCode.trim().toUpperCase(), p_email: email.trim() } as any,
      );
      if (inviteErr) throw inviteErr;
      const inviteStatus = inviteResult as string;
      if (inviteStatus !== "ok") {
        setStatus("idle");
        setError(translateInviteError(inviteStatus));
        return;
      }

      // Step 2: create the Supabase Auth user
      const { data, error: err } = await signUpWithPassword(
        email,
        password,
        fullName,
      );
      if (err) throw err;

      // Step 3: if session exists immediately (no email confirm required),
      // create the organisation. RLS trigger auto-adds owner as admin.
      if (data.session) {
        const orgInsert = {
          name: organizationName,
          owner_id: data.session.user.id,
        };
        const { error: orgErr } = await supabase
          .from("organisations")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(orgInsert as any);
        if (orgErr) throw orgErr;
        onAuth();
      } else {
        // Email confirmation required: org is created on first login (App.tsx handles)
        sessionStorage.setItem("kaspio.pending_org_name", organizationName);
        setStatus("confirm-needed");
      }
    } catch (err) {
      setStatus("idle");
      setError(translateError(err));
    }
  }

  if (status === "confirm-needed") {
    return (
      <div className="rounded-lg border border-mint-200 bg-mint-50 px-4 py-5 text-sm text-mint-800">
        <div className="mb-1 font-semibold">Bevestig je e-mailadres.</div>
        We stuurden een bevestigingslink naar <strong>{email}</strong>. Klik
        die en je bent ingelogd. Daarna maken we automatisch{" "}
        <strong>{organizationName}</strong> aan.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold text-navy-900 dark:text-white">
        Maak je organisatie aan
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Jouw naam">
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Storm Tuyls"
            className="input"
          />
        </Field>
        <Field label="Organisatie">
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
            placeholder="Scouts Berchem"
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
      <Field label="Wachtwoord" hint="Minstens 8 tekens">
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="input"
        />
      </Field>
      <Field
        label="Invite code"
        hint="Geen code? Schrijf je in op de wachtlijst."
      >
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          required
          placeholder="KASP-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="input font-mono uppercase tracking-wider"
        />
      </Field>
      {error && <ErrorBox>{error}</ErrorBox>}
      <button
        type="submit"
        disabled={status === "busy" || !SUPABASE_CONFIGURED}
        className="btn-accent w-full"
      >
        {status === "busy" ? "Bezig…" : "Account aanmaken"}
      </button>
      <p className="text-center text-xs text-navy-400">
        Door verder te gaan ga je akkoord met onze (denkbeeldige) voorwaarden.
      </p>
    </form>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

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

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {children}
    </div>
  );
}

function translateInviteError(status: string): string {
  switch (status) {
    case "not_found":
      return "Onbekende invite code. Check je mail of vraag een nieuwe aan.";
    case "expired":
      return "Deze invite code is verlopen.";
    case "exhausted":
      return "Deze invite code is al gebruikt.";
    case "email_mismatch":
      return "Deze invite code is gekoppeld aan een ander e-mailadres.";
    default:
      return `Invite code probleem: ${status}`;
  }
}

function translateError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Supabase Auth meest voorkomende errors → NL
  if (raw.includes("Invalid login credentials"))
    return "Onjuist e-mailadres of wachtwoord.";
  if (raw.includes("Email not confirmed"))
    return "Bevestig eerst je e-mailadres via de link in je inbox.";
  if (raw.includes("User already registered"))
    return "Dit e-mailadres heeft al een account. Probeer in te loggen.";
  if (raw.includes("Password should be at least"))
    return "Wachtwoord moet minstens 8 tekens zijn.";
  if (raw.toLowerCase().includes("rate limit"))
    return "Te veel pogingen. Wacht even en probeer opnieuw.";
  return raw;
}
