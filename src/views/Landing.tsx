type Props = {
  onLogin: () => void;
  onSignup: () => void;
};

export function Landing({ onLogin, onSignup }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <Header onLogin={onLogin} onSignup={onSignup} />
      <Hero onSignup={onSignup} />
      <Problem />
      <Features />
      <HowItWorks />
      <Pricing onSignup={onSignup} />
      <FinalCta onSignup={onSignup} />
      <Footer />
    </div>
  );
}

function Header({ onLogin, onSignup }: Props) {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">Potjesbeheer</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
          <a href="#features" className="hover:text-gray-900">Functies</a>
          <a href="#hoe" className="hover:text-gray-900">Hoe het werkt</a>
          <a href="#prijzen" className="hover:text-gray-900">Prijzen</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="text-sm font-semibold text-gray-700 hover:text-gray-900">
            Inloggen
          </button>
          <button onClick={onSignup} className="btn-primary">
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
      <div className="mx-auto max-w-6xl px-6 py-24 text-center sm:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Geen extra bankrekeningen nodig
        </div>
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Eén rekening,
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
            duizend potjes overzicht.
          </span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600">
          Verdeel inkomsten transparant over virtuele potjes per persoon, project of team. Iedere
          beheerder ziet wat er binnenkomt — zonder boekhoudsoftware, zonder Excel-chaos.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={onSignup} className="btn-primary px-6 py-3 text-base">
            Probeer 30 dagen gratis →
          </button>
          <a href="#hoe" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
            Bekijk hoe het werkt
          </a>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Check /> Geen creditcard nodig
          </span>
          <span className="flex items-center gap-1.5">
            <Check /> Klaar in 2 minuten
          </span>
          <span className="flex items-center gap-1.5">
            <Check /> Onbeperkt potjes tijdens proefperiode
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 -bottom-8 -z-10 h-64 bg-gradient-to-t from-indigo-100/40 to-transparent" />
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-rose-600">
              Het probleem
            </p>
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              Eén rekening, geen overzicht
            </h2>
            <p className="text-gray-600">
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
      icon: (
        <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8zM9 8V6a3 3 0 0 1 6 0v2" />
      ),
    },
    {
      title: "Rolgebaseerd",
      desc: "Admins zien alles, potjesbeheerders enkel het hunne. Iedereen heeft de juiste blik.",
      icon: <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />,
    },
    {
      title: "Saldo over tijd",
      desc: "Live grafieken per potje. Snel zien wanneer en hoe iets binnenkomt of weggaat.",
      icon: <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />,
    },
    {
      title: "Per transactie context",
      desc: "Bedrag, datum, tegenpartij en memo. Niets meer raden waar een betaling vandaan komt.",
      icon: <path d="M9 12h6M9 16h6M14 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10l-6-6zM14 4v6h6" />,
    },
    {
      title: "Voor elke groep",
      desc: "Sportclub, vzw, artiestenmanagement, freelancer, jeugdbeweging. Niet bank-, niet boekhoudsoftware.",
      icon: <path d="M17 20h5v-2a3 3 0 0 0-5.4-1.8M2 20h5v-2a3 3 0 0 1 5.4-1.8M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM6 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM18 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />,
    },
    {
      title: "Privé en lokaal",
      desc: "Tijdens de bèta blijven je gegevens in je browser. Komt later: cloudsync via PSD2.",
      icon: <path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4zM9 12l2 2 4-4" />,
    },
  ];

  return (
    <section id="features" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Functies
          </p>
          <h2 className="text-3xl font-bold text-gray-900">Alles wat je nodig hebt</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                  {f.icon}
                </svg>
              </div>
              <h3 className="mb-1 font-semibold text-gray-900">{f.title}</h3>
              <p className="text-sm text-gray-600">{f.desc}</p>
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
      desc: "Eén minuut: e-mail, wachtwoord, naam van je organisatie. Klaar.",
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
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Hoe het werkt
          </p>
          <h2 className="text-3xl font-bold text-gray-900">Klaar in drie stappen</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-200 p-6">
              <div className="mb-3 text-3xl font-extrabold text-indigo-600/30">{s.n}</div>
              <h3 className="mb-2 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="text-sm text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ onSignup }: { onSignup: () => void }) {
  return (
    <section id="prijzen" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Prijzen
          </p>
          <h2 className="text-3xl font-bold text-gray-900">Eenvoudig en eerlijk</h2>
          <p className="mt-2 text-sm text-gray-500">Geen verplichtingen. Stop wanneer je wil.</p>
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
            features={[
              "Onbeperkt potjes",
              "Onbeperkt leden",
              "CSV-export",
              "Saldo-grafieken",
              "E-mailmeldingen",
            ]}
            cta="14 dagen proberen"
            onClick={onSignup}
          />
          <Plan
            name="Vereniging"
            price="€19"
            priceSuffix="/maand"
            features={[
              "Alles van Team",
              "Meerdere admins",
              "Audit log",
              "Whitelabeling",
              "Prioritaire support",
            ]}
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
      className={`rounded-2xl border p-6 ${
        highlighted
          ? "border-indigo-500 bg-white shadow-lg ring-1 ring-indigo-500"
          : "border-gray-200 bg-white"
      }`}
    >
      {highlighted && (
        <div className="mb-3 inline-block rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white">
          Populair
        </div>
      )}
      <h3 className="mb-1 text-lg font-bold text-gray-900">{name}</h3>
      <div className="mb-4 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold text-gray-900">{price}</span>
        {priceSuffix && <span className="text-sm text-gray-500">{priceSuffix}</span>}
        {tag && <span className="ml-2 text-xs text-gray-500">{tag}</span>}
      </div>
      <ul className="mb-6 space-y-2 text-sm text-gray-600">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-500"><Check /></span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className={highlighted ? "btn-primary w-full" : "btn-secondary w-full"}
      >
        {cta}
      </button>
    </div>
  );
}

function FinalCta({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 px-8 py-14 text-center text-white shadow-xl">
        <h2 className="mb-3 text-3xl font-bold">Klaar om je potjes onder controle te krijgen?</h2>
        <p className="mb-8 text-indigo-100">
          Begin nu. Je eerste organisatie is gratis aangemaakt in twee minuten.
        </p>
        <button
          onClick={onSignup}
          className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
        >
          Maak gratis account aan →
        </button>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-gray-500 sm:flex-row">
        <span>© {new Date().getFullYear()} Potjesbeheer. Bèta — gegevens lokaal opgeslagen.</span>
        <div className="flex gap-5">
          <a href="#" className="hover:text-gray-900">Privacy</a>
          <a href="#" className="hover:text-gray-900">Voorwaarden</a>
          <a href="#" className="hover:text-gray-900">Contact</a>
        </div>
      </div>
    </footer>
  );
}

function PainPoint({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3">
      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
      <span className="text-gray-700">{children}</span>
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
