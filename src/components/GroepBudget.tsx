// =============================================================================
// Budget en prognose van een groep, in beeld
// =============================================================================
// De rekensom staat in groupProgress.ts; hier staat alleen hoe ze eruitziet.
// Dezelfde regel hangt op de groepenpagina (lijst én blokken), dus één
// component: drie kopieën van dezelfde balk gaan vroeg of laat drie
// verschillende percentages tonen.
//
// Het is een regel, geen doos. De groepenpagina is een document met haarlijnen,
// en een budgetkaartje onder elke comitékop zou daar veertien dozen in leggen.
//
// Kleur betekent geld, ook hier, precies zoals in PotCard: een spaardoel vult
// zich met geld dat binnenkomt (in-600), een budget met geld dat buitengaat
// (uit-600), en rood is de overschrijding. Massief, geen verloop: een verloop
// over een balk van 4px is onzichtbaar.
// =============================================================================

import { Bedrag } from "./Bedrag";
import { formatEuro } from "../storage";
import type { GroepBudget, GroepDoel, ProbleemPot } from "../groupProgress";

/**
 * Budget en doel van één groep, als één regel onder de groepskop.
 *
 * `probleemPotjes` hoort alleen meegegeven te worden als de potjes zelf niet in
 * beeld staan, dus bij een ingeklapte groep of in de blokkenweergave. Staan ze
 * er wel onder, dan wijst hun eigen rode percentage het al aan en zou deze lijst
 * dezelfde informatie een tweede keer coderen.
 */
export function GroepBudgetRegel({
  budget,
  doel,
  probleemPotjes = [],
  onSelectPot,
  /** In een blok staat de regel onder elkaar in plaats van naast elkaar. */
  gestapeld = false,
  className = "",
}: {
  budget: GroepBudget | null;
  doel: GroepDoel | null;
  probleemPotjes?: ProbleemPot[];
  onSelectPot?: (potId: string) => void;
  gestapeld?: boolean;
  className?: string;
}) {
  if (!budget && !doel) return null;
  return (
    <div
      className={`text-[0.8125rem] ${
        gestapeld
          ? "flex flex-col gap-1.5"
          : "flex flex-wrap items-baseline gap-x-5 gap-y-1"
      } ${className}`}
    >
      {budget && (
        <Meting
          label="Budget"
          plan={budget.budget}
          werkelijk={budget.uitgegeven}
          pct={budget.pct}
          barPct={budget.barPct}
          prognose={budget.prognose}
          verschil={budget.verschil}
          /* Positief verschil = duurder dan afgesproken, dus dat is het slechte
             nieuws bij een budget. */
          slechtBoven
          stand={budget.stand}
        />
      )}
      {doel && (
        <Meting
          label="Doel"
          plan={doel.doel}
          werkelijk={doel.saldo}
          pct={doel.pct}
          barPct={doel.barPct}
          prognose={doel.prognose}
          verschil={doel.verschil}
          /* Bij een spaardoel is te weinig het slechte nieuws, niet te veel. */
          slechtBoven={false}
          stand={doel.tekort ? "dreigt" : "ok"}
        />
      )}
      {probleemPotjes.length > 0 && (
        <ProbleemPotjes potjes={probleemPotjes} onSelectPot={onSelectPot} />
      )}
    </div>
  );
}

function Meting({
  label,
  plan,
  werkelijk,
  pct,
  barPct,
  prognose,
  verschil,
  slechtBoven,
  stand,
}: {
  label: string;
  plan: number;
  werkelijk: number;
  pct: number;
  barPct: number;
  prognose: number;
  verschil: number;
  slechtBoven: boolean;
  stand: "ok" | "dreigt" | "over";
}) {
  const overschreden = stand === "over";
  const budgetachtig = slechtBoven;
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-zacht">{label}</span>
      <Bedrag waarde={plan} gekleurd={false} className="text-[0.8125rem]" />

      <span
        className="hidden h-1 w-16 self-center overflow-hidden rounded-full bg-ink-200 sm:block dark:bg-ink-800"
        aria-hidden
      >
        <span
          className={`block h-full rounded-full ${
            overschreden ? "bg-fout-600" : budgetachtig ? "bg-uit-600" : "bg-in-600"
          }`}
          style={{ width: `${barPct}%` }}
        />
      </span>

      {/* Het plan staat links, hier staat wat er werkelijk gebeurd is. Het
          percentage alleen zou de vraag "hoeveel is dat dan" openlaten, en dat
          is precies het getal waar een penningmeester naar zoekt. */}
      <span
        className={`amount font-semibold ${
          overschreden ? "text-fout-600 dark:text-fout-400" : "text-sterk"
        }`}
      >
        {werkelijk < 0 ? "−" : ""}
        {formatEuro(Math.abs(werkelijk))}
      </span>
      <span
        className={`font-num ${
          overschreden ? "text-fout-600 dark:text-fout-400" : "text-zacht"
        }`}
      >
        {pct.toFixed(0)}%
      </span>

      {/* Alleen tonen als de prognose iets zegt. Een prognose gelijk aan het
          budget is geen nieuws en maakt de regel alleen langer. */}
      {Math.abs(verschil) >= 0.005 && (
        <span className="flex items-baseline gap-1.5">
          <span className="text-zacht">prognose</span>
          <Bedrag waarde={prognose} gekleurd={false} className="text-[0.8125rem]" />
          <Verschil bedrag={verschil} slechtBoven={slechtBoven} />
        </span>
      )}
    </span>
  );
}

/**
 * Het gat tussen prognose en plan. Dit is waar een bestuur op stuurt: het
 * budget staat vast, de prognose schuift, en het verschil is het nieuws.
 *
 * Het bedrag gaat hier niet door <Bedrag>: dat zet altijd zijn eigen
 * tekstkleur, en binnen een label hoort de kleur van het label te winnen. De
 * typografische regel blijft wel staan , `.amount` is dezelfde mono met
 * tabulaire cijfers, alleen zonder kleur.
 */
function Verschil({
  bedrag,
  slechtBoven,
}: {
  bedrag: number;
  slechtBoven: boolean;
}) {
  const slecht = slechtBoven ? bedrag > 0 : bedrag < 0;
  const woord = slechtBoven
    ? bedrag > 0
      ? "boven budget"
      : "onder budget"
    : bedrag < 0
      ? "tekort"
      : "boven doel";
  return (
    <span className={slecht ? "tag tag--uit" : "tag tag--neutraal"}>
      {/* Geen teken voor het bedrag: "boven budget" en "tekort" zeggen de
          richting al, en "−€ 1.500,00 tekort" laat je twee keer nadenken over
          welke kant het op gaat. */}
      <span className="amount font-semibold">{formatEuro(Math.abs(bedrag))}</span>
      <span className="font-medium">{woord}</span>
    </span>
  );
}

/**
 * De potjes achter een overschrijding, ergste eerst. Dit is het "dieper
 * zoeken": het verschijnt alleen als de groep niet meer ok staat en de potjes
 * zelf niet in beeld zijn, en dan meteen met de namen erbij.
 */
function ProbleemPotjes({
  potjes,
  onSelectPot,
  max = 3,
}: {
  potjes: ProbleemPot[];
  onSelectPot?: (potId: string) => void;
  max?: number;
}) {
  const getoond = potjes.slice(0, max);
  const rest = potjes.length - getoond.length;
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-zacht">Door</span>
      {getoond.map((p) => (
        <span key={p.pot.id} className="flex items-baseline gap-1.5">
          {onSelectPot ? (
            <button
              type="button"
              onClick={() => onSelectPot(p.pot.id)}
              className="max-w-[12rem] truncate font-medium text-basis underline-offset-4 hover:text-sterk hover:underline"
            >
              {p.pot.name}
            </button>
          ) : (
            <span className="max-w-[12rem] truncate font-medium text-basis">
              {p.pot.name}
            </span>
          )}
          {/* Eigen kleur, dus buiten <Bedrag> om: rood als het al gebeurd is,
              amber als het nog maar dreigt. Zelfde mono, zelfde tabulaire
              cijfers via .amount. */}
          <span
            className={`amount text-[0.75rem] font-semibold ${
              p.stand === "over"
                ? "text-fout-600 dark:text-fout-400"
                : "text-uit-600 dark:text-uit-400"
            }`}
          >
            +{formatEuro(p.overschrijding)}
          </span>
        </span>
      ))}
      {rest > 0 && <span className="text-zacht">+ {rest} meer</span>}
    </span>
  );
}
