import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mark } from "../components/Logo";
import { useForceLight } from "../theme";
import { Rekenblad } from "./landing/Rekenblad";

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
    <div className="min-h-screen bg-white text-ink-900 antialiased">
      {onExitPreview && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-ink-950 px-4 py-2 text-sm text-white">
          <span>Je bekijkt de Kaspio-website.</span>
          <button
            onClick={onExitPreview}
            className="rounded-md bg-white/15 px-3 py-1 font-semibold transition hover:bg-white/25"
          >
            ← Terug naar de app
          </button>
        </div>
      )}
      {/* Zes secties in plaats van elf. Wat weg is en waarom staat in
          docs/superpowers/specs/2026-08-29-landingspagina-herstructurering-design.md.
          Kort samengevat: TrustStrip zit nu in de hero, Problem en HowItWorks
          worden vervangen door Rekenblad (tonen in plaats van beweren),
          UseCases verdwijnt omdat doelgroeptaal op precies één plek hoort, en
          BuildInPublic landt als antwoord in de bestuursvragen. */}
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} onDemo={onDemo} />
      <Rekenblad />
      <Features />
      <Pricing onSignup={onSignup} />
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

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={32} variant={light ? "light" : "default"} />
      <span
        className={`text-xl font-extrabold tracking-tight ${
          light ? "text-white" : "text-ink-900"
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
          ? "border-b border-ink-300/80 bg-white/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-ink-700 md:flex">
          <a href="#rekenblad" className="transition hover:text-ink-700">Hoe het werkt</a>
          <a href="#functies" className="transition hover:text-ink-700">Functies</a>
          <a href="#prijzen" className="transition hover:text-ink-700">Prijzen</a>
          <a href="#faq" className="transition hover:text-ink-700">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={onLogin}
            className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-ink-700 transition hover:text-ink-700 sm:inline-flex"
          >
            Inloggen
          </button>
          <button
            onClick={onSignup}
            className="rounded-lg bg-ink-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-ink-900/10 transition hover:-translate-y-0.5 hover:bg-ink-950 hover:shadow-md hover:shadow-ink-900/10"
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
      {/* Eén stille laag in plaats van twee animerende gloed-blobs plus een
          raster. De hero hoeft niet te bewegen om aandacht te krijgen; de
          typografie doet dat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-ink-200"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:gap-8">
        <div className="text-left">
          <Reveal>
            <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1 text-[0.75rem] font-medium text-ink-700 dark:bg-ink-900 dark:text-ink-300">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-900" />
              Gratis te starten
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mb-5 text-[clamp(2.25rem,1.6rem+2.8vw,3.5rem)] font-bold leading-[1.06] text-ink-900 [letter-spacing:-0.025em] dark:text-ink-100">
              <span className="text-ink-600 dark:text-ink-400">Eén rekening.</span>
              <br />
              Meerdere potjes.
              <br />
              <span className="text-ink-600 dark:text-ink-400">Volledige controle.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mb-8 max-w-xl text-base leading-relaxed text-ink-700 sm:text-lg">
              Kaspio verdeelt inkomsten op jouw bankrekening in virtuele potjes,
              per persoon, per team of per doel. Zonder extra rekeningen. Zonder
              boekhoudsoftware.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onSignup}
                className="rounded-xl bg-ink-950 px-7 py-3.5 text-base font-bold text-white shadow-md shadow-ink-900/10 transition hover:-translate-y-0.5 hover:bg-ink-950"
              >
                Gratis starten →
              </button>
              <button
                onClick={onDemo}
                className="rounded-xl border border-ink-300 bg-white px-7 py-3.5 text-center text-base font-semibold text-ink-800 transition hover:-translate-y-0.5 hover:border-ink-300 hover:bg-ink-100 hover:text-ink-700"
              >
                Bekijk de demo
              </button>
            </div>
          </Reveal>

          <Reveal delay={220}>
            <p className="flex items-center gap-1.5 text-sm text-ink-700">
              <Icon className="h-4 w-4 text-in-600">
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
    { name: "Kantine", amount: "€14.820", pct: 78, color: "bg-ink-300" },
    { name: "Jeugdwerking", amount: "€9.640", pct: 61, color: "bg-ink-400" },
    { name: "Accommodatie", amount: "€5.275", pct: 44, color: "bg-ink-500" },
    { name: "Wedstrijden", amount: "€2.410", pct: 22, color: "bg-ink-600" },
  ];

  return (
    <div className="w-full overflow-hidden rounded-md border border-ink-300 bg-white shadow-[0_24px_70px_-24px_rgba(49,46,129,0.35),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto rounded-md bg-white px-3 py-0.5 font-num text-xs text-ink-600 ring-1 ring-ink-200">
          app.kaspio.be/dashboard
        </span>
      </div>

      <div className="grid min-h-[400px] grid-cols-1 md:grid-cols-[230px_1fr]">
        {/* sidebar */}
        <aside className="hidden flex-col gap-1 border-r border-ink-200 bg-ink-50/70 p-4 text-left md:flex">
          <div className="px-2 pb-1.5 font-num text-[10px] font-semibold text-ink-600">
            Overzicht
          </div>
          <div className="flex items-center gap-2.5 rounded-lg bg-ink-100 px-3 py-2 text-sm font-semibold text-ink-700">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-100" />
            Alle potjes
            <span className="ml-auto font-num text-xs tabular-nums text-ink-700">€8.240</span>
          </div>
          <div className="px-2 pb-1.5 pt-3 font-num text-[10px] font-semibold text-ink-600">
            Mijn potjes
          </div>
          {pots.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 transition hover:bg-white"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
              <span className="truncate">{p.name}</span>
              <span className="ml-auto font-num text-xs tabular-nums text-ink-600">
                {p.amount}
              </span>
            </div>
          ))}
        </aside>

        {/* main */}
        <main className="p-5 text-left sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-base font-bold text-ink-900">
                Alle potjes · mei 2026
              </div>
              <div className="mt-0.5 text-xs text-ink-700">
                Beheerd door Thomas V. · 3 teamleden actief
              </div>
            </div>
            <button className="flex-shrink-0 whitespace-nowrap rounded-lg bg-ink-950 px-3.5 py-1.5 text-xs font-semibold text-white">
              + Toevoegen
            </button>
          </div>

          {/* pots with progress */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {pots.slice(0, 2).map((p) => (
              <div key={p.name} className="rounded-xl border border-ink-200 bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-800">
                    <span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />
                    {p.name}
                  </span>
                  <span className="font-num text-[11px] tabular-nums text-ink-600">
                    {p.pct}%
                  </span>
                </div>
                <div className="mb-2 font-num text-lg font-bold tabular-nums text-ink-900">
                  {p.amount}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mb-2 font-num text-[10px] font-semibold text-ink-600">
            Recente transacties
          </div>
          <Txn
            initials="S"
            tone="in"
            title="Salarisbetaling Tom"
            from="Van: gemeentesubsidie"
            tag="Subsidies"
            amount="+€2.400"
            positive
          />
          <Txn
            initials="E"
            tone="uit"
            title="Lidgelden mei"
            from="Van: 34 leden"
            tag="Jeugdwerking"
            amount="+€500"
            positive
          />
          <Txn
            initials="M"
            tone="neutraal"
            title="Aankoop dranken"
            from="Uit: Kantine"
            tag="Kantine"
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
  tone: "in" | "uit" | "neutraal";
  title: string;
  from: string;
  tag: string;
  amount: string;
  positive?: boolean;
  last?: boolean;
}) {
  const toneClass = {
    in: "bg-in-100 text-in-600",
    uit: "bg-uit-100 text-uit-600",
    neutraal: "bg-ink-100 text-ink-700",
  }[tone];

  return (
    <div
      className={`flex items-center gap-3 py-2.5 text-xs ${
        last ? "" : "border-b border-ink-200"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${toneClass}`}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink-900">{title}</div>
        <div className="text-[11px] text-ink-700">{from}</div>
      </div>
      <span className="hidden rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-700 sm:inline-block">
        {tag}
      </span>
      <span
        className={`font-num text-sm font-semibold tabular-nums ${
          positive ? "text-in-600" : "text-uit-600"
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

function Features() {
  const rest = [
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
      title: "Importeren en toewijzen",
      desc: "Je bankafschrift als CSV erin, elke regel naar een post, met een label voor wie en waarvoor. Bankkoppeling via PSD2 volgt later.",
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
      title: "Bewijsstukken en export",
      desc: "Facturen en notities bij elke verrichting, en alles exporteerbaar naar Excel of PDF voor de boekhouder of de algemene vergadering.",
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
    <section id="functies" className="scroll-mt-20 bg-ink-50 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Alles wat je nodig hebt,
              <br className="hidden sm:block" /> niets wat je niet nodig hebt
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* hero feature tile */}
          <Reveal className="h-full sm:col-span-2 lg:row-span-2">
            <div className="flex h-full flex-col justify-between overflow-hidden rounded-md bg-ink-950 p-7 text-white">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur">
                  <Icon className="h-6 w-6">
                    <path d="M2 8l10-5 10 5-10 5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </Icon>
                </div>
                <h3 className="mb-2 text-2xl font-bold">Virtuele potjes</h3>
                <p className="max-w-md text-[0.9375rem] leading-relaxed text-ink-300">
                  Maak onbeperkt potjes per persoon, team of doel, allemaal op
                  dezelfde bankrekening. Geen extra IBAN, geen gedoe.
                </p>
              </div>
              {/* mini stacked pots */}
              <div className="mt-7 space-y-2.5">
                {[
                  { n: "Kantine", a: "€14.820", w: "78%", c: "bg-white" },
                  { n: "Jeugdwerking", a: "€9.640", w: "61%", c: "bg-white/70" },
                  { n: "Accommodatie", a: "€5.275", w: "44%", c: "bg-white/45" },
                ].map((p) => (
                  <div key={p.n} className="rounded-xl bg-white/10 p-3 backdrop-blur">
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-white">{p.n}</span>
                      <span className="font-num tabular-nums text-ink-300">{p.a}</span>
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
              <div className="group flex h-full flex-col rounded-lg border border-ink-300/80 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-ink-300 hover:shadow-xl hover:shadow-ink-900/10">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-ink-100 text-ink-700 transition group-hover:bg-ink-950 group-hover:text-white">
                  <Icon className="h-5 w-5">{f.icon}</Icon>
                </div>
                <h3 className="mb-1.5 text-base font-bold text-ink-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ink-700">{f.desc}</p>
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

function Pricing({ onSignup }: { onSignup: () => void }) {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="prijzen" className="scroll-mt-20 border-t border-ink-200 bg-white px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Simpel. Eerlijk. Transparant.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-ink-700 sm:text-lg">
              Start gratis. Betaal enkel als je meer nodig hebt. Geen verborgen
              kosten.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-start gap-x-3 gap-y-2 text-sm text-ink-700">
              <span>Maandelijks</span>
              <button
                onClick={() => setYearly((v) => !v)}
                className="relative h-6 w-11 rounded-full bg-ink-950 transition"
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
                    ? "border-in-100 bg-in-100 text-in-600"
                    : "border-uit-300 bg-uit-100 text-uit-700"
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

        <p className="mt-7 text-center text-sm text-ink-700">
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
  // De omgekeerde kaart krijgt altijd de witte knop, ongeacht wat de aanroeper
  // meegeeft: zwart op zwart is geen keuze. Buiten die kaart bepaalt ctaStyle
  // of het een gevulde knop of een omlijning is.
  const ctaClass = featured
    ? "bg-white text-ink-950 hover:bg-ink-100"
    : ctaStyle === "outline"
      ? "border border-ink-300 bg-white text-ink-900 hover:bg-ink-100"
      : "bg-ink-950 text-white hover:bg-ink-800";

  return (
    <div
      className={`relative flex h-full flex-col rounded-md p-6 sm:p-8 ${
        featured
          ? "bg-ink-950 text-white md:-my-4 md:py-12"
          : "border border-ink-200 bg-white"
      }`}
    >
      {featured && (
        <div className="mb-4 inline-flex self-start rounded-full bg-white/15 px-2.5 py-0.5 text-[0.75rem] font-medium text-white">
          Meest gekozen
        </div>
      )}
      <div
        className={`mb-2 text-[0.8125rem] font-medium ${featured ? "text-ink-300" : "text-ink-700"}`}
      >
        {name}
      </div>
      {/* Vaste hoogte op het prijsblok, zodat de kenmerkenlijsten van de drie
          kaarten op dezelfde hoogte beginnen. Zonder dat schuiven ze uit elkaar
          zodra één omschrijving een regel langer is. */}
      <div className="min-h-[6.5rem]">
        <div
          className={`mb-1 font-num text-[2.25rem] font-semibold leading-none [letter-spacing:-0.03em] ${
            featured ? "text-white" : "text-ink-900"
          }`}
        >
          {price}
          {priceSuffix && (
            <span
              className={`ml-1.5 text-base font-medium ${featured ? "text-ink-300" : "text-ink-700"}`}
            >
              {priceSuffix}
            </span>
          )}
        </div>
        <p
          className={`mt-2 text-sm leading-snug ${featured ? "text-ink-300" : "text-ink-700"}`}
        >
          {desc}
        </p>
      </div>
      <hr className={`mb-5 border-t ${featured ? "border-white/15" : "border-ink-200"}`} />
      <ul className="mb-6 flex-1 space-y-3">
        {features.map((f) => (
          <li
            key={f.text}
            className={`flex items-start gap-2.5 text-sm ${
              featured
                ? f.no
                  ? "text-ink-400"
                  : "text-ink-100"
                : f.no
                  ? "text-ink-600"
                  : "text-ink-800"
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {f.no ? (
                <Icon className={`h-4 w-4 ${featured ? "text-ink-400" : "text-ink-500"}`}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                </Icon>
              ) : (
                <Icon className={`h-4 w-4 ${featured ? "text-in-400" : "text-in-600"}`}>
                  <path d="M20 6 9 17l-5-5" />
                </Icon>
              )}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      {note && (
        <p className="mb-4 text-xs leading-relaxed text-ink-600">{note}</p>
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

function Faq() {
  /**
   * Dit is geen algemene FAQ meer maar de bezwarenlijst. In een club beslist
   * zelden één persoon: de penningmeester is enthousiast, de voorzitter vraagt
   * of we er niet aan vastzitten. Deze vijf vragen zijn wat er in dat gesprek
   * echt gesteld wordt, in de volgorde waarin ze gesteld worden.
   *
   * De laatste vraag is waar "Waar staan we nu?" naartoe is verhuisd. Eerlijk
   * zijn over hoe vroeg Kaspio is werkt, maar alleen op de plek waar de lezer
   * er zelf aan denkt. Als losse sectie halverwege de pagina was het een
   * waarschuwing zonder aanleiding.
   */
  const items = [
    {
      q: "Waar staat onze data en wie kan erbij?",
      a: "Op Europese servers, bij Supabase in Frankfurt. Alleen de mensen die jij uitnodigt kunnen bij de cijfers van jouw organisatie, en de databank dwingt dat af, niet alleen het scherm. Een potbeheerder ziet zijn eigen posten en niets anders.",
    },
    {
      q: "Wat als we stoppen, krijgen we alles mee?",
      a: "Ja, op elk moment en zonder te vragen. Elk potje en elk overzicht is exporteerbaar naar Excel, CSV of PDF. Je zit nooit vast: wat je erin stopt komt er in hetzelfde formaat weer uit.",
    },
    {
      q: "Wat kost het volgend jaar?",
      a: "Wat het dit jaar kost. Gratis blijft gratis, en aan de prijs van een betaald plan verandert niets tijdens je lopende periode. Gaat de prijs voor nieuwe klanten omhoog, dan verhuis je niet automatisch mee.",
    },
    {
      q: "Wie van ons kan wat zien en wijzigen?",
      a: "Je kiest per persoon. Een beheerder ziet alles. Een groepsbeheerder ziet zijn comité of tak, inclusief wat er later bij komt. Een potbeheerder ziet één post. En een lezer ziet alles maar wijzigt niets, wat handig is voor een voorzitter of een revisor.",
    },
    {
      q: "En als jij ermee stopt?",
      a: "Eerlijk: Kaspio is jong en wordt door een kleine ploeg gebouwd. Daarom is de exportknop er vanaf dag één en niet als belofte. Zou Kaspio morgen verdwijnen, dan heb je je volledige boekhouding in Excel binnen een minuut, en ben je niet verder van huis dan waar je vandaan kwam.",
    },
  ];

  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-ink-50 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] font-bold leading-[1.1] text-ink-900 [letter-spacing:-0.02em]">
              Wat je bestuur gaat vragen
            </h2>
            <p className="prose-kaspio mt-4 text-base leading-relaxed text-ink-700">
              De penningmeester is meestal snel overtuigd. De voorzitter stelt
              deze vijf vragen.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="mt-12 max-w-3xl overflow-hidden rounded-lg border border-ink-300/80 bg-white">
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={it.q} className={i > 0 ? "border-t border-ink-200" : ""}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-base font-semibold text-ink-900 transition hover:text-ink-700"
                    aria-expanded={isOpen}
                  >
                    <span>{it.q}</span>
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 text-lg leading-none text-ink-700 transition-transform duration-200 ${
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
                      <p className="px-6 pb-5 text-sm leading-relaxed text-ink-700">
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
  /**
   * Het slot van de pagina, niet een banner ergens in het midden.
   *
   * Wat hier weg is en waarom: dit was een zwarte doos met een radius van 32px
   * en een groen kleurverloop erin, zwevend op een lichte pagina. Zo'n los
   * donker blok leest als een plakfout, en het groen was decoratie in een
   * systeem waar groen "geld erin" betekent.
   *
   * Nu loopt het van rand tot rand door in de footer, zodat er precies één
   * donker gebied op de pagina is: de onderkant. Dat is geen willekeurige
   * sectie meer maar het einde van het document.
   *
   * Links de vraag, rechts de knop. Gecentreerde koppen met een knop eronder
   * zijn de standaardvorm van elke afsluitende sectie; deze verdeling geeft de
   * pagina één laatste asymmetrie mee.
   */
  return (
    <section className="bg-ink-950 px-6 pb-16 pt-20 sm:pt-24">
      <div className="mx-auto grid max-w-6xl items-end gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="max-w-xl text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] font-bold leading-[1.1] text-white [letter-spacing:-0.02em]">
            Begin bij het comité waar je het minst zeker van bent
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-300">
            Eén tak invoeren kost een half uur. Daarna weet je of het klopt.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <button
            onClick={onSignup}
            className="rounded-md bg-white px-6 py-3 text-base font-semibold text-ink-950 transition-colors hover:bg-ink-100"
          >
            Gratis starten
          </button>
          <p className="text-[0.8125rem] text-ink-400">
            Geen kaart nodig. Export vanaf dag één.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 pb-8 pt-12 text-sm text-ink-300" style={{ backgroundColor: "var(--color-ink-950)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 pb-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-300">
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
            <a className="transition hover:text-ink-300" href="#">Privacybeleid</a>
            <a className="transition hover:text-ink-300" href="#">Gebruiksvoorwaarden</a>
            <a className="transition hover:text-ink-300" href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 font-num text-[11px] font-bold text-white">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a className="text-sm text-ink-300 transition hover:text-ink-300" href="#">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
