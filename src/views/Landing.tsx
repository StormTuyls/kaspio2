import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Mark } from "../components/Logo";
import { useForceLight } from "../theme";

// Scroll-reveal: observeert alle .reveal-elementen en zet .is-in zodra ze
// in beeld komen (eenmalig). Respecteert prefers-reduced-motion via CSS.
function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (els.length === 0) return;
    // Pas nu JS draait de hide-default activeren (anders blijft content zichtbaar).
    document.documentElement.classList.add("reveal-ready");
    const io = new IntersectionObserver(
      (entries, obs) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            obs.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// =============================================================================
// Warm & menselijk landing-palet (verfrist t.o.v. het koele SaaS-grijs).
// Cream-canvas + zachte randen + diep bosgroen voor donkere vlakken. De teal/
// amber-merkkleuren blijven, maar in een warmere context. Tailwind-arbitrary
// waarden zodat de redesign landing-scoped blijft.
// =============================================================================
// Subtiele warm-white i.p.v. een uitgesproken cream (cream-bg is dé AI-tell).
// Warmte komt nu uit de serif-typografie + teal/amber accenten, niet de bg.
const CREAM = "#FCFBF9"; // near-white, vleugje warm
const CREAM_SOFT = "#F6F4EF"; // subtiele warme tint voor afwisselende secties
const LINE = "#E8E5DF"; // warm-grijze rand, niet geel
const FOREST = "#0C3A30"; // diep bosgroen voor ingezette donkere panelen

type Props = {
  onLogin: () => void;
  onSignup: () => void;
  /** Toont een terug-naar-app balk wanneer een ingelogde user de site bekijkt. */
  onExitPreview?: () => void;
};

export function Landing({ onLogin, onSignup, onExitPreview }: Props) {
  useForceLight();
  useScrollReveal();
  return (
    <div className="min-h-screen text-ink" style={{ backgroundColor: CREAM }}>
      {onExitPreview && <PreviewBar onExit={onExitPreview} />}
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} />
      <BetaStatus />
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

function PreviewBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-ink px-4 py-2 text-center text-xs text-white">
      <span className="text-white/70">Je bekijkt de Kaspio-website.</span>
      <button
        onClick={onExit}
        className="rounded-full bg-white/15 px-3 py-1 font-semibold text-white transition hover:bg-white/25"
      >
        ← Terug naar de app
      </button>
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark size={32} variant={light ? "light" : "default"} />
      <span
        className={`text-xl font-extrabold tracking-tight ${
          light ? "text-white" : "text-[#0F6E56]"
        }`}
      >
        Kaspio
      </span>
    </span>
  );
}

function Header({ onLogin, onSignup }: Props) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{ borderColor: LINE, backgroundColor: "rgba(251,246,238,0.82)" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted md:flex">
          <a href="#hoe" className="transition hover:text-[#0F6E56]">Hoe het werkt</a>
          <a href="#functies" className="transition hover:text-[#0F6E56]">Functies</a>
          <a href="#prijzen" className="transition hover:text-[#0F6E56]">Prijzen</a>
          <a href="#faq" className="transition hover:text-[#0F6E56]">FAQ</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onLogin}
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-black/5 hover:text-ink sm:inline-flex"
          >
            Inloggen
          </button>
          <button
            onClick={onSignup}
            className="rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-600"
          >
            Gratis starten
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-14 sm:pt-20">
      {/* Warme, zachte gloed rechtsboven achter het asset */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-160px] top-[-140px] h-[620px] w-[760px] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(239,159,39,0.20), rgba(29,158,117,0.10) 55%, transparent 80%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:gap-12">
        {/* Tekst links (gecentreerd op mobiel) */}
        <div className="hero-rise text-center lg:text-left">
          <div
            className="mb-6 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-1.5 text-xs font-semibold text-[#0F6E56]"
            style={{ borderColor: LINE }}
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Gemaakt in België voor clubs en verenigingen
          </div>

          <h1 className="font-display text-balance text-[2.75rem] font-semibold leading-[1.02] text-ink sm:text-6xl lg:text-[4.25rem]">
            Eén rekening,
            <br />
            overzicht voor{" "}
            <span className="text-teal-600">iedereen</span>
          </h1>

          <p className="mx-auto mt-6 max-w-md text-pretty text-lg leading-relaxed text-ink-muted lg:mx-0">
            Verdeel het geld op jullie bankrekening in virtuele potjes, per
            persoon, ploeg of doel. Geen extra rekeningen, geen Excel-gepuzzel.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button
              onClick={onSignup}
              className="w-full rounded-full bg-teal-500 px-7 py-3.5 text-base font-bold text-white shadow-[0_10px_28px_-10px_rgba(29,158,117,0.65)] transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-teal-600 active:translate-y-0 active:scale-[0.98] sm:w-auto"
            >
              Gratis starten →
            </button>
            <a
              href="#hoe"
              className="w-full rounded-full border bg-white px-7 py-3.5 text-base font-semibold text-ink transition duration-200 ease-out hover:-translate-y-0.5 hover:border-teal-300 active:translate-y-0 active:scale-[0.98] sm:w-auto"
              style={{ borderColor: LINE }}
            >
              Bekijk hoe het werkt
            </a>
          </div>
          <p className="mt-5 text-sm text-ink-light">
            Gratis · geen kaart nodig · klaar in een paar minuten
          </p>
        </div>

        {/* Mockup rechts, licht overhangend, eigen entrance */}
        <div className="hero-rise-asset relative lg:-mr-6 xl:-mr-16">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}

function HeroMockup() {
  const pots = [
    { name: "Alle potjes", amount: "€8.240", color: "bg-teal-500", active: true },
    { name: "Kamp 2026", amount: "€3.200", color: "bg-[#8b5cf6]" },
    { name: "Materiaal", amount: "€1.800", color: "bg-teal-500" },
    { name: "Kantine", amount: "€920", color: "bg-amber-500" },
    { name: "Sponsoring", amount: "€1.980", color: "bg-[#2289f5]" },
    { name: "Onkosten", amount: "€340", color: "bg-rose-500" },
  ];

  return (
    <div
      className="overflow-hidden rounded-3xl border bg-white shadow-[0_24px_70px_-24px_rgba(12,58,48,0.35)]"
      style={{ borderColor: LINE }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-3"
        style={{ borderColor: LINE, backgroundColor: CREAM }}
      >
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span
          className="mx-auto rounded-md px-3 py-0.5 text-xs text-ink-light"
          style={{ backgroundColor: CREAM_SOFT }}
        >
          app.kaspio.be/dashboard
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr]">
        <aside
          className="hidden flex-col border-r py-3 sm:flex"
          style={{ borderColor: LINE, backgroundColor: CREAM }}
        >
          <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-light">
            Potjes
          </div>
          {pots.map((p) => (
            <SidebarRow key={p.name} {...p} />
          ))}
        </aside>
        <div className="p-5">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="Totaal saldo" value="€8.240" />
            <StatCard label="Deze maand in" value="€2.150" />
            <StatCard label="Deze maand uit" value="€870" amber />
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{ borderColor: LINE }}
          >
            <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-light">
              Recente activiteit
            </div>
            <Txn initials="OP" initialsBg="bg-teal-100 text-teal-700" title="Ouders kamp" from="Kamp 2026" tag="inkomst" amount="+€450" amountClass="text-teal-700" />
            <Txn initials="DC" initialsBg="bg-amber-100 text-amber-700" title="Decathlon" from="Materiaal" tag="uitgave" amount="−€120" amountClass="text-amber-700" />
            <Txn initials="SP" initialsBg="bg-teal-100 text-teal-700" title="Sponsor Bouwbedrijf" from="Sponsoring" tag="inkomst" amount="+€500" amountClass="text-teal-700" last />
          </div>
        </div>
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
      className={`mx-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition ${
        active ? "bg-white font-semibold text-[#0F6E56] shadow-sm" : "text-ink hover:bg-white/60"
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
    <div className="rounded-2xl border p-3" style={{ borderColor: LINE, backgroundColor: CREAM }}>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className={`text-lg font-bold tabular-nums ${amber ? "text-amber-700" : "text-[#0F6E56]"}`}>
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
      className={`flex items-center gap-3 py-2.5 text-xs ${last ? "" : "border-b"}`}
      style={last ? undefined : { borderColor: LINE }}
    >
      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${initialsBg}`}>
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{title}</div>
        <div className="text-[11px] text-ink-muted">{from}</div>
      </div>
      <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 sm:inline-block">
        {tag}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${amountClass}`}>{amount}</span>
    </div>
  );
}

function BetaStatus() {
  return (
    <section className="px-6">
      <div
        className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-4 rounded-2xl border px-6 py-5 text-center sm:flex-row sm:gap-8"
        style={{ borderColor: LINE, backgroundColor: "#fff" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
          </span>
          <span className="text-sm font-semibold text-[#0F6E56]">Nu in gesloten bèta</span>
        </div>
        <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: LINE }} aria-hidden />
        <span className="text-sm text-ink-muted">Je data blijft exporteerbaar</span>
        <span className="hidden h-4 w-px sm:block" style={{ backgroundColor: LINE }} aria-hidden />
        <span className="text-sm text-ink-muted">Geen bank-schrijfrechten</span>
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
    <section className="px-6 py-24">
      <div
        className="mx-auto max-w-6xl rounded-3xl px-6 py-16 sm:px-12"
        style={{ backgroundColor: FOREST }}
      >
        <h2 className="font-display text-balance text-3xl font-semibold text-white sm:text-[2.5rem] sm:leading-[1.1]">
          Herken je dit?
        </h2>
        <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg">
          Alles komt op één rekening binnen, maar niemand weet van wie, voor
          wie, of hoeveel er nog over is.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {issues.map((it) => (
            <div
              key={it.title}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07] sm:p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/15">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F0C36B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {it.icon}
                </svg>
              </div>
              <h3 className="mb-2 text-base font-bold text-white">{it.title}</h3>
              <p className="text-sm leading-relaxed text-white/55">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  sub,
  center = true,
}: {
  /** Behouden in de API maar niet meer getoond: eyebrow-op-elke-sectie is een AI-tell. */
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={`reveal ${center ? "text-center" : ""}`}>
      <h2 className="font-display text-balance text-3xl font-semibold text-ink sm:text-[2.5rem] sm:leading-[1.1]">
        {title}
      </h2>
      {sub && (
        <p className={`mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg ${center ? "mx-auto" : ""}`}>
          {sub}
        </p>
      )}
    </div>
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
    <section id="hoe" className="scroll-mt-20 px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Hoe het werkt"
          title="In 3 stappen geregeld"
          sub="Kaspio is geen boekhoudprogramma. Het is een simpele tool die overzicht geeft waar jij dat wil."
        />
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              {i < steps.length - 1 && (
                <div
                  className="absolute left-12 top-6 hidden h-0.5 w-full md:block"
                  style={{ background: "linear-gradient(to right, #EF9F27, transparent)" }}
                />
              )}
              <div
                className="relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-lg font-extrabold text-white"
                style={{ boxShadow: "0 0 0 8px rgba(29,158,117,0.12)" }}
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
    <section
      id="functies"
      className="scroll-mt-20 px-6 py-24"
      style={{ backgroundColor: CREAM_SOFT }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Functies"
          title={
            <>
              Alles wat je nodig hebt,
              <br />
              niets wat je niet nodig hebt
            </>
          }
        />
        <div className="mt-14 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const warm = i % 3 === 1;
            return (
              <div
                key={f.title}
                className="rounded-2xl border bg-white p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(12,58,48,0.3)]"
                style={{ borderColor: LINE }}
              >
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${
                    warm ? "bg-amber-100" : "bg-teal-100"
                  }`}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={warm ? "#BA7517" : "#0F6E56"}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    { initials: "AB", title: "Artiestenbureau's", desc: "Beheer honoraria en royalties per artiest op één rekening" },
    { initials: "SC", title: "Sportclubs", desc: "Ledenbijdragen, sponsoring en kantine, elk in eigen potje" },
    { initials: "JB", title: "Jeugdbewegingen", desc: "Kamp, werking en materiaal transparant bijhouden" },
    { initials: "VZ", title: "VZW's", desc: "Subsidies en donaties direct koppelen aan projecten" },
    { initials: "CT", title: "Creatieve teams", desc: "Film, muziek en events, budgetbeheer zonder boekhouder" },
    { initials: "KB", title: "Kleine bedrijven", desc: "Inkomsten per project of divisie bijhouden zonder extra rekening" },
  ];
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Voor wie"
          title="Voor elk type organisatie"
          sub="Van jeugdbeweging tot managementbureau, als je inkomsten beheert voor meerdere mensen of doelen, is Kaspio voor jou."
        />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cases.map((c, i) => (
            <div
              key={c.title}
              className="rounded-2xl border bg-white p-5 text-center transition hover:-translate-y-1"
              style={{ borderColor: LINE }}
            >
              <div
                className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-sm font-extrabold ${
                  i % 2 === 0 ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
                }`}
              >
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

function Pricing({ onSignup }: { onSignup: () => void }) {
  const [yearly, setYearly] = useState(false);

  return (
    <section
      id="prijzen"
      className="scroll-mt-20 px-6 py-24"
      style={{ backgroundColor: CREAM_SOFT }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Prijzen"
          title="Eerlijk en simpel"
          sub="Start gratis. Betaal pas als je meer nodig hebt. Geen verborgen kosten."
        />

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
            cta="Gratis starten"
            ctaStyle="outline"
            onClick={onSignup}
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
            cta="Kies Pro"
            ctaStyle="fill"
            onClick={onSignup}
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
            cta="Kies Team"
            ctaStyle="amber"
            onClick={onSignup}
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
    outline: "border bg-white text-ink hover:border-teal-500 hover:text-teal-700",
    fill: "bg-teal-500 text-white hover:bg-teal-600",
    amber: "bg-amber-500 text-white hover:bg-amber-600",
  }[ctaStyle];

  return (
    <div
      className={`relative rounded-3xl bg-white p-6 sm:p-8 ${
        featured ? "shadow-[0_20px_60px_-24px_rgba(29,158,117,0.45)]" : ""
      }`}
      style={{
        border: featured ? "2px solid #1D9E75" : `1px solid ${LINE}`,
      }}
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
          <span className="ml-1 text-base font-medium text-ink-muted">{priceSuffix}</span>
        )}
      </div>
      <p className="mb-5 text-sm leading-snug text-ink-muted">{desc}</p>
      <hr className="mb-5" style={{ borderColor: LINE }} />
      <ul className="space-y-3">
        {features.map((f) => (
          <li
            key={f.text}
            className={`flex items-start gap-2.5 text-sm ${f.no ? "text-ink-light" : "text-ink"}`}
          >
            <span className={`mt-0.5 flex-shrink-0 font-bold ${f.no ? "text-ink-light" : "text-teal-500"}`}>
              {f.no ? "·" : "✓"}
            </span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={`mt-6 w-full rounded-full py-3 text-sm font-bold transition ${ctaClass}`}
        style={ctaStyle === "outline" ? { borderColor: LINE } : undefined}
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
      title: "Gesloten beta",
      desc: "Eerste gebruikers zijn binnen. Inkomsten en uitgaven loggen, potjes aanmaken, rolgebaseerd delen. Gratis te starten.",
    },
    {
      label: "Volgende",
      title: "Feedback verwerken",
      desc: "In gesprek met scouts, sportclubs, artiestenbureaus en VZW's. Hun feedback bepaalt wat we eerst bouwen.",
    },
    {
      label: "Daarna",
      title: "Publieke launch",
      desc: "Voor iedereen open zodra de beta-feedback is verwerkt. PSD2-bankkoppeling en exports volgen.",
    },
  ];
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Build in public"
          title="Waar staan we nu?"
          sub="Kaspio is jong en eerlijk daarover. Hier is precies wat we doen, wat er komt en wanneer je iets kunt verwachten."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {status.map((s, i) => (
            <div
              key={s.title}
              className="rounded-2xl border bg-white p-7"
              style={{ borderColor: LINE }}
            >
              <span
                className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  i === 0 ? "bg-teal-100 text-teal-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                {s.label}
              </span>
              <h3 className="mb-2 text-lg font-bold text-ink">{s.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-ink-muted">
          Wil je meebouwen? Maak een account aan, ik neem graag 20 minuten de
          tijd om te horen hoe jullie het vandaag aanpakken.
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
    <section id="faq" className="scroll-mt-20 px-6 py-24" style={{ backgroundColor: CREAM_SOFT }}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Veelgestelde vragen" title="Alles wat je wil weten" />
        <div className="mt-12 space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div
                key={it.q}
                className="overflow-hidden rounded-2xl border bg-white"
                style={{ borderColor: LINE }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold text-ink transition hover:text-teal-700"
                >
                  <span>{it.q}</span>
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg text-teal-700 transition-transform ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted">{it.a}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="px-6 py-24">
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12"
        style={{ backgroundColor: FOREST }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-80px] top-[-80px] h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(239,159,39,0.45), transparent)" }}
        />
        <h2 className="font-display relative mb-4 text-balance text-3xl font-semibold text-white sm:text-[2.75rem] sm:leading-[1.08]">
          Klaar om orde te scheppen in jullie kas?
        </h2>
        <p className="relative mx-auto mb-8 max-w-xl text-lg text-white/70">
          Maak gratis een account aan en zet je eerste potjes op in een paar
          minuten.
        </p>
        <button
          onClick={onSignup}
          className="relative rounded-full bg-amber-500 px-8 py-3.5 text-base font-bold text-ink shadow-[0_12px_30px_-10px_rgba(239,159,39,0.7)] transition duration-200 hover:-translate-y-0.5 hover:bg-amber-400 active:translate-y-0 active:scale-[0.98]"
        >
          Gratis starten →
        </button>
        <p className="relative mt-4 text-xs text-white/50">
          ✓ Geen kaart nodig &nbsp; ✓ Klaar in minuten &nbsp; ✓ Elk moment opzegbaar
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 pb-8 pt-14 text-sm text-white/60" style={{ backgroundColor: "#1a1714" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 pb-12 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
              Virtueel potjesbeheer voor iedereen die inkomsten op één rekening
              transparant wil verdelen. Gemaakt in België.
            </p>
          </div>
          <FooterCol title="Product" links={["Functies", "Prijzen", "Demo", "Roadmap", "Changelog"]} />
          <FooterCol
            title="Gebruik"
            links={["Sportclubs", "Jeugdbewegingen", "Artiestenbureaus", "VZW's", "Enterprise"]}
          />
          <FooterCol title="Bedrijf" links={["Over ons", "Blog", "Contact", "Pers", "Vacatures"]} />
        </div>
        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Kaspio BV. Alle rechten voorbehouden.</span>
          <div className="flex gap-5">
            <a className="transition hover:text-amber-300" href="#">Privacybeleid</a>
            <a className="transition hover:text-amber-300" href="#">Gebruiksvoorwaarden</a>
            <a className="transition hover:text-amber-300" href="#">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-white">{title}</h4>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l}>
            <a className="text-sm text-white/55 transition hover:text-amber-300" href="#">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
