import { formatEuro } from "../storage";

/**
 * Eén bedrag. Dit is de enige plek in de app waar geld op het scherm komt.
 *
 * Twee regels die hier afgedwongen worden en die je nergens anders hoeft te
 * onthouden:
 *
 *   1. Cijfers staan in de mono met tabulaire cijfers, zodat kolommen
 *      uitlijnen zoals in een kasboek. Voorheen stond het dashboard in
 *      JetBrains Mono en de potjespagina in Inter, waardoor twee schermen
 *      naast elkaar op twee producten leken.
 *   2. Het teken staat er altijd expliciet bij. Kleur is nooit het enige
 *      kanaal: ongeveer 8% van de mannelijke gebruikers ziet groen en amber
 *      niet zoals wij ze bedoelen, en die moet gewoon de min kunnen lezen.
 *
 * Kleur betekent hier geld, niet goed of slecht. Een grote uitgave is niet
 * fout, het is een uitgave. Rood blijft voorbehouden aan echte fouten.
 */
export function Bedrag({
  waarde,
  /** "altijd" zet ook een + voor positieve bedragen. Standaard alleen bij een min. */
  teken = "auto",
  /** false = inkt in plaats van de geldkleuren, voor totalen die geen richting hebben. */
  gekleurd = true,
  className = "",
}: {
  waarde: number;
  teken?: "auto" | "altijd";
  gekleurd?: boolean;
  className?: string;
}) {
  // Afronding op centen voordat we het teken bepalen, anders krijgt -0,004 een
  // min terwijl er "€ 0,00" op het scherm staat.
  const centen = Math.round(waarde * 100);
  const negatief = centen < 0;
  const nul = centen === 0;

  const kleur = !gekleurd || nul
    ? "text-ink-900 dark:text-ink-100"
    : negatief
      ? "text-uit-600 dark:text-uit-400"
      : "text-in-600 dark:text-in-400";

  const voorvoegsel = negatief ? "−" : teken === "altijd" && !nul ? "+" : "";

  return (
    <span className={`font-num whitespace-nowrap ${kleur} ${className}`}>
      {voorvoegsel}
      {formatEuro(Math.abs(waarde))}
    </span>
  );
}
