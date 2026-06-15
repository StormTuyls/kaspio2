import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Mark } from "../components/Logo";
import {
  SUPABASE_CONFIGURED,
  resetPasswordForEmail,
  signInWithPassword,
  signUpWithPassword,
  supabase,
} from "../supabase";

type Mode = "login" | "signup";

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
  /** Vooraf ingevuld via invite-link (email + beta-code). */
  prefillEmail?: string;
  prefillCode?: string;
  /** Gezet bij een geldige org-invite-link: naam van de org waar je lid van
   *  wordt. Schakelt de signup over naar "word lid"-modus (geen beta-code). */
  orgInviteName?: string;
};

// Gedeelde class-strings zodat de hele auth-flow dezelfde iris/emerald-look heeft.
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50 dark:placeholder:text-navy-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/25";
const btnPrimary =
  "w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:translate-y-0 disabled:opacity-50";

export function AuthView({
  initialMode,
  authError,
  onAuth,
  onBack,
  onDismissError,
  prefillEmail,
  prefillCode,
  orgInviteName,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 font-display dark:bg-navy-950">
      <div className="relative grid min-h-screen lg:grid-cols-2">
        <SidePanel />

        {/* Form-kolom met subtiele, levende aurora-achtergrond. */}
        <div className="relative flex flex-col overflow-hidden px-6 py-8 lg:px-14">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="aurora-a absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)" }}
            />
            <div
              className="aurora-c absolute -bottom-24 left-1/4 h-72 w-72 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(16,185,129,0.16), transparent 70%)" }}
            />
          </div>

          <button
            onClick={onBack}
            className="relative mb-8 flex items-center gap-2 self-start text-sm font-medium text-slate-500 transition hover:text-indigo-600 dark:text-navy-300 dark:hover:text-white"
          >
            ← Terug
          </button>

          <div className="relative mx-auto w-full max-w-md flex-1">
            <div className="mb-6 flex items-center gap-2.5 lg:hidden">
              <Mark size={36} />
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kaspio
              </span>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-[0_20px_60px_-24px_rgba(49,46,129,0.35)] backdrop-blur-xl dark:border-navy-700/60 dark:bg-navy-900/85">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-navy-800">
                <button
                  onClick={() => setMode("login")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-indigo-700 shadow-sm dark:bg-navy-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-navy-300"
                  }`}
                >
                  Inloggen
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-indigo-700 shadow-sm dark:bg-navy-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-navy-300"
                  }`}
                >
                  Aanmelden
                </button>
              </div>

              {!SUPABASE_CONFIGURED && <ConfigWarning />}

              {authError && (
                <AuthErrorBanner error={authError} onDismiss={onDismissError} />
              )}

              {orgInviteName && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 11h-6M19 8v6" />
                  </svg>
                  <span>
                    Je bent uitgenodigd voor <strong>{orgInviteName}</strong>.
                    {mode === "login"
                      ? " Log in en je wordt automatisch lid."
                      : " Maak je account aan en je wordt automatisch lid."}
                  </span>
                </div>
              )}

              {mode === "login" ? (
                <LoginForm
                  onAuth={onAuth}
                  startInForgotMode={authError?.kind === "expired"}
                />
              ) : (
                <SignupForm
                  onAuth={onAuth}
                  prefillEmail={prefillEmail}
                  prefillCode={prefillCode}
                  orgInviteName={orgInviteName}
                />
              )}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 dark:text-navy-400">
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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
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
    <div
      className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col"
      style={{
        background: "linear-gradient(160deg, #312e81 0%, #1e1b4b 55%, #15132e 100%)",
      }}
    >
      {/* Levende aurora-blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="aurora-a absolute -left-16 top-8 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.55), transparent 70%)" }}
        />
        <div
          className="aurora-b absolute -right-10 top-1/3 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.42), transparent 70%)" }}
        />
        <div
          className="aurora-c absolute -bottom-20 left-1/4 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)" }}
        />
      </div>

      <div className="relative flex items-center gap-2.5">
        <Mark size={36} variant="light" />
        <span className="text-lg font-extrabold tracking-tight">Kaspio</span>
      </div>
      <div className="relative mt-auto">
        <p className="mb-3 font-num text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Build in public
        </p>
        <h2 className="mb-6 text-3xl font-extrabold leading-tight tracking-tight">
          Eén bankrekening,
          <br />
          meerdere virtuele potjes,
          <br />
          volledige transparantie.
        </h2>
        <p className="max-w-sm text-sm text-indigo-200">
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "reset-sent">(
    "idle",
  );
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

  if (status === "reset-sent") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
        <div className="mb-1 font-semibold">Check je mailbox.</div>
        We stuurden een reset-link naar <strong>{email}</strong>. Klik die en
        je kunt een nieuw wachtwoord instellen.
      </div>
    );
  }

  if (forgotMode) {
    return (
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Wachtwoord vergeten
        </h2>
        <p className="text-sm text-slate-500 dark:text-navy-300">
          Vul je e-mailadres in, we sturen je een reset-link.
        </p>

        <Field label="E-mailadres">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputCls}
            autoFocus
          />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          type="submit"
          disabled={status === "busy" || !SUPABASE_CONFIGURED}
          className={btnPrimary}
        >
          {status === "busy" ? "Bezig…" : "Stuur reset-link"}
        </button>

        <button
          type="button"
          onClick={() => {
            setForgotMode(false);
            setError(null);
          }}
          className="block w-full text-center text-xs text-slate-400 transition hover:text-indigo-600 dark:hover:text-navy-100"
        >
          ← Terug naar inloggen
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Welkom terug
      </h2>

      <Field label="E-mailadres">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      <Field label="Wachtwoord">
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputCls}
        />
      </Field>

      {error && <ErrorBox>{error}</ErrorBox>}

      <button
        type="submit"
        disabled={status === "busy" || !SUPABASE_CONFIGURED}
        className={btnPrimary}
      >
        {status === "busy" ? "Bezig…" : "Inloggen"}
      </button>

      <button
        type="button"
        onClick={() => {
          setForgotMode(true);
          setError(null);
          setPassword("");
        }}
        className="block w-full text-center text-xs text-slate-400 transition hover:text-indigo-600 dark:hover:text-navy-100"
      >
        Wachtwoord vergeten?
      </button>
    </form>
  );
}


// =============================================================================
// SIGNUP FORM
// =============================================================================

function SignupForm({
  onAuth,
  prefillEmail,
  prefillCode,
  orgInviteName,
}: {
  onAuth: () => void;
  prefillEmail?: string;
  prefillCode?: string;
  orgInviteName?: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(prefillCode ?? "");
  const [status, setStatus] = useState<"idle" | "busy" | "confirm-needed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  // Bij een org-invite-link is de token zelf de toegang: geen aparte beta-code,
  // en de koppeling aan de org gebeurt bij login via redeem_org_invite().
  const isOrgInvite = Boolean(orgInviteName);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("busy");
    try {
      // Beta-code stap: alleen voor niet-uitgenodigde signups. Een geldige
      // org-invite-link vervangt deze gate volledig.
      if (!isOrgInvite) {
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
      }

      // Step 2: create the Supabase Auth user. We maken hier GEEN organisatie aan.
      // Was je uitgenodigd voor een bestaande org, dan koppelt accept_pending_invites
      // je automatisch bij login. Heb je geen org, dan toont de app het
      // onboarding-scherm om je eerste organisatie aan te maken.
      const { data, error: err } = await signUpWithPassword(
        email,
        password,
        fullName,
      );
      if (err) throw err;

      if (data.session) {
        onAuth();
      } else {
        // Email-bevestiging vereist: bij eerste login regelt de app de rest.
        setStatus("confirm-needed");
      }
    } catch (err) {
      setStatus("idle");
      setError(translateError(err));
    }
  }

  if (status === "confirm-needed") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
        <div className="mb-1 font-semibold">Bevestig je e-mailadres.</div>
        We stuurden een bevestigingslink naar <strong>{email}</strong>. Klik
        die en je bent ingelogd.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        Maak je account aan
      </h2>
      <Field label="Jouw naam">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Storm Tuyls"
          className={inputCls}
        />
      </Field>
      <Field label="E-mailadres">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputCls}
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
          className={inputCls}
        />
      </Field>
      {!isOrgInvite && (
        <Field
          label="Invite code"
          hint="Kaspio is in gesloten bèta. Geen code? Mail storm@kaspio.be."
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
            className={`${inputCls} font-num uppercase tracking-wider`}
          />
        </Field>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <button
        type="submit"
        disabled={status === "busy" || !SUPABASE_CONFIGURED}
        className={btnPrimary}
      >
        {status === "busy" ? "Bezig…" : "Account aanmaken"}
      </button>
      <p className="text-center text-xs text-slate-400 dark:text-navy-400">
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
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-navy-200">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-slate-400 dark:text-navy-300">
          {hint}
        </span>
      )}
    </label>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
