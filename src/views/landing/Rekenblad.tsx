import type { ReactNode } from "react";

/**
 * Het hart van de landingspagina: het rekenblad dat niet meer klopt.
 *
 * Waarom dit de plek van "Herken je dit?" en "In 3 stappen geregeld" inneemt:
 * die twee secties beweerden allebei iets. Deze laat het zien. Links het
 * probleem in de vorm waarin de lezer het zelf heeft, rechts hetzelfde in
 * Kaspio, en het verschil eronder in euro's.
 *
 * De data is verzonnen, de fout is echt. Het patroon komt uit een clubbestand
 * waar een comitétotaal met de hand uit zes celverwijzingen was opgebouwd en er
 * ooit één celverwijzing vergeten is. Die post viel daardoor een jaar lang
 * buiten het totaal zonder dat iemand het zag.
 *
 * Bewust geen screenshot maar echte HTML: scherp op elk scherm, volgt het
 * thema, en een schermlezer kan het lezen. De rechterkolom gebruikt dezelfde
 * lijstvorm als de app zelf, dus wat je hier ziet is wat je krijgt.
 */

type Post = {
  naam: string;
  bedrag: number;
  /** Deze regel is bij het opbouwen van de formule overgeslagen. */
  vergeten?: boolean;
};

// Verzonnen posten en verzonnen bedragen. Alleen de fóut is echt: een
// subtotaal dat met de hand uit celverwijzingen is opgebouwd en waar er ooit
// één van vergeten is. Bewust posten die elke vereniging heeft, zodat het
// voorbeeld nergens naar één club te herleiden is.
const POSTEN: Post[] = [
  { naam: "Zaalhuur", bedrag: -12480.0 },
  { naam: "Poetsdienst", bedrag: -8145.6 },
  { naam: "Nutsvoorzieningen", bedrag: -5230.75 },
  { naam: "Klein materiaal", bedrag: -3918.4 },
  { naam: "Varia / onvoorzien", bedrag: -1876.25, vergeten: true },
];

const euro = (n: number) =>
  new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 2 }).format(Math.abs(n));

const totaalKaspio = POSTEN.reduce((s, p) => s + p.bedrag, 0);
const totaalRekenblad = POSTEN.filter((p) => !p.vergeten).reduce((s, p) => s + p.bedrag, 0);
const verschil = totaalRekenblad - totaalKaspio;

export function Rekenblad() {
  return (
    <section id="rekenblad" className="scroll-mt-20 bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] font-bold leading-[1.1] text-ink-900 [letter-spacing:-0.02em]">
            Het rekenblad klopt niet meer,
            <br className="hidden sm:block" /> en niemand weet sinds wanneer
          </h2>
          <p className="prose-kaspio mt-4 text-base leading-relaxed text-ink-700">
            Een clubkas in Excel begint netjes. Dan komt er een post bij, wordt
            een subtotaal met de hand uitgebreid, en gaat er ooit één
            celverwijzing verloren. Vanaf dat moment klopt de vergadering niet
            meer met de bank, en zoek je een avond naar een verschil dat er al
            een jaar in zit.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
          <Kolom
            label="In het rekenblad"
            hint="subtotaal met de hand opgebouwd"
          >
            <table className="w-full border-collapse text-[0.8125rem]">
              <caption className="sr-only">
                Een comité in een rekenblad, met een subtotaal dat
                één regel overslaat
              </caption>
              <thead>
                <tr className="text-ink-600">
                  <th scope="col" className="w-8 border border-ink-200 bg-ink-50 px-2 py-1 text-left font-num text-[0.6875rem] font-normal">
                    A
                  </th>
                  <th scope="col" className="border border-ink-200 bg-ink-50 px-2 py-1 text-left font-num text-[0.6875rem] font-normal">
                    B
                  </th>
                  <th scope="col" className="border border-ink-200 bg-ink-50 px-2 py-1 text-right font-num text-[0.6875rem] font-normal">
                    C
                  </th>
                </tr>
              </thead>
              <tbody>
                {POSTEN.map((p, i) => (
                  <tr key={p.naam} className={p.vergeten ? "bg-uit-100" : undefined}>
                    <td className="border border-ink-200 px-2 py-1.5 font-num text-[0.6875rem] text-ink-600">
                      {i + 2}
                    </td>
                    <td className="border border-ink-200 px-2 py-1.5 text-ink-800">
                      {p.naam}
                    </td>
                    <td className="border border-ink-200 px-2 py-1.5 text-right font-num text-ink-800">
                      −{euro(p.bedrag)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="border border-ink-200 px-2 py-1.5 font-num text-[0.6875rem] text-ink-600">
                    7
                  </td>
                  <td className="border border-ink-200 px-2 py-2 font-semibold text-ink-900">
                    TOTAAL
                    <span className="mt-0.5 block font-num text-[0.6875rem] font-normal text-ink-600">
                      =C2+C3+C4+C5
                    </span>
                  </td>
                  <td className="border border-ink-200 px-2 py-2 text-right font-num font-semibold text-ink-900">
                    −{euro(totaalRekenblad)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3 flex items-start gap-2 text-[0.8125rem] leading-snug text-uit-700">
              <span aria-hidden className="mt-[0.35rem] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-uit-600" />
              <span>
                Rij 6 staat niet in de formule. Varia is ooit toegevoegd nadat
                het subtotaal al bestond.
              </span>
            </p>
          </Kolom>

          {/* Op mobiel geen pijl maar een streep, want naast elkaar wordt
              onder elkaar en dan wijst een pijl naar rechts nergens heen. */}
          <div
            aria-hidden
            className="flex items-center justify-center py-1 lg:h-full lg:py-0"
          >
            <span className="h-px w-12 bg-ink-300 lg:h-16 lg:w-px" />
          </div>

          <Kolom label="In Kaspio" hint="het totaal is de som, altijd">
            <ul className="border-t border-ink-200">
              {POSTEN.map((p) => (
                <li
                  key={p.naam}
                  className="flex items-baseline justify-between gap-4 border-b border-ink-200 py-2.5 text-[0.875rem]"
                >
                  <span className="min-w-0 truncate text-ink-800">{p.naam}</span>
                  <span className="font-num whitespace-nowrap text-uit-600">
                    −{euro(p.bedrag)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between gap-4 pt-3 text-[0.9375rem] font-semibold">
              <span className="text-ink-900">Totaal</span>
              <span className="font-num text-uit-600">−{euro(totaalKaspio)}</span>
            </div>

            <ol className="mt-5 space-y-1.5 border-t border-ink-200 pt-4 text-[0.8125rem] text-ink-700">
              {[
                "Je importeert je bankafschrift.",
                "Je wijst elke regel toe aan een post.",
                "Het totaal volgt vanzelf.",
              ].map((stap, i) => (
                <li key={stap} className="flex gap-2.5">
                  <span aria-hidden className="font-num text-ink-500">
                    {i + 1}
                  </span>
                  {stap}
                </li>
              ))}
            </ol>
          </Kolom>
        </div>

        <div className="mt-10 border-t border-ink-200 pt-8 sm:mt-12">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5">
            <p className="font-num text-[clamp(2.25rem,1.6rem+2.6vw,3.5rem)] font-semibold leading-none text-ink-900 [letter-spacing:-0.03em]">
              {euro(verschil)}
            </p>
            <p className="max-w-sm text-base leading-snug text-ink-700">
              euro die een jaar lang nergens stond, in één comité.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kolom({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-[0.9375rem] font-semibold text-ink-900">{label}</h3>
        <span className="text-[0.75rem] text-ink-600">{hint}</span>
      </div>
      <div className="rounded-md border border-ink-200 p-4">{children}</div>
    </div>
  );
}
