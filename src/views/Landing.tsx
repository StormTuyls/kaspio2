import { useId, useState, type FormEvent } from "react";
import { Mark } from "../components/Logo";
import { useForceLight } from "../theme";

// MailerLite embed config, uit MailerLite Forms → Embedded forms → form action URL.
// Pad: https://assets.mailerlite.com/jsonp/{ACCOUNT_ID}/forms/{FORM_ID}/subscribe
const MAILERLITE_ACTION_URL =
  "https://assets.mailerlite.com/jsonp/2372401/forms/188204222789977895/subscribe";

function scrollToWaitlist() {
  const el = document.getElementById("waitlist");
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = el.querySelector<HTMLInputElement>('input[type="email"]');
  setTimeout(() => input?.focus(), 400);
}

type WaitlistVariant = "light" | "dark";

type WaitlistResult =
  | { result: "success"; msg: string }
  | { result: "error"; msg: string };

type MailerLiteResponse = {
  success: boolean;
  errors?: { fields?: Record<string, string[]> };
};

async function submitWaitlist(email: string): Promise<WaitlistResult> {
  const body = new URLSearchParams({
    "fields[email]": email,
    "ml-submit": "1",
    anticsrf: "true",
  });

  const res = await fetch(MAILERLITE_ACTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    return { result: "error", msg: `Netwerkfout (${res.status}). Probeer opnieuw.` };
  }

  const data = (await res.json()) as MailerLiteResponse;

  if (data.success) {
    return {
      result: "success",
      msg: "Je staat op de wachtlijst. Ik stuur je binnen een paar uur een persoonlijke mail.",
    };
  }

  // Mailerlite errors zien er zo uit: { errors: { fields: { email: ["..."] } } }
  const fieldErrors = data.errors?.fields ?? {};
  const firstError = Object.values(fieldErrors).flat()[0];
  const translatedError = translateMailerLiteError(firstError);
  return {
    result: "error",
    msg: translatedError || "Iets ging mis. Probeer opnieuw.",
  };
}

function translateMailerLiteError(err: string | undefined): string {
  if (!err) return "";
  // Engelse MailerLite errors → Nederlandse copy
  if (err.includes("valid email")) return "Vul een geldig e-mailadres in.";
  if (err.includes("required")) return "Vul je e-mailadres in.";
  if (err.toLowerCase().includes("already")) return "Dit adres staat al op de wachtlijst.";
  return err;
}

function WaitlistForm({ variant = "light" }: { variant?: WaitlistVariant }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    setMessage("");
    try {
      const res = await submitWaitlist(email.trim());
      setStatus(res.result);
      setMessage(res.msg);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Iets ging mis.");
    }
  }

  const isDark = variant === "dark";

  if (status === "success") {
    return (
      <div
        className={`mx-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-4 text-left ${
          isDark
            ? "border-teal-300/40 bg-white/10 text-white"
            : "border-teal-300 bg-teal-100 text-teal-700"
        }`}
        role="status"
      >
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            isDark ? "bg-amber-500 text-ink" : "bg-teal-500 text-white"
          }`}
          aria-hidden
        >
          ✓
        </span>
        <div className="text-sm leading-relaxed">
          <div className={`font-semibold ${isDark ? "text-white" : "text-teal-700"}`}>
            Bedankt!
          </div>
          <div className={isDark ? "text-white/80" : "text-teal-700/80"}>{message}</div>
        </div>
      </div>
    );
  }

  const inputClass = isDark
    ? "w-full rounded-l-xl border-2 border-r-0 border-white/20 bg-white/95 px-4 py-3 text-sm text-ink placeholder:text-ink-light focus:border-amber-500 focus:outline-none sm:rounded-l-xl"
    : "w-full rounded-l-xl border-2 border-r-0 border-teal-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-light focus:border-teal-500 focus:outline-none";

  const btnClass = isDark
    ? "rounded-r-xl border-2 border-amber-500 bg-amber-500 px-5 py-3 text-sm font-bold text-ink shadow transition hover:bg-amber-400 disabled:opacity-60"
    : "rounded-r-xl border-2 border-teal-500 bg-teal-500 px-5 py-3 text-sm font-bold text-white shadow transition hover:bg-teal-700 disabled:opacity-60";

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md text-left" noValidate>
      <div className="flex">
        <label htmlFor={inputId} className="sr-only">
          E-mailadres
        </label>
        <input
          id={inputId}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@voorbeeld.be"
          className={inputClass}
          disabled={status === "submitting"}
        />
        <button type="submit" className={btnClass} disabled={status === "submitting"}>
          {status === "submitting" ? "…" : "Wachtlijst"}
        </button>
      </div>
      <p
        className={`mt-2 text-xs ${
          status === "error"
            ? isDark
              ? "text-amber-300"
              : "text-rose-600"
            : isDark
              ? "text-white/55"
              : "text-ink-muted"
        }`}
      >
        {status === "error"
          ? message
          : "We sturen één mail zodra Kaspio open is, geen spam, opzeggen kan altijd."}
      </p>
    </form>
  );
}

type Props = {
  onLogin: () => void;
  onSignup: () => void;
};

export function Landing({ onLogin, onSignup }: Props) {
  useForceLight();
  return (
    <div className="min-h-screen bg-white text-ink">
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} />
      <WaitlistStatus />
      <Problem />
      <HowItWorks />
      <Features />
      <UseCases />
      <Pricing onSignup={onSignup} />
      <BuildInPublic />
      <Faq />
      <FinalCta onSignup={onSignup} />
      <Footer />
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={32} variant={light ? "light" : "default"} />
      <span
        className={`text-xl font-extrabold tracking-tight ${
          light ? "text-white" : "text-teal-700"
        }`}
      >
        Kaspio
      </span>
    </span>
  );
}

function Header({ onLogin }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-teal-100/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-muted md:flex">
          <a href="#hoe" className="hover:text-teal-500">Hoe het werkt</a>
          <a href="#functies" className="hover:text-teal-500">Functies</a>
          <a href="#prijzen" className="hover:text-teal-500">Prijzen</a>
          <a href="#faq" className="hover:text-teal-500">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden rounded-lg border border-teal-100 px-4 py-2 text-sm font-medium text-ink-muted transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 sm:inline-flex"
          >
            Inloggen
          </button>
          <button
            onClick={scrollToWaitlist}
            className="rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-700"
          >
            Op de wachtlijst →
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero(_: { onSignup: () => void }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-teal-50 via-white to-white px-6 pb-20 pt-24 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-80px] h-[600px] w-[600px] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(29,158,117,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-4xl">
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-100 px-3.5 py-1.5 text-xs font-semibold text-teal-700">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
          </span>
          Nu in bèta, gratis starten
        </div>
        <h1 className="mx-auto mb-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
          Eén rekening.
          <br />
          <span className="text-teal-500">Meerdere potjes.</span>
          <br />
          Volledige controle.
        </h1>
        <p className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Kaspio verdeelt inkomsten op jouw bankrekening in virtuele potjes, per persoon, per team of per doel. Zonder extra rekeningen. Zonder
          boekhoudsoftware.
        </p>
        <div id="waitlist" className="mb-6 scroll-mt-20">
          <WaitlistForm variant="light" />
        </div>
        <div className="mb-14 flex justify-center">
          <a
            href="#hoe"
            className="text-sm font-semibold text-teal-700 underline decoration-teal-200 underline-offset-4 transition hover:decoration-teal-500"
          >
            Bekijk eerst hoe het werkt ▶
          </a>
        </div>

        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  const pots = [
    { name: "Alle potjes", amount: "€8.240", color: "bg-teal-500", active: true },
    { name: "Marketing", amount: "€1.800", color: "bg-azure-500" },
    { name: "Salarissen", amount: "€3.200", color: "bg-[#8b5cf6]" },
    { name: "Events", amount: "€920", color: "bg-amber-500" },
    { name: "Onkosten", amount: "€340", color: "bg-rose-500" },
    { name: "Reserve", amount: "€1.980", color: "bg-teal-500" },
  ];

  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-[0_8px_48px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2 border-b border-teal-100 bg-[#f8f9fa] px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-teal-100/60 px-3 py-0.5 text-xs text-ink-light">
          app.kaspio.be/dashboard
        </span>
      </div>

      <div className="grid min-h-[380px] grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-teal-100 bg-teal-50/60 py-5 text-left md:block">
          <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-light">
            Overzicht
          </div>
          {pots.slice(0, 1).map((p) => (
            <SidebarRow key={p.name} {...p} />
          ))}
          <div className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-wider text-ink-light">
            Mijn potjes
          </div>
          {pots.slice(1).map((p) => (
            <SidebarRow key={p.name} {...p} />
          ))}
          <div className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-wider text-ink-light">
            Instellingen
          </div>
          <div className="px-4 py-2 text-xs text-ink-muted">Beheer potjes</div>
          <div className="px-4 py-2 text-xs text-ink-muted">Teamleden</div>
        </aside>

        <main className="p-6 text-left">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-ink">
                Alle potjes · mei 2026
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                Beheerd door: Thomas V. · 3 teamleden actief
              </div>
            </div>
            <button className="flex-shrink-0 whitespace-nowrap rounded-md bg-teal-500 px-3.5 py-1.5 text-xs font-semibold text-white">
              + Toevoegen
            </button>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <StatCard label="Totaal beheerd" value="€8.240" />
            <StatCard label="Inkomsten mei" value="€2.150" />
            <StatCard label="Openstaand" value="€430" amber />
          </div>

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Recente transacties
          </div>
          <Txn
            initials="S"
            initialsBg="bg-[#ede9fe] text-[#6d28d9]"
            title="Salarisbetaling Tom"
            from="Van: Werkgever NV"
            tag="Salarissen"
            amount="+€2.400"
            amountClass="text-teal-500"
          />
          <Txn
            initials="E"
            initialsBg="bg-amber-50 text-amber-700"
            title="Zomerfeest budget"
            from="Van: HQ Finance"
            tag="Events"
            amount="+€500"
            amountClass="text-teal-500"
          />
          <Txn
            initials="M"
            initialsBg="bg-azure-100 text-azure-700"
            title="Google Ads mei"
            from="Uit: Marketing"
            tag="Marketing"
            amount="−€320"
            amountClass="text-rose-500"
            last
          />
        </main>
      </div>
    </div>
  );
}

function SidebarRow({
  name,
  amount,
  color,
  active,
}: {
  name: string;
  amount: string;
  color: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex cursor-pointer items-center gap-2.5 px-4 py-2 text-xs transition ${
        active
          ? "bg-teal-100 font-semibold text-teal-700"
          : "text-ink hover:bg-teal-100/60"
      }`}
    >
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${color}`} />
      <span className="truncate">{name}</span>
      <span className="ml-auto text-[11px] text-ink-muted">{amount}</span>
    </div>
  );
}

function StatCard({
  label,
  value,
  amber,
}: {
  label: string;
  value: string;
  amber?: boolean;
}) {
  return (
    <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${amber ? "text-amber-700" : "text-teal-700"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Txn({
  initials,
  initialsBg,
  title,
  from,
  tag,
  amount,
  amountClass,
  last,
}: {
  initials: string;
  initialsBg: string;
  title: string;
  from: string;
  tag: string;
  amount: string;
  amountClass: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 text-xs ${
        last ? "" : "border-b border-teal-100"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${initialsBg}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{title}</div>
        <div className="text-[11px] text-ink-muted">{from}</div>
      </div>
      <span className="hidden rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 sm:inline-block">
        {tag}
      </span>
      <span className={`text-sm font-semibold ${amountClass}`}>{amount}</span>
    </div>
  );
}

function WaitlistStatus() {
  return (
    <section className="border-y border-teal-100 bg-teal-50/40 py-7 text-center">
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 px-6 sm:flex-row sm:gap-8">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          <span className="text-sm font-semibold text-teal-700">
            Bèta opent binnenkort
          </span>
        </div>
        <span className="hidden h-4 w-px bg-teal-200 sm:block" aria-hidden />
        <span className="text-sm text-ink-muted">
          Eerste 20 plekken voor de gesloten beta
        </span>
        <span className="hidden h-4 w-px bg-teal-200 sm:block" aria-hidden />
        <span className="text-sm text-ink-muted">
          Wachtlijst is open
        </span>
      </div>
    </section>
  );
}

function Problem() {
  const issues = [
    {
      title: "Geen overzicht per persoon",
      desc: "Meerdere mensen of teams delen één rekening, niemand weet wat van hem/haar is.",
      icon: (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      ),
    },
    {
      title: "Eindeloos Excel-beheer",
      desc: "Budgetten bijhouden in Google Sheets is tijdrovend, foutgevoelig en niet schaalbaar.",
      icon: (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </>
      ),
    },
    {
      title: "Meerdere bankrekeningen",
      desc: "Extra rekeningen openen voor elk project is omslachtig en duur bij banken.",
      icon: (
        <>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      ),
    },
    {
      title: "Geen transparantie",
      desc: "Teamleden kunnen niet zien hoeveel er in hun eigen potje zit of wat er is binnengekomen.",
      icon: (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ),
    },
  ];

  return (
    <section className="bg-teal-900 px-6 py-24" style={{ backgroundColor: "#04342C" }}>
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-300">
          Het probleem
        </p>
        <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Herken je dit?
        </h2>
        <p className="max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
          Alles komt op één rekening binnen, maar niemand weet van wie, voor
          wie, of hoeveel er nog over is.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {issues.map((it) => (
            <div
              key={it.title}
              className="rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9FE1CB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {it.icon}
                </svg>
              </div>
              <h3 className="mb-2 text-base font-bold text-white">
                {it.title}
              </h3>
              <p className="text-sm leading-relaxed text-white/55">
                {it.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: 1,
      title: "Maak potjes aan",
      desc: "Geef elk potje een naam, een verantwoordelijke en optioneel een doel of budget. In 30 seconden klaar.",
    },
    {
      n: 2,
      title: "Voeg transacties toe",
      desc: "Koppel inkomsten en uitgaven aan het juiste potje, manueel of via automatische PSD2-import.",
    },
    {
      n: 3,
      title: "Iedereen volgt mee",
      desc: "Elk teamlid ziet enkel zijn/haar eigen potje. De beheerder heeft het volledige overzicht.",
    },
  ];

  return (
    <section id="hoe" className="scroll-mt-20 bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Hoe het werkt
          </p>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            In 3 stappen geregeld
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Kaspio is geen boekhoudprogramma. Het is een simpele tool die
            overzicht geeft waar jij dat wil.
          </p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute left-12 top-5 hidden h-0.5 w-full bg-gradient-to-r from-teal-300 to-transparent md:block" />
              )}
              <div
                className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-teal-500 text-lg font-extrabold text-white"
                style={{ boxShadow: "0 0 0 8px #E1F5EE" }}
              >
                {s.n}
              </div>
              <h3 className="mb-2 text-xl font-bold text-ink">{s.title}</h3>
              <p className="text-base leading-relaxed text-ink-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Virtuele potjes",
      desc: "Maak onbeperkt potjes per persoon, team of doel, allemaal op dezelfde bankrekening.",
      icon: (
        <>
          <path d="M2 8l10-5 10 5-10 5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </>
      ),
    },
    {
      title: "Slim labelen",
      desc: 'Elke transactie krijgt een label: "van wie" en "voor wie". Zo is alles herleidbaar.',
      icon: (
        <>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </>
      ),
    },
    {
      title: "Rolgebaseerde toegang",
      desc: "Beheerders zien alles. Potverantwoordelijken zien enkel hun eigen potje. Volledig privaat.",
      icon: (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ),
    },
    {
      title: "Grafieken & historiek",
      desc: "Trends, maandoverzichten en exporteerbare rapporten zodat je altijd weet hoe je ervoor staat.",
      icon: (
        <>
          <line x1="2" y1="20" x2="2" y2="4" />
          <line x1="2" y1="20" x2="22" y2="20" />
          <polyline points="6 16 10 10 14 13 18 7" />
        </>
      ),
    },
    {
      title: "Meldingen",
      desc: "Ontvang een melding bij nieuwe inkomsten, lage saldo's of bestedingslimieten die bereikt worden.",
      icon: (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      ),
    },
    {
      title: "Bankkoppeling (PSD2)",
      desc: "Transacties automatisch importeren via open banking, beschikbaar in Pro en Team.",
      icon: (
        <>
          <line x1="3" y1="22" x2="21" y2="22" />
          <line x1="6" y1="18" x2="6" y2="11" />
          <line x1="10" y1="18" x2="10" y2="11" />
          <line x1="14" y1="18" x2="14" y2="11" />
          <line x1="18" y1="18" x2="18" y2="11" />
          <polygon points="12 2 20 7 4 7" />
        </>
      ),
    },
    {
      title: "Memo's & bijlagen",
      desc: "Voeg notities of facturen toe aan elke transactie voor een volledig auditspoor.",
      icon: (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </>
      ),
    },
    {
      title: "Goedkeuringsflow",
      desc: "Grote uitgaven vereisen eerst goedkeuring van de beheerder. Geen verrassingen.",
      icon: (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </>
      ),
    },
    {
      title: "Export naar Excel/PDF",
      desc: "Export elk potje of het volledig overzicht voor je boekhouder of jaarverslag.",
      icon: (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </>
      ),
    },
  ];

  return (
    <section id="functies" className="scroll-mt-20 bg-teal-50/50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Functies
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Alles wat je nodig hebt,
            <br />
            niets wat je niet nodig hebt
          </h2>
        </div>
        <div className="mt-14 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-teal-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:border-teal-300 hover:shadow-[0_2px_8px_rgba(15,110,86,0.08),0_8px_32px_rgba(15,110,86,0.06)] sm:p-7"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#0F6E56"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                </svg>
              </div>
              <h3 className="mb-2 text-base font-bold text-ink">{f.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    {
      initials: "AB",
      title: "Artiestenbureau's",
      desc: "Beheer honoraria en royalties per artiest op één rekening",
    },
    {
      initials: "SC",
      title: "Sportclubs",
      desc: "Ledenbijdragen, sponsoring en kantine, elk in eigen potje",
    },
    {
      initials: "JB",
      title: "Jeugdbewegingen",
      desc: "Kamp, werking en materiaal transparant bijhouden",
    },
    {
      initials: "VZ",
      title: "VZW's",
      desc: "Subsidies en donaties direct koppelen aan projecten",
    },
    {
      initials: "CT",
      title: "Creatieve teams",
      desc: "Film, muziek en events, budgetbeheer zonder boekhouder",
    },
    {
      initials: "KB",
      title: "Kleine bedrijven",
      desc: "Inkomsten per project of divisie bijhouden zonder extra rekening",
    },
  ];
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Voor wie
          </p>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Kaspio werkt voor elk type organisatie
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Van jeugdbeweging tot managementbureau, als je inkomsten beheert
            voor meerdere mensen of doelen, is Kaspio voor jou.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cases.map((c) => (
            <div
              key={c.title}
              className="rounded-xl border border-teal-100 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/50 sm:p-7"
            >
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-sm font-extrabold text-teal-700">
                {c.initials}
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-ink">{c.title}</h3>
              <p className="text-xs leading-relaxed text-ink-muted">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing(_: { onSignup: () => void }) {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="prijzen" className="scroll-mt-20 bg-teal-50/50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Prijzen
          </p>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Simpel. Eerlijk. Schaalbaar.
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Start gratis. Betaal enkel als je meer nodig hebt. Geen verborgen
            kosten.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-ink-muted">
            <span>Maandelijks</span>
            <button
              onClick={() => setYearly((v) => !v)}
              className="relative h-6 w-11 rounded-full bg-teal-500 transition"
              aria-pressed={yearly}
              aria-label="Wissel maandelijks/jaarlijks"
            >
              <span
                className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
                  yearly ? "left-[23px]" : "left-[3px]"
                }`}
              />
            </button>
            <span>Jaarlijks</span>
            <span
              className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold ${
                yearly
                  ? "border-teal-300 bg-teal-100 text-teal-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {yearly ? "✓ −20% actief" : "Bespaar 20%"}
            </span>
          </div>
        </div>

        <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
          <Plan
            name="Gratis"
            price="€0"
            desc="Perfect om te starten. Geen kaart vereist."
            features={[
              { text: "Tot 3 virtuele potjes" },
              { text: "Manuele transacties invoeren" },
              { text: "2 gebruikers (beheerder + 1 potverantwoordelijke)" },
              { text: "Basis historiek (30 dagen)" },
              { text: "CSV-export" },
              { text: "Bankkoppeling (PSD2)", no: true },
              { text: "Grafieken & rapportage", no: true },
              { text: "Meldingen", no: true },
            ]}
            cta="Op de wachtlijst"
            ctaStyle="outline"
            onClick={scrollToWaitlist}
          />
          <Plan
            featured
            name="Pro"
            price={yearly ? "€3,99" : "€4,99"}
            priceSuffix="/maand"
            desc={
              yearly
                ? "Je bespaart €12/jaar tov maandelijks. Gefactureerd als €47,88/jaar."
                : "Voor freelancers en kleine teams. Betaal per maand of bespaar 20% jaarlijks."
            }
            features={[
              { text: "Onbeperkte potjes" },
              { text: "Manuele + import van transacties" },
              { text: "Tot 5 gebruikers" },
              { text: "Volledige historiek" },
              { text: "Excel & PDF-export" },
              { text: "Bankkoppeling via PSD2" },
              { text: "Grafieken & rapportage" },
              { text: "E-mail meldingen" },
            ]}
            cta="Op de wachtlijst"
            ctaStyle="fill"
            onClick={scrollToWaitlist}
          />
          <Plan
            name="Team"
            price={yearly ? "€16" : "€20"}
            priceSuffix="/maand"
            desc={
              yearly
                ? "Je bespaart €48/jaar tov maandelijks. Gefactureerd als €192/jaar."
                : "Voor verenigingen, VZW's en bedrijven. Meerdere beheerders. Meer controle."
            }
            features={[
              { text: "Alles uit Pro" },
              { text: "Tot 25 gebruikers" },
              { text: "Meerdere beheerders" },
              { text: "Goedkeuringsflows" },
              { text: "Memo's & bijlagen" },
              { text: "Prioriteitsondersteuning" },
              { text: "Whitelabel optie (op aanvraag)" },
              { text: "API-toegang (binnenkort)" },
            ]}
            cta="Op de wachtlijst"
            ctaStyle="amber"
            onClick={scrollToWaitlist}
          />
        </div>

        <p className="mt-7 text-center text-sm text-ink-muted">
          Geen creditcard nodig om te starten · Elk moment opzegbaar · Belgische
          en Nederlandse wetgeving
        </p>
      </div>
    </section>
  );
}

type Feat = { text: string; no?: boolean };

function Plan({
  name,
  price,
  priceSuffix,
  desc,
  features,
  cta,
  ctaStyle,
  onClick,
  featured,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  desc: string;
  features: Feat[];
  cta: string;
  ctaStyle: "outline" | "fill" | "amber";
  onClick: () => void;
  featured?: boolean;
}) {
  const ctaClass = {
    outline:
      "border border-teal-100 bg-white text-ink hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700",
    fill: "bg-teal-500 text-white hover:bg-teal-700",
    amber: "bg-amber-500 text-white hover:bg-amber-700",
  }[ctaStyle];

  return (
    <div
      className={`relative rounded-xl bg-white p-6 sm:p-8 ${
        featured
          ? "border-2 border-teal-500 shadow-[0_8px_40px_rgba(29,158,117,0.15)]"
          : "border border-teal-100"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-500 px-3.5 py-1 text-xs font-bold text-white">
          Meest gekozen
        </div>
      )}
      <div className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-muted">
        {name}
      </div>
      <div className="mb-1 text-4xl font-extrabold tracking-tight text-ink">
        {price}
        {priceSuffix && (
          <span className="ml-1 text-base font-medium text-ink-muted">
            {priceSuffix}
          </span>
        )}
      </div>
      <p className="mb-5 text-sm leading-snug text-ink-muted">{desc}</p>
      <hr className="mb-5 border-t border-teal-100" />
      <ul className="space-y-3">
        {features.map((f) => (
          <li
            key={f.text}
            className={`flex items-start gap-2.5 text-sm ${
              f.no ? "text-ink-light" : "text-ink"
            }`}
          >
            <span
              className={`mt-0.5 flex-shrink-0 font-bold ${
                f.no ? "text-ink-light" : "text-teal-500"
              }`}
            >
              {f.no ? "·" : "✓"}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={`mt-6 w-full rounded-lg py-3 text-sm font-bold transition ${ctaClass}`}
      >
        {cta}
      </button>
    </div>
  );
}

function BuildInPublic() {
  const status = [
    {
      label: "Nu",
      title: "Probleem valideren",
      desc: "In gesprek met scouts, sportclubs, artiestenbureaus en VZW's over hoe ze vandaag potjes beheren.",
    },
    {
      label: "Volgende",
      title: "Gesloten beta",
      desc: "Eerste 20 mensen van de wachtlijst krijgen toegang. Inkomsten en uitgaven loggen, potjes aanmaken, rolgebaseerd delen.",
    },
    {
      label: "Daarna",
      title: "Publieke launch",
      desc: "Voor iedereen open zodra de beta-feedback is verwerkt. PSD2-bankkoppeling en exports volgen.",
    },
  ];
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Build in public
          </p>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Waar staan we nu?
          </h2>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Kaspio is jong en eerlijk daarover. Hier is precies wat we doen, wat
            er komt en wanneer je iets kunt verwachten.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {status.map((s) => (
            <div
              key={s.title}
              className="rounded-xl border border-teal-100 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)]"
            >
              <span className="mb-3 inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700">
                {s.label}
              </span>
              <h3 className="mb-2 text-lg font-bold text-ink">{s.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-ink-muted">
          Wil je meebouwen? Schrijf je in op de wachtlijst, ik nodig je graag uit
          voor een gesprek van 20 minuten.
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Is Kaspio een bankrekening?",
      a: "Nee. Kaspio is geen bank en beheert geen echt geld. Het is een overzichtstool die jou helpt om inkomsten op jouw bestaande rekening te labelen en te verdelen over virtuele potjes. Jij behoudt volledig de controle over de echte rekening.",
    },
    {
      q: "Hoe worden mijn bankgegevens beveiligd?",
      a: "We gebruiken PSD2-gereguleerde bankkoppelingen (enkel leesrechten, nooit schrijfrechten). Alle data is versleuteld opgeslagen. Kaspio kan nooit geld verplaatsen of transacties uitvoeren namens jou.",
    },
    {
      q: "Kan ik zonder bankkoppeling werken?",
      a: "Absoluut. In de gratis versie en Pro voer je transacties manueel in. De bankkoppeling is optioneel en beschikbaar als upgrade, handig als je veel transacties hebt en geen tijd wil verliezen met manuele invoer.",
    },
    {
      q: "Werkt Kaspio voor mijn sportclub of jeugdbeweging?",
      a: "Ja, dat is precies de doelgroep waarvoor Kaspio gebouwd is. Het Team-plan is ideaal: meerdere beheerders (bv. penningmeester + voorzitter), aparte potjes per activiteit of werkgroep, en exporteerbare rapporten voor het jaarverslag.",
    },
    {
      q: "Wat als ik meer dan 25 gebruikers heb?",
      a: "Neem contact op via onze Enterprise-pagina. We bieden maatwerkoplossingen aan voor grotere organisaties, inclusief whitelabeling voor boekhouders of koepelorganisaties.",
    },
    {
      q: "Kan ik mijn data exporteren als ik stop?",
      a: "Ja, altijd. Je kunt op elk moment al je data exporteren als Excel of CSV. Je bent nooit vastzittend aan Kaspio.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-teal-50/50 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-teal-500">
            Veelgestelde vragen
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Alles wat je wil weten
          </h2>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="border-b border-teal-100">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-semibold text-ink transition hover:text-teal-500"
                >
                  <span>{it.q}</span>
                  <span
                    className={`text-xl text-teal-500 transition-transform ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <p className="pb-5 text-sm leading-relaxed text-ink-muted">
                    {it.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta(_: { onSignup: () => void }) {
  return (
    <section className="px-6 py-20 text-center" style={{ backgroundColor: "#0F6E56" }}>
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Klaar om orde te scheppen
          <br />
          in jouw geldstromen?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-lg text-teal-300">
          Schrijf je in op de wachtlijst, we laten weten zodra Kaspio open is.
        </p>
        <WaitlistForm variant="dark" />
        <p className="mt-4 text-xs text-white/50">
          ✓ Eén mail bij launch &nbsp; ✓ Geen spam &nbsp; ✓ Opzeggen kan altijd
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="px-6 pb-8 pt-14 text-sm text-white/60"
      style={{ backgroundColor: "#1a1a18" }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 pb-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Virtueel potjesbeheer voor iedereen die inkomsten op één rekening
              transparant wil verdelen. Gemaakt in België.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={["Functies", "Prijzen", "Demo", "Roadmap", "Changelog"]}
          />
          <FooterCol
            title="Gebruik"
            links={[
              "Sportclubs",
              "Jeugdbewegingen",
              "Artiestenbureaus",
              "VZW's",
              "Enterprise",
            ]}
          />
          <FooterCol
            title="Bedrijf"
            links={["Over ons", "Blog", "Contact", "Pers", "Vacatures"]}
          />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Kaspio BV. Alle rechten voorbehouden.</span>
          <div className="flex gap-5">
            <a className="hover:text-teal-300" href="#">Privacybeleid</a>
            <a className="hover:text-teal-300" href="#">Gebruiksvoorwaarden</a>
            <a className="hover:text-teal-300" href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a className="text-sm text-white/55 hover:text-teal-300" href="#">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
