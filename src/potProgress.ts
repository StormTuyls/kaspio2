// =============================================================================
// Voortgang van een potje , spaardoel of uitgavenbudget
// =============================================================================
// Eén plek voor de rekensom, want zowel het overzicht als de potjesdetail tonen
// dezelfde balk. Liepen die uit elkaar, dan zag je twee percentages voor
// hetzelfde potje.
//
//   'saving' : saldodoel.   voortgang = saldo / doelbedrag
//   'budget' : uitgavenplafond. voortgang = uitgaven / |budget|
//
// Een negatief doelbedrag is toegestaan. Bij een spaardoel betekent dat een
// doelsaldo onder nul: saldo en doel hebben dan hetzelfde teken, dus de deling
// geeft nog steeds een oplopend percentage. Bij een budget gebruiken we het
// absolute bedrag, zodat "500" en "-500" hetzelfde budget beschrijven.
// =============================================================================

import type { PotTargetKind } from "./types";
import { formatEuro } from "./storage";

export type PotProgress = {
  /** Werkelijk percentage. Kan boven 100 gaan bij overschrijding. */
  pct: number;
  /** Breedte van de balk, altijd tussen 0 en 100. */
  barPct: number;
  /** Label links van de balk, bv. "Budget: € 500,00". */
  label: string;
  /** Budget of doelsaldo voorbijgestoken in de verkeerde richting. */
  over: boolean;
  kind: PotTargetKind;
  /**
   * Alleen gevuld als er een prognose is die van het budget afwijkt. Het
   * verschil is waar een bestuur op stuurt: het budget staat vast, de prognose
   * schuift, en het gat ertussen is het nieuws.
   */
  forecast?: {
    amount: number;
    /** Prognose min budget. Positief = het gaat meer worden dan afgesproken. */
    delta: number;
    /** Waar de prognose op de balk staat, 0-100. */
    markerPct: number;
    label: string;
  };
};

export function potProgress(
  targetAmount: number | null | undefined,
  targetKind: PotTargetKind | undefined,
  amounts: { balance: number; totalOut: number },
  forecastAmount?: number | null,
): PotProgress | null {
  // 0 en null betekenen beide "geen doel ingesteld".
  if (targetAmount == null || !Number.isFinite(targetAmount) || targetAmount === 0) {
    return null;
  }

  if ((targetKind ?? "saving") === "budget") {
    const budget = Math.abs(targetAmount);
    const pct = (amounts.totalOut / budget) * 100;
    return {
      pct: Math.max(0, pct),
      barPct: clamp(pct),
      label: `Budget: ${formatEuro(budget)}`,
      over: amounts.totalOut > budget,
      kind: "budget",
      forecast: buildForecast(budget, forecastAmount, true),
    };
  }

  const pct = (amounts.balance / targetAmount) * 100;
  return {
    pct: Math.max(0, pct),
    barPct: clamp(pct),
    label: `Doel: ${formatEuro(targetAmount)}`,
    // Een spaardoel voorbijsteken is goed nieuws. Een doelsaldo onder nul
    // voorbijsteken niet: dan is het potje dieper in het rood gegaan dan
    // gepland.
    over: targetAmount < 0 && amounts.balance < targetAmount,
    kind: "saving",
    forecast: buildForecast(targetAmount, forecastAmount, false),
  };
}

/**
 * Prognose alleen tonen als ze er is én van het budget verschilt. Een prognose
 * gelijk aan het budget voegt niets toe en maakt de balk alleen drukker.
 */
function buildForecast(
  target: number,
  forecastAmount: number | null | undefined,
  useAbs: boolean,
): PotProgress["forecast"] {
  if (forecastAmount == null || !Number.isFinite(forecastAmount)) return undefined;
  const forecast = useAbs ? Math.abs(forecastAmount) : forecastAmount;
  const delta = forecast - target;
  if (Math.abs(delta) < 0.005) return undefined;
  return {
    amount: forecast,
    delta,
    markerPct: clamp(target === 0 ? 0 : (forecast / target) * 100),
    label: `Prognose: ${formatEuro(forecast)}`,
  };
}

function clamp(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}
