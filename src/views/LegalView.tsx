import type { ReactNode } from "react";
import { Wordmark } from "../components/Logo";

// =============================================================================
// LegalView , publieke juridische pagina's (/privacy en /voorwaarden)
// =============================================================================
// LET OP (voor Storm, niet voor bezoekers): dit is een degelijke basistekst,
// geen sluitend juridisch advies. Vul de [placeholders] in (zetel,
// ondernemingsnummer, bevoegde rechtbank) en laat dit nakijken door een jurist
// voor je er hard op leunt. Contactadres staat nu op stormtuyls@icloud.com;
// overweeg een privacy@kaspio.be.
// =============================================================================

const LAST_UPDATED = "29 juni 2026";
const CONTACT_EMAIL = "stormtuyls@icloud.com";

function Section({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-24">
      <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" aria-label="Naar Kaspio home">
            <Wordmark />
          </a>
          <a href="/" className="text-sm font-medium text-indigo-600 transition hover:text-indigo-700">
            Terug naar Kaspio
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Laatst bijgewerkt: {LAST_UPDATED}</p>
        {children}
        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Vragen? Mail{" "}
          <a className="text-indigo-600 hover:text-indigo-700" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </main>
    </div>
  );
}

function Privacy() {
  return (
    <Shell title="Privacybeleid">
      <Section title="Wie zijn we">
        <p>
          Kaspio is een dienst van Kaspio BV, gevestigd te [maatschappelijke zetel], België,
          ondernemingsnummer [ondernemingsnummer]. Voor vragen over dit beleid of je gegevens kun
          je ons bereiken via <a className="text-indigo-600 hover:text-indigo-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Wij zijn de verwerkingsverantwoordelijke voor de gegevens die je in Kaspio invoert.
        </p>
      </Section>

      <Section title="Kaspio is geen bank">
        <p>
          Belangrijk: Kaspio heeft geen toegang tot je bankrekening en verplaatst geen geld. Je
          koppelt geen rekening. Je voert zelf transacties in of importeert een CSV-bestand van je
          bank. Kaspio is een overzichtslaag die jouw eigen cijfers in virtuele potjes verdeelt.
        </p>
      </Section>

      <Section title="Welke gegevens we verwerken">
        <p>We verwerken alleen wat nodig is om de dienst te leveren:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Accountgegevens: je naam en e-mailadres.</li>
          <li>Organisatiegegevens die jij invoert: potjes, transacties, bedragen, tegenpartij, memo's en eventuele bijlagen.</li>
          <li>Gebruiks- en logbestandsgegevens die nodig zijn voor beveiliging en het oplossen van fouten.</li>
          <li>Facturatiegegevens bij een betaald abonnement, verwerkt via onze betaalprovider.</li>
        </ul>
      </Section>

      <Section title="Waarvoor en op welke grond">
        <p>
          We gebruiken je gegevens om de dienst te leveren en je account te beheren (uitvoering van
          de overeenkomst), om te factureren bij een betaald plan (wettelijke en contractuele
          verplichting), voor support en beveiliging (gerechtvaardigd belang) en voor optionele
          e-mailmeldingen (op basis van je instellingen). We verkopen je gegevens niet en gebruiken
          ze niet voor advertenties.
        </p>
      </Section>

      <Section title="Verwerkers die we inschakelen">
        <p>Om Kaspio te laten werken schakelen we een beperkt aantal verwerkers in:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase: database en authenticatie (gehost in de EU).</li>
          <li>Vercel: hosting van de website en applicatie.</li>
          <li>Stripe: verwerking van betalingen bij een betaald abonnement.</li>
          <li>Resend: verzenden van e-mails (uitnodigingen en meldingen).</li>
          <li>Plausible en Vercel Analytics: bezoekersstatistieken, zonder profilering.</li>
        </ul>
        <p>Met deze partijen werken we onder verwerkersovereenkomsten en passende waarborgen.</p>
      </Section>

      <Section title="Waar je gegevens staan">
        <p>
          Je gegevens worden opgeslagen binnen de Europese Unie. Waar een verwerker gegevens buiten
          de EU zou verwerken, gebeurt dat onder passende waarborgen (zoals de standaard
          contractbepalingen van de Europese Commissie).
        </p>
      </Section>

      <Section title="Hoe lang we bewaren">
        <p>
          We bewaren je gegevens zolang je account actief is. Na verwijdering van je account of
          organisatie wissen we de bijbehorende gegevens binnen een redelijke termijn, behoudens wat
          we wettelijk moeten bewaren (bijvoorbeeld facturatiegegevens).
        </p>
      </Section>

      <Section title="Beveiliging">
        <p>
          Toegang tot gegevens is per organisatie afgeschermd op databaseniveau (row level
          security) en verkeer verloopt versleuteld. Geen enkel systeem is volledig risicovrij, maar
          we nemen passende technische en organisatorische maatregelen.
        </p>
      </Section>

      <Section title="Jouw rechten">
        <p>
          Je hebt recht op inzage, correctie, verwijdering, beperking, overdraagbaarheid en bezwaar.
          Stuur je verzoek naar <a className="text-indigo-600 hover:text-indigo-700" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          Ben je het oneens met hoe we met je gegevens omgaan, dan kun je klacht indienen bij de
          Gegevensbeschermingsautoriteit (gegevensbeschermingsautoriteit.be).
        </p>
      </Section>

      <Section title="Cookies" id="cookies">
        <p>
          Kaspio gebruikt geen advertentie- of trackingcookies. We bewaren enkel wat nodig is om je
          aangemeld te houden (een sessie in de lokale opslag van je browser). Onze
          bezoekersstatistieken (Plausible) werken zonder cookies. Vercel Analytics meet prestaties
          zonder je te profileren.
        </p>
      </Section>

      <Section title="Wijzigingen">
        <p>
          We kunnen dit beleid bijwerken. Bij belangrijke wijzigingen brengen we je op de hoogte via
          de app of per e-mail. De datum bovenaan geeft de laatste wijziging aan.
        </p>
      </Section>
    </Shell>
  );
}

function Terms() {
  return (
    <Shell title="Gebruiksvoorwaarden">
      <Section title="Over deze voorwaarden">
        <p>
          Deze voorwaarden gelden voor het gebruik van Kaspio, een dienst van Kaspio BV
          ([ondernemingsnummer], [maatschappelijke zetel], België). Door een account aan te maken of
          Kaspio te gebruiken ga je akkoord met deze voorwaarden.
        </p>
      </Section>

      <Section title="Wat Kaspio is, en niet is">
        <p>
          Kaspio is een hulpmiddel om de inkomsten en uitgaven op je bestaande bankrekening in
          virtuele potjes te verdelen en op te volgen. Kaspio is geen bank, geen betaaldienst, geen
          boekhoudsoftware en geeft geen financieel, fiscaal of juridisch advies. Je blijft zelf
          verantwoordelijk voor je echte bankrekening en je financiële administratie.
        </p>
      </Section>

      <Section title="Je account">
        <p>
          Je geeft correcte gegevens op en houdt je inloggegevens geheim. Je bent verantwoordelijk
          voor wat er onder je account gebeurt. Breng ons op de hoogte bij misbruik.
        </p>
      </Section>

      <Section title="Toegestaan gebruik">
        <p>
          Gebruik Kaspio niet voor onwettelijke doeleinden, niet om de dienst te misbruiken of te
          ontwrichten, en niet om de rechten van anderen te schenden. We mogen accounts die de
          voorwaarden schenden opschorten.
        </p>
      </Section>

      <Section title="Abonnementen en betaling">
        <p>
          Kaspio biedt een gratis plan en betaalde plannen (Pro en Team). Betaalde abonnementen
          worden per maand of per jaar afgerekend via onze betaalprovider Stripe. Je kunt op elk
          moment opzeggen; je behoudt dan toegang tot het einde van de lopende periode. Tenzij anders
          vermeld doen we geen pro rata terugbetalingen. Prijzen kunnen wijzigen; lopende periodes
          blijven aan de afgesproken prijs.
        </p>
      </Section>

      <Section title="Je gegevens">
        <p>
          De gegevens die je invoert blijven van jou. We verwerken ze volgens ons{" "}
          <a className="text-indigo-600 hover:text-indigo-700" href="/privacy">privacybeleid</a>. Je
          kunt je gegevens exporteren (CSV en PDF).
        </p>
      </Section>

      <Section title="Beschikbaarheid">
        <p>
          We doen ons best om Kaspio beschikbaar en correct te houden, maar leveren de dienst zoals
          ze is, zonder garantie op ononderbroken beschikbaarheid. Onderhoud of storingen kunnen de
          dienst tijdelijk beperken.
        </p>
      </Section>

      <Section title="Aansprakelijkheid">
        <p>
          Voor zover wettelijk toegestaan is onze aansprakelijkheid beperkt. Kaspio is een
          hulpmiddel: controleer belangrijke cijfers altijd tegen je echte bankrekening. We zijn niet
          aansprakelijk voor beslissingen die je op basis van de cijfers in Kaspio neemt.
        </p>
      </Section>

      <Section title="Beëindiging">
        <p>
          Je kunt je account op elk moment stopzetten. Wij kunnen een account beëindigen bij ernstige
          of herhaalde schending van deze voorwaarden. Bij beëindiging verwijderen we je gegevens
          conform het privacybeleid.
        </p>
      </Section>

      <Section title="Wijzigingen">
        <p>
          We kunnen deze voorwaarden bijwerken. Bij belangrijke wijzigingen brengen we je op de
          hoogte. Blijf je Kaspio gebruiken, dan aanvaard je de bijgewerkte voorwaarden.
        </p>
      </Section>

      <Section title="Toepasselijk recht">
        <p>
          Op deze voorwaarden is het Belgisch recht van toepassing. Geschillen worden voorgelegd aan
          de bevoegde rechtbanken van [bevoegde rechtbank, bv. Gent].
        </p>
      </Section>
    </Shell>
  );
}

export function LegalView({ page }: { page: "privacy" | "terms" }) {
  return page === "privacy" ? <Privacy /> : <Terms />;
}
