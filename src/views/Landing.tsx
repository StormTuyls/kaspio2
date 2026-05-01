type Props = {
  onLogin: () => void;
  onSignup: () => void;
};

export function Landing({ onLogin, onSignup }: Props) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} />
      <Logos />
      <Problem />
      <Features />
      <DashboardPreview />
      <HowItWorks />
      <Pricing onSignup={onSignup} />
      <FinalCta onSignup={onSignup} />
      <Footer />
    </div>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900">
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-mint-500 ring-2 ring-white" />
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round">
          <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-navy-900">Potly</span>
    </span>
  );
}

function Header({ onLogin, onSignup }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-navy-100/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm font-medium text-navy-500 md:flex">
          <a href="#features" className="hover:text-navy-900">Functies</a>
          <a href="#hoe" className="hover:text-navy-900">Hoe het werkt</a>
          <a href="#prijzen" className="hover:text-navy-900">Prijzen</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="hidden text-sm font-semibold text-navy-700 hover:text-navy-900 sm:block">
            Inloggen
          </button>
          <button onClick={onSignup} className="btn-accent">
            Gratis starten
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[480px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(47,191,113,0.16),transparent_60%),radial-gradient(50%_50%_at_80%_30%,rgba(77,163,255,0.18),transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-1 text-xs font-semibold text-navy-700 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
              Bèta — gratis tijdens het lanceringsjaar
            </div>
            <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-navy-900 sm:text-5xl lg:text-6xl">
              Eén rekening,
              <br />
              <span className="bg-gradient-to-r from-mint-500 to-azure-500 bg-clip-text text-transparent">
                volledig overzicht.
              </span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-navy-500">
              Beheer al je inkomende geldstromen vanuit één bankrekening, met duidelijke potjes en
              volledige transparantie voor elk teamlid.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <button onClick={onSignup} className="btn-accent px-6 py-3 text-base">
                Probeer 30 dagen gratis →
              </button>
              <a href="#hoe" className="text-sm font-semibold text-navy-700 hover:text-navy-900">
                Bekijk hoe het werkt
              </a>
            </div>
            <ul className="mt-8 grid grid-cols-1 gap-2 text-sm text-navy-500 sm:grid-cols-3">
              <li className="flex items-center gap-1.5"><Check /> Geen creditcard nodig</li>
              <li className="flex items-center gap-1.5"><Check /> Klaar in 2 minuten</li>
              <li className="flex items-center gap-1.5"><Check /> Onbeperkt potjes</li>
            </ul>
          </div>

          <div className="lg:col-span-5">
            <HeroDashboardCard />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroDashboardCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[36px] bg-gradient-to-br from-mint-500/15 to-azure-500/15 blur-2xl" />
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint-400" />
          </div>
          <span className="text-xs font-medium text-navy-400">app.potly.be</span>
          <span />
        </div>
        <div className="space-y-4 bg-canvas p-5">
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-400">
              Totaal saldo
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-navy-900">€ 12.480</span>
              <span className="text-sm font-semibold text-mint-600">+€ 1.320 deze week</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {[
              { name: "Tournee 2026", owner: "Jan J.", balance: "€ 5.230", pct: 65 },
              { name: "Sportclub kas", owner: "Marie P.", balance: "€ 3.150", pct: 40 },
              { name: "Project Cyclus", owner: "Anke V.", balance: "€ 4.100", pct: 82 },
            ].map((p) => (
              <div key={p.name} className="card flex items-center gap-4 p-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-sm font-semibold text-navy-700">
                  {p.owner[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-navy-900">{p.name}</span>
                    <span className="text-sm font-bold text-navy-900">{p.balance}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                      <div className="h-full rounded-full bg-mint-500" style={{ width: `${p.pct}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-navy-400">{p.owner}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Logos() {
  const groups = [
    "Sportclubs",
    "Jeugdbewegingen",
    "Vzw's",
    "Artiestenmanagement",
    "Freelancers",
    "Productiehuizen",
  ];
  return (
    <section className="border-y border-navy-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6 text-xs font-semibold uppercase tracking-wider text-navy-400">
        <span className="text-navy-500">Gemaakt voor:</span>
        {groups.map((g) => (
          <span key={g}>{g}</span>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-canvas py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-rose-600">
              Het probleem
            </p>
            <h2 className="mb-4 text-3xl font-bold text-navy-900">
              Eén rekening, geen overzicht
            </h2>
            <p className="text-navy-500">
              Of je nu een artiestenmanagement, sportclub, jeugdbeweging of kleine onderneming
              runt: alles komt binnen op één rekening. Wie het geld beheert, raakt het overzicht
              kwijt. Wie het verwacht, weet niet of het er al staat.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            <PainPoint>Excel-bestanden die niemand updatet</PainPoint>
            <PainPoint>Discussies wie waarvan recht heeft</PainPoint>
            <PainPoint>Boekhouder duurder dan nodig voor simpele splitsing</PainPoint>
            <PainPoint>Banktools tonen geen "voor wie" of "van wie"</PainPoint>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      title: "Virtuele potjes",
      desc: "Splits één rekening op in zoveel deelpotjes als je wil. Elk met eigen doel en eigenaar.",
      tone: "navy" as const,
      icon: (
        <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8zM9 8V6a3 3 0 0 1 6 0v2" />
      ),
    },
    {
      title: "Rolgebaseerd",
      desc: "Admins zien alles, potjesbeheerders enkel het hunne. Iedereen heeft de juiste blik.",
      tone: "azure" as const,
      icon: <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />,
    },
    {
      title: "Saldo over tijd",
      desc: "Live grafieken per potje. Zie wanneer en hoe geld binnenkomt of weggaat.",
      tone: "mint" as const,
      icon: <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />,
    },
    {
      title: "Per transactie context",
      desc: "Bedrag, datum, tegenpartij en memo. Niets meer raden waar een betaling vandaan komt.",
      tone: "navy" as const,
      icon: <path d="M9 12h6M9 16h6M14 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10l-6-6zM14 4v6h6" />,
    },
    {
      title: "Voor elke groep",
      desc: "Sportclub, vzw, artiestenmanagement, freelancer, jeugdbeweging.",
      tone: "azure" as const,
      icon: <path d="M17 20h5v-2a3 3 0 0 0-5.4-1.8M2 20h5v-2a3 3 0 0 1 5.4-1.8M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM6 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM18 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />,
    },
    {
      title: "Privé en lokaal",
      desc: "Tijdens de bèta blijven gegevens in je browser. Komt later: cloudsync via PSD2.",
      tone: "mint" as const,
      icon: <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zM9 12l2 2 4-4" />,
    },
  ];

  const toneClass: Record<"navy" | "mint" | "azure", string> = {
    navy: "bg-navy-50 text-navy-700",
    mint: "bg-mint-50 text-mint-700",
    azure: "bg-azure-50 text-azure-700",
  };

  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-mint-600">
            Functies
          </p>
          <h2 className="text-3xl font-bold text-navy-900 sm:text-4xl">
            Alles wat je nodig hebt om transparant te beheren
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[f.tone]}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                  {f.icon}
                </svg>
              </div>
              <h3 className="mb-1 font-semibold text-navy-900">{f.title}</h3>
              <p className="text-sm text-navy-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="bg-canvas py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-azure-600">
            Het dashboard
          </p>
          <h2 className="text-3xl font-bold text-navy-900">
            Eén interface, drie types blik
          </h2>
          <p className="mt-2 text-navy-500">
            Iedereen ziet exact wat hij of zij moet zien. Niets meer, niets minder.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Admin",
              desc: "Volledige controle: alle potjes, alle transacties, ledenbeheer en exports.",
              tone: "from-navy-900 to-navy-700",
              text: "text-white",
            },
            {
              title: "Potjesbeheerder",
              desc: "Eigen potje(s) met saldo, doelvoortgang en mogelijkheid om transacties toe te voegen.",
              tone: "from-mint-500 to-mint-700",
              text: "text-white",
            },
            {
              title: "Lezer",
              desc: "Read-only blik voor stakeholders die enkel mee willen kijken.",
              tone: "from-azure-400 to-azure-600",
              text: "text-white",
            },
          ].map((r) => (
            <div key={r.title} className={`rounded-2xl bg-gradient-to-br ${r.tone} p-6 ${r.text} shadow-sm`}>
              <h3 className="mb-2 text-lg font-bold">{r.title}</h3>
              <p className="text-sm opacity-90">{r.desc}</p>
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
      n: "01",
      title: "Maak je organisatie aan",
      desc: "Eén minuut: e-mail, wachtwoord, naam van je organisatie.",
    },
    {
      n: "02",
      title: "Voeg leden en potjes toe",
      desc: "Wijs een verantwoordelijke toe per potje. Stel optioneel een doelbedrag in.",
    },
    {
      n: "03",
      title: "Volg geldstromen live",
      desc: "Voeg in- en uitgaande transacties toe. Zie saldo, doelen en grafieken realtime.",
    },
  ];
  return (
    <section id="hoe" className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-navy-700">
            Hoe het werkt
          </p>
          <h2 className="text-3xl font-bold text-navy-900">Klaar in drie stappen</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card relative overflow-hidden p-6">
              <span className="absolute right-4 top-4 text-xs font-bold uppercase tracking-widest text-navy-200">
                Stap
              </span>
              <div className="mb-3 text-4xl font-extrabold text-mint-500">{s.n}</div>
              <h3 className="mb-2 text-lg font-semibold text-navy-900">{s.title}</h3>
              <p className="text-sm text-navy-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onSignup }: { onSignup: () => void }) {
  return (
    <section id="prijzen" className="bg-canvas py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-mint-600">
            Prijzen
          </p>
          <h2 className="text-3xl font-bold text-navy-900">Eenvoudig en eerlijk</h2>
          <p className="mt-2 text-sm text-navy-500">Geen verplichtingen. Stop wanneer je wil.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <Plan
            name="Starter"
            price="Gratis"
            tag="tijdens bèta"
            features={["3 potjes", "1 admin", "Onbeperkte transacties", "Lokale opslag"]}
            cta="Begin gratis"
            onClick={onSignup}
          />
          <Plan
            name="Team"
            price="€4,99"
            priceSuffix="/maand"
            highlighted
            features={["Onbeperkt potjes", "Onbeperkt leden", "CSV-export", "Saldo-grafieken", "E-mailmeldingen"]}
            cta="14 dagen proberen"
            onClick={onSignup}
          />
          <Plan
            name="Vereniging"
            price="€19"
            priceSuffix="/maand"
            features={["Alles van Team", "Meerdere admins", "Audit log", "Whitelabeling", "Prioritaire support"]}
            cta="Contacteer ons"
            onClick={onSignup}
          />
        </div>
      </div>
    </section>
  );
}

function Plan({
  name,
  price,
  priceSuffix,
  tag,
  features,
  cta,
  onClick,
  highlighted,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  tag?: string;
  features: string[];
  cta: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        highlighted
          ? "relative rounded-2xl border-2 border-navy-900 bg-white p-6 shadow-xl"
          : "card p-6"
      }
    >
      {highlighted && (
        <div className="absolute -top-3 left-6 rounded-full bg-mint-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shadow">
          Populair
        </div>
      )}
      <h3 className="mb-1 text-lg font-bold text-navy-900">{name}</h3>
      <div className="mb-5 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-navy-900">{price}</span>
        {priceSuffix && <span className="text-sm text-navy-500">{priceSuffix}</span>}
        {tag && <span className="ml-2 text-xs text-navy-500">{tag}</span>}
      </div>
      <ul className="mb-6 space-y-2 text-sm text-navy-600">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-mint-500"><Check /></span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button onClick={onClick} className={highlighted ? "btn-primary w-full" : "btn-secondary w-full"}>
        {cta}
      </button>
    </div>
  );
}

function FinalCta({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="bg-white py-20">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-navy-900 px-8 py-14 text-center text-white shadow-xl">
        <div className="pointer-events-none absolute -inset-x-10 -top-32 h-72 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(47,191,113,0.35),transparent_70%)]" />
        <h2 className="relative mb-3 text-3xl font-bold sm:text-4xl">
          Klaar om je potjes onder controle te krijgen?
        </h2>
        <p className="relative mb-8 text-navy-100">
          Begin nu. Je eerste organisatie is gratis aangemaakt in twee minuten.
        </p>
        <button onClick={onSignup} className="btn-accent relative px-6 py-3 text-base">
          Maak gratis account aan →
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-navy-100 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-navy-500 sm:flex-row">
        <Logo />
        <span>© {new Date().getFullYear()} Potly. Bèta — gegevens lokaal opgeslagen.</span>
        <div className="flex gap-5">
          <a href="#" className="hover:text-navy-900">Privacy</a>
          <a href="#" className="hover:text-navy-900">Voorwaarden</a>
          <a href="#" className="hover:text-navy-900">Contact</a>
        </div>
      </div>
    </footer>
  );
}

function PainPoint({ children }: { children: string }) {
  return (
    <li className="card flex items-start gap-3 px-4 py-3">
      <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </span>
      <span className="text-navy-700">{children}</span>
    </li>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
