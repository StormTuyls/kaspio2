import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mark } from "../components/Logo";
import { useForceLight } from "../theme";

type Props = {
  onLogin: () => void;
  onSignup: () => void;
  /** Open de read-only demo (geen account nodig). */
  onDemo: () => void;
  /** Indien gezet: je bekijkt de site terwijl je ingelogd bent. Toont een
   *  terug-naar-app balk bovenaan. */
  onExitPreview?: () => void;
};

export function Landing({ onLogin, onSignup, onDemo, onExitPreview }: Props) {
  useForceLight();
  return (
    <div className="min-h-screen bg-white font-display text-slate-900 antialiased">
      {onExitPreview && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-indigo-600 px-4 py-2 text-sm text-white">
          <span>Je bekijkt de Kaspio-website.</span>
          <button
            onClick={onExitPreview}
            className="rounded-md bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25"
          >
            ← Terug naar de app
          </button>
        </div>
      )}
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} onDemo={onDemo} />
      <TrustStrip />
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

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Reveal-on-scroll wrapper. Toggles `.is-in` when the element enters the
 *  viewport. Respects prefers-reduced-motion via CSS. */
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function Icon({
  children,
  className = "h-5 w-5",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`font-num text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`}
    >
      {children}
    </p>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={32} variant={light ? "light" : "default"} />
      <span
        className={`text-xl font-extrabold tracking-tight ${
          light ? "text-white" : "text-slate-900"
        }`}
      >
        Kaspio
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/80 bg-white/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#hoe" className="transition hover:text-indigo-600">Hoe het werkt</a>
          <a href="#functies" className="transition hover:text-indigo-600">Functies</a>
          <a href="#prijzen" className="transition hover:text-indigo-600">Prijzen</a>
          <a href="#faq" className="transition hover:text-indigo-600">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600 sm:inline-flex"
          >
            Inloggen
          </button>
          <button
            onClick={onSignup}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-600/25"
          >
            Gratis starten →
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ onSignup, onDemo }: { onSignup: () => void; onDemo: () => void }) {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pt-24">
      {/* soft brand glow + faint grid */}
      <div
        aria-hidden
        className="kaspio-glow pointer-events-none absolute inset-x-0 top-[-120px] mx-auto h-[560px] w-[920px] max-w-full"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(79,70,229,0.16) 0%, rgba(16,185,129,0.07) 38%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="kaspio-glow-2 pointer-events-none absolute left-1/2 top-[-40px] h-[420px] w-[420px] -translate-x-[60%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(16,185,129,0.18) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:gap-8">
        <div className="text-left">
          <Reveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-indigo-500" />
              </span>
              Live · gratis te starten
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mb-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Eén rekening.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
                Meerdere potjes.
              </span>
              <br />
              Volledige controle.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mb-8 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Kaspio verdeelt inkomsten op jouw bankrekening in virtuele potjes,
              per persoon, per team of per doel. Zonder extra rekeningen. Zonder
              boekhoudsoftware.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onSignup}
                className="rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-bold text-white shadow-md shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:bg-indigo-700"
              >
                Gratis starten →
              </button>
              <button
                onClick={onDemo}
                className="rounded-xl border border-slate-200 bg-white px-7 py-3.5 text-center text-base font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                Bekijk de demo
              </button>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <p className="flex items-center gap-1.5 text-sm text-slate-500">
              <Icon className="h-4 w-4 text-emerald-600">
                <path d="M20 6 9 17l-5-5" />
              </Icon>
              Gratis starten, geen kaart nodig.
            </p>
          </Reveal>
        </div>

        <Reveal delay={140} className="lg:-mr-6 xl:-mr-20">
          <HeroMockup />
        </Reveal>
      </div>
    </section>
  );
}

function HeroMockup() {
  const pots = [
    { name: "Salarissen", amount: "€3.200", pct: 78, color: "bg-indigo-500" },
    { name: "Marketing", amount: "€1.800", pct: 44, color: "bg-emerald-500" },
    { name: "Events", amount: "€920", pct: 31, color: "bg-amber-500" },
    { name: "Reserve", amount: "€1.980", pct: 66, color: "bg-violet-500" },
  ];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-24px_rgba(49,46,129,0.35),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white px-3 py-0.5 font-num text-xs text-slate-400 ring-1 ring-slate-200">
          app.kaspio.be/dashboard
        </span>
      </div>

      <div className="grid min-h-[400px] grid-cols-1 md:grid-cols-[230px_1fr]">
        {/* sidebar */}
        <aside className="hidden flex-col gap-1 border-r border-slate-100 bg-slate-50/70 p-4 text-left md:flex">
          <div className="px-2 pb-1.5 font-num text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Overzicht
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            Alle potjes
            <span className="ml-auto font-num text-xs tabular-nums text-indigo-500">€8.240</span>
          </div>
          <div className="px-2 pb-1.5 pt-3 font-num text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Mijn potjes
          </div>
          {pots.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-white"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto font-num text-xs tabular-nums text-slate-400">
                {p.amount}
              </span>
            </div>
          ))}
        </aside>

        {/* main */}
        <main className="p-5 text-left sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-slate-900">
                Alle potjes · mei 2026
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Beheerd door Thomas V. · 3 teamleden actief
              </div>
            </div>
            <button className="flex-shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white">
              + Toevoegen
            </button>
          </div>

          {/* pots with progress */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {pots.slice(0, 2).map((p) => (
              <div key={p.name} className="rounded-xl border border-slate-100 bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                    {p.name}
                  </span>
                  <span className="font-num text-[11px] tabular-nums text-slate-400">
                    {p.pct}%
                  </span>
                </div>
                <div className="mb-2 font-num text-lg font-bold tabular-nums text-slate-900">
                  {p.amount}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-2 font-num text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Recente transacties
          </div>
          <Txn
            initials="S"
            tone="emerald"
            title="Salarisbetaling Tom"
            from="Van: Werkgever NV"
            tag="Salarissen"
            amount="+€2.400"
            positive
          />
          <Txn
            initials="E"
            tone="amber"
            title="Zomerfeest budget"
            from="Van: HQ Finance"
            tag="Events"
            amount="+€500"
            positive
          />
          <Txn
            initials="M"
            tone="indigo"
            title="Google Ads mei"
            from="Uit: Marketing"
            tag="Marketing"
            amount="−€320"
            last
          />
        </main>
      </div>
    </div>
  );
}

function Txn({
  initials,
  tone,
  title,
  from,
  tag,
  amount,
  positive,
  last,
}: {
  initials: string;
  tone: "emerald" | "amber" | "indigo";
  title: string;
  from: string;
  tag: string;
  amount: string;
  positive?: boolean;
  last?: boolean;
}) {
  const toneClass = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    indigo: "bg-indigo-100 text-indigo-700",
  }[tone];

  return (
    <div
      className={`flex items-center gap-3 py-2.5 text-xs ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${toneClass}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-900">{title}</div>
        <div className="text-[11px] text-slate-500">{from}</div>
      </div>
      <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 sm:inline-block">
        {tag}
      </span>
      <span
        className={`font-num text-sm font-semibold tabular-nums ${
          positive ? "text-emerald-600" : "text-rose-500"
        }`}
      >
        {amount}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

function TrustStrip() {
  const items = ["Gratis te starten", "Geen kaart nodig", "Onbeperkt potjes op Pro", "Data exporteerbaar"];
  return (
    <section className="border-y border-slate-100 bg-slate-50/60 py-6">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6">
        {items.map((t, i) => (
          <span key={t} className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <span className="relative flex h-2 w-2">
              {i === 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problem                                                             */
/* ------------------------------------------------------------------ */

function Problem() {
  const issues = [
    {
      title: "Geen overzicht per persoon",
      desc: "Meerdere mensen of teams delen één rekening, niemand weet wat van hem of haar is.",
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
    <section className="px-6 py-24" style={{ backgroundColor: "#161529" }}>
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <Eyebrow className="mb-3 text-indigo-300">Het probleem</Eyebrow>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Herken je dit?
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Alles komt op één rekening binnen, maar niemand weet van wie, voor
            wie, of hoeveel er nog over is.
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {issues.map((it, i) => (
            <Reveal key={it.title} delay={i * 70}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-white/20 hover:bg-white/[0.07] sm:p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-300">
                  <Icon className="h-5 w-5">{it.icon}</Icon>
                </div>
                <h3 className="mb-2 text-base font-bold text-white">{it.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{it.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

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
      desc: "Koppel inkomsten en uitgaven aan het juiste potje. Voer ze manueel in of importeer een CSV-bestand van je bank.",
    },
    {
      n: 3,
      title: "Iedereen volgt mee",
      desc: "Elk teamlid ziet enkel zijn of haar eigen potje. De beheerder heeft het volledige overzicht.",
    },
  ];

  return (
    <section id="hoe" className="scroll-mt-20 bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Hoe het werkt</Eyebrow>
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              In 3 stappen geregeld
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Kaspio is geen boekhoudprogramma. Het is een simpele tool die
              overzicht geeft waar jij dat wil.
            </p>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute left-12 top-5 hidden h-0.5 w-full bg-gradient-to-r from-indigo-200 to-transparent md:block" />
                )}
                <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 font-num text-lg font-bold text-white ring-8 ring-indigo-50">
                  {s.n}
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900">{s.title}</h3>
                <p className="text-base leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features (bento)                                                    */
/* ------------------------------------------------------------------ */

function Features() {
  const rest = [
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
      desc: "Beheerders zien alles. Potverantwoordelijken enkel hun eigen potje. Volledig privaat.",
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
      desc: "Een melding bij nieuwe inkomsten, lage saldo's of bestedingslimieten die bereikt worden.",
      icon: (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      ),
    },
    {
      title: "CSV-import",
      desc: "Importeer je bankafschrift als CSV en wijs de transacties in één keer toe aan je potjes. Bankkoppeling via PSD2 volgt later.",
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
      title: "Export naar Excel & PDF",
      desc: "Exporteer elk potje of het volledig overzicht voor je boekhouder of jaarverslag.",
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
    <section id="functies" className="scroll-mt-20 bg-slate-50/70 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Functies</Eyebrow>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Alles wat je nodig hebt,
              <br className="hidden sm:block" /> niets wat je niet nodig hebt
            </h2>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(0,210px)]">
          {/* hero feature tile */}
          <Reveal className="h-full sm:col-span-2 sm:row-span-2">
            <div className="flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 to-indigo-700 p-7 text-white shadow-lg shadow-indigo-600/20">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur">
                  <Icon className="h-6 w-6">
                    <path d="M2 8l10-5 10 5-10 5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </Icon>
                </div>
                <h3 className="mb-2 text-2xl font-bold">Virtuele potjes</h3>
                <p className="max-w-md text-[15px] leading-relaxed text-indigo-100">
                  Maak onbeperkt potjes per persoon, team of doel, allemaal op
                  dezelfde bankrekening. Geen extra IBAN, geen gedoe.
                </p>
              </div>
              {/* mini stacked pots */}
              <div className="mt-7 space-y-2.5">
                {[
                  { n: "Salarissen", a: "€3.200", w: "78%", c: "bg-white" },
                  { n: "Marketing", a: "€1.800", w: "44%", c: "bg-emerald-300" },
                  { n: "Events", a: "€920", w: "31%", c: "bg-amber-300" },
                ].map((p) => (
                  <div key={p.n} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-white">{p.n}</span>
                      <span className="font-num tabular-nums text-indigo-100">{p.a}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                      <div className={`h-full rounded-full ${p.c}`} style={{ width: p.w }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {rest.map((f, i) => (
            <Reveal key={f.title} delay={i * 50} className="h-full">
              <div className="group flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-600/5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                  <Icon className="h-5 w-5">{f.icon}</Icon>
                </div>
                <h3 className="mb-1.5 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Use cases                                                           */
/* ------------------------------------------------------------------ */

function UseCases() {
  const cases = [
    { initials: "AB", title: "Artiestenbureau's", desc: "Honoraria en royalties per artiest op één rekening" },
    { initials: "SC", title: "Sportclubs", desc: "Ledenbijdragen, sponsoring en kantine, elk in eigen potje" },
    { initials: "JB", title: "Jeugdbewegingen", desc: "Kamp, werking en materiaal transparant bijhouden" },
    { initials: "VZ", title: "VZW's", desc: "Subsidies en donaties direct koppelen aan projecten" },
    { initials: "CT", title: "Creatieve teams", desc: "Film, muziek en events, budgetbeheer zonder boekhouder" },
    { initials: "KB", title: "Kleine bedrijven", desc: "Inkomsten per project of divisie zonder extra rekening" },
  ];
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Voor wie</Eyebrow>
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Kaspio werkt voor elk type organisatie
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Van jeugdbeweging tot managementbureau, als je inkomsten beheert
              voor meerdere mensen of doelen, is Kaspio voor jou.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cases.map((c, i) => (
            <Reveal key={c.title} delay={i * 45} className="h-full">
              <div className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/40 sm:p-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 font-num text-sm font-bold text-indigo-700">
                  {c.initials}
                </div>
                <h3 className="mb-1.5 text-sm font-bold text-slate-900">{c.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{c.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

function Pricing({ onSignup }: { onSignup: () => void }) {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="prijzen" className="scroll-mt-20 bg-slate-50/70 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Prijzen</Eyebrow>
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Simpel. Eerlijk. Transparant.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Start gratis. Betaal enkel als je meer nodig hebt. Geen verborgen
              kosten.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-start gap-x-3 gap-y-2 text-sm text-slate-600">
              <span>Maandelijks</span>
              <button
                onClick={() => setYearly((v) => !v)}
                className="relative h-6 w-11 rounded-full bg-indigo-600 transition"
                aria-pressed={yearly}
                aria-label="Wissel maandelijks of jaarlijks"
              >
                <span
                  className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
                    yearly ? "left-[23px]" : "left-[3px]"
                  }`}
                />
              </button>
              <span>Jaarlijks</span>
              <span
                className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold transition ${
                  yearly
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {yearly ? "✓ −20% actief" : "Bespaar 20%"}
              </span>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid items-start gap-6 md:grid-cols-3">
          <Reveal className="h-full">
            <Plan
              name="Gratis"
              price="€0"
              desc="Perfect om te starten. Geen kaart vereist."
              features={[
                { text: "Tot 5 virtuele potjes" },
                { text: "Manuele transacties invoeren" },
                { text: "3 gebruikers" },
                { text: "Basis historiek (30 dagen)" },
                { text: "CSV-export" },
                { text: "CSV-import", no: true },
                { text: "Grafieken & rapportage", no: true },
                { text: "Meldingen", no: true },
              ]}
              cta="Gratis starten"
              ctaStyle="outline"
              onClick={onSignup}
            />
          </Reveal>
          <Reveal delay={80} className="h-full">
            <Plan
              featured
              name="Pro"
              price={yearly ? "€3,20" : "€4"}
              priceSuffix="/maand"
              desc={
                yearly
                  ? "Je bespaart €9,60/jaar tov maandelijks. Gefactureerd als €38,40/jaar."
                  : "Voor één club of organisatie. Betaal per maand of bespaar 20% jaarlijks."
              }
              features={[
                { text: "Onbeperkte potjes" },
                { text: "Onbeperkt aantal gebruikers" },
                { text: "Manuele invoer + CSV-import" },
                { text: "Volledige historiek" },
                { text: "Grafieken & rapportage" },
                { text: "PDF-export (CSV opent in Excel)" },
                { text: "E-mail meldingen" },
                { text: "Bankkoppeling (PSD2) , binnenkort", no: true },
                { text: "Potgroepen (takken & ploegen)", no: true },
                { text: "Bijlagen (bonnetjes & facturen)", no: true },
              ]}
              cta="Kies Pro"
              ctaStyle="fill"
              onClick={onSignup}
            />
          </Reveal>
          <Reveal delay={160} className="h-full">
            <Plan
              name="Team"
              price={yearly ? "€8" : "€10"}
              priceSuffix="/maand"
              desc={
                yearly
                  ? "Je bespaart €24/jaar tov maandelijks. Gefactureerd als €96/jaar."
                  : "Voor grotere VZW's en koepels die meer controle en goedkeuringen nodig hebben."
              }
              features={[
                { text: "Alles uit Pro, onbeperkt" },
                { text: "Potgroepen (takken & ploegen)" },
                { text: "Meerdere beheerders" },
                { text: "Goedkeuringsflows" },
                { text: "Bijlagen (bonnetjes & facturen)" },
                { text: "Prioriteitsondersteuning" },
              ]}
              note="Whitelabel en API op aanvraag, neem contact op."
              cta="Kies Team"
              ctaStyle="amber"
              onClick={onSignup}
            />
          </Reveal>
        </div>

        <p className="mt-7 text-center text-sm text-slate-500">
          Geen creditcard nodig om te starten · Elk moment opzegbaar ·
          GDPR-conform, data in de EU
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
  note,
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
  note?: string;
  cta: string;
  ctaStyle: "outline" | "fill" | "amber";
  onClick: () => void;
  featured?: boolean;
}) {
  const ctaClass = {
    outline:
      "border border-slate-200 bg-white text-slate-900 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700",
    fill: "bg-indigo-600 text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700",
    amber: "bg-amber-500 text-white hover:bg-amber-600",
  }[ctaStyle];

  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl bg-white p-6 sm:p-8 ${
        featured
          ? "border-2 border-indigo-600 shadow-[0_20px_50px_-20px_rgba(79,70,229,0.4)]"
          : "border border-slate-200"
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-3.5 py-1 text-xs font-bold text-white">
          Meest gekozen
        </div>
      )}
      <div className="mb-2 font-num text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {name}
      </div>
      <div className="mb-1 font-num text-4xl font-extrabold tracking-tight text-slate-900">
        {price}
        {priceSuffix && (
          <span className="ml-1 font-display text-base font-medium text-slate-500">
            {priceSuffix}
          </span>
        )}
      </div>
      <p className="mb-5 text-sm leading-snug text-slate-500">{desc}</p>
      <hr className="mb-5 border-t border-slate-100" />
      <ul className="mb-6 flex-1 space-y-3">
        {features.map((f) => (
          <li
            key={f.text}
            className={`flex items-start gap-2.5 text-sm ${
              f.no ? "text-slate-400" : "text-slate-700"
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {f.no ? (
                <Icon className="h-4 w-4 text-slate-300">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </Icon>
              ) : (
                <Icon className="h-4 w-4 text-emerald-600">
                  <path d="M20 6 9 17l-5-5" />
                </Icon>
              )}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      {note && (
        <p className="mb-4 text-xs leading-relaxed text-slate-400">{note}</p>
      )}
      <button
        onClick={onClick}
        className={`w-full rounded-xl py-3 text-sm font-bold transition ${ctaClass}`}
      >
        {cta}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Build in public                                                     */
/* ------------------------------------------------------------------ */

function BuildInPublic() {
  const status = [
    {
      label: "Nu",
      title: "Live en gratis te starten",
      desc: "Geen wachtlijst, geen code nodig. Potjes, rollen & delen, manuele invoer én CSV-import, grafieken, PDF-rapporten en e-mailmeldingen werken vandaag.",
      done: true,
    },
    {
      label: "Net live",
      title: "Betalingen live",
      desc: "Pro (€4) en Team (€10) met onbeperkte potjes, potgroepen, goedkeuringen en bijlagen. Betalen via Stripe werkt , kies een plan en reken meteen veilig af.",
      done: true,
    },
    {
      label: "Daarna",
      title: "Bankkoppeling (PSD2)",
      desc: "Automatische import van je banktransacties via open banking. In ontwikkeling , vandaag importeer je een CSV-bestand van je bank.",
    },
  ];
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Build in public</Eyebrow>
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Waar staan we nu?
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Kaspio is jong en eerlijk daarover. Hier is precies wat we doen, wat
              er komt en wanneer je iets kunt verwachten.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {status.map((s, i) => (
            <Reveal key={s.title} delay={i * 90} className="h-full">
              <div className="h-full rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_1px_3px_rgba(15,23,42,0.05),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
                <span
                  className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-num text-[11px] font-bold uppercase tracking-[0.16em] ${
                    s.done
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {s.done && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {s.label}
                </span>
                <h3 className="mb-2 text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-500">
            Wil je meebouwen? Maak een account aan, ik hoor graag hoe jullie het
            vandaag aanpakken.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://calendly.com/stormtuyls-4e1o/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Plan 30 min
            </a>
            <a
              href="mailto:stormtuyls@icloud.com?subject=Kaspio"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Mail me
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function Faq() {
  const items = [
    {
      q: "Is Kaspio een bankrekening?",
      a: "Nee. Kaspio is geen bank en beheert geen echt geld. Het is een overzichtstool die jou helpt om inkomsten op jouw bestaande rekening te labelen en te verdelen over virtuele potjes. Jij behoudt volledig de controle over de echte rekening.",
    },
    {
      q: "Heeft Kaspio toegang tot mijn bankrekening?",
      a: "Nee. Kaspio leest vandaag geen banktransacties uit. Je voert ze manueel in of importeert een CSV-bestand van je bank. Een automatische PSD2-koppeling (enkel leesrechten, nooit schrijfrechten) is in ontwikkeling; ook dan kan Kaspio nooit geld verplaatsen.",
    },
    {
      q: "Hoe krijg ik mijn transacties in Kaspio?",
      a: "Voer ze manueel in, of exporteer een CSV vanuit je bank en importeer die in één keer (Pro). Je mapt zelf de kolommen en wijst elke transactie toe aan een potje. De automatische PSD2-bankkoppeling volgt later.",
    },
    {
      q: "Werkt Kaspio voor mijn sportclub of jeugdbeweging?",
      a: "Ja, dat is precies de doelgroep waarvoor Kaspio gebouwd is. Het Team-plan is ideaal: meerdere beheerders (bv. penningmeester + voorzitter), aparte potjes per activiteit of werkgroep, en exporteerbare rapporten voor het jaarverslag.",
    },
    {
      q: "Is er een limiet op het aantal gebruikers?",
      a: "Op Pro en Team is het aantal gebruikers én potjes onbeperkt. De gratis versie is beperkt tot 5 potjes en 3 gebruikers. Heb je whitelabeling of een opzet voor een koepel of boekhouder nodig? Neem gewoon even contact op.",
    },
    {
      q: "Kan ik mijn data exporteren als ik stop?",
      a: "Ja, altijd. Je kunt op elk moment al je data exporteren als Excel of CSV. Je zit nooit vast aan Kaspio.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-slate-50/70 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow className="mb-3 text-indigo-600">Veelgestelde vragen</Eyebrow>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Alles wat je wil weten
            </h2>
          </div>
        </Reveal>
        <Reveal>
          <div className="mt-12 max-w-3xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white">
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={it.q} className={i > 0 ? "border-t border-slate-100" : ""}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-slate-900 transition hover:text-indigo-600"
                    aria-expanded={isOpen}
                  >
                    <span>{it.q}</span>
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-lg leading-none text-indigo-600 transition-transform duration-200 ${
                        isOpen ? "rotate-45" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-5 text-sm leading-relaxed text-slate-600">
                        {it.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCta({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12"
            style={{
              background:
                "linear-gradient(135deg, #4f46e5 0%, #4338ca 55%, #312e81 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.35), transparent 45%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.18), transparent 50%)",
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Klaar om orde te scheppen in jouw geldstromen?
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-lg text-indigo-100">
                Maak gratis een account aan en zet je eerste potjes op in een
                paar minuten.
              </p>
              <button
                onClick={onSignup}
                className="rounded-xl bg-amber-500 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-amber-400"
              >
                Gratis starten →
              </button>
              <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-indigo-200">
                <span className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5">
                    <path d="M20 6 9 17l-5-5" />
                  </Icon>
                  Geen kaart nodig
                </span>
                <span className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5">
                    <path d="M20 6 9 17l-5-5" />
                  </Icon>
                  Klaar in minuten
                </span>
                <span className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5">
                    <path d="M20 6 9 17l-5-5" />
                  </Icon>
                  Elk moment opzegbaar
                </span>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="px-6 pb-8 pt-14 text-sm text-slate-400" style={{ backgroundColor: "#0f0f1a" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 pb-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              Virtueel potjesbeheer voor iedereen die inkomsten op één rekening
              transparant wil verdelen. Gemaakt in België.
            </p>
          </div>
          <FooterCol title="Product" links={["Functies", "Prijzen", "Demo", "Roadmap", "Changelog"]} />
          <FooterCol
            title="Gebruik"
            links={["Sportclubs", "Jeugdbewegingen", "Artiestenbureaus", "VZW's", "Kleine bedrijven"]}
          />
          <FooterCol title="Bedrijf" links={["Over ons", "Blog", "Contact", "Pers", "Vacatures"]} />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Kaspio BV. Alle rechten voorbehouden.</span>
          <div className="flex gap-5">
            <a className="transition hover:text-indigo-300" href="#">Privacybeleid</a>
            <a className="transition hover:text-indigo-300" href="#">Gebruiksvoorwaarden</a>
            <a className="transition hover:text-indigo-300" href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 font-num text-[11px] font-bold uppercase tracking-[0.16em] text-white">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a className="text-sm text-slate-400 transition hover:text-indigo-300" href="#">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
