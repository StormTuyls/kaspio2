// =============================================================================
// Veld , label, hint en fout rond één invoer
// =============================================================================
// Er stonden vier bijna identieke `Field`-componenten in de app (TransactionForm,
// PotForm, AuthView, PasswordResetView) en die deelden alle vier dezelfde fout:
// de hint stond binnen het `<label>`. Voor een schermlezer is de toegankelijke
// naam van een veld alles wat in zijn label staat, dus "Potje" heette in
// werkelijkheid "Potje Weet je nog niet waarvoor het is? Kies 'Nog toe te
// wijzen', dan verdeel je het later." Bij elke focus opnieuw.
//
// Hier staat de hint buiten het label en hangt hij via `aria-describedby` aan de
// control. Naam is kort, beschrijving komt erna. Hetzelfde geldt voor de
// foutmelding: die krijgt `role="alert"` zodat hij ook echt voorgelezen wordt,
// en `aria-invalid` zodat de control zelf als fout gemarkeerd staat.
//
// Het sterretje is `aria-hidden` met een tekstalternatief ernaast: kleur en
// glyph alleen dragen geen betekenis over.
// =============================================================================

import { cloneElement, isValidElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

/** Attributen die we op de control zetten als die een echte control is. */
type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

type Props = {
  label: string;
  /** Blijvende toelichting onder het veld. Geen placeholder-vervanger. */
  hint?: string;
  /** Foutmelding bij dit veld. Verschijnt eronder en wordt aangekondigd. */
  fout?: string | null;
  required?: boolean;
  /** Vaste tekst links in het veld, bijvoorbeeld het euroteken. */
  prefix?: string;
  children: ReactNode;
};

const CONTROLS = new Set(["input", "select", "textarea"]);

export function Veld({ label, hint, fout, required, prefix, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const foutId = fout ? `${id}-fout` : undefined;
  const beschrijving = [foutId, hintId].filter(Boolean).join(" ") || undefined;

  const isControl =
    isValidElement(children) &&
    typeof children.type === "string" &&
    CONTROLS.has(children.type);

  const control = isControl
    ? cloneElement(children as ReactElement<ControlProps>, {
        id,
        "aria-describedby": beschrijving,
        "aria-invalid": fout ? true : undefined,
        required: required || (children as ReactElement<ControlProps>).props.required,
      })
    : children;

  const kop = (
    <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
      {label}
      {required && (
        <>
          <span aria-hidden className="text-fout-600">
            {" *"}
          </span>
          <span className="sr-only"> (verplicht)</span>
        </>
      )}
    </span>
  );

  const onder = (
    <>
      {fout && (
        <span id={foutId} role="alert" className="mt-1 block text-xs text-fout-600">
          {fout}
        </span>
      )}
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-zacht">
          {hint}
        </span>
      )}
    </>
  );

  const binnen = prefix ? (
    <span className="relative block">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zacht"
      >
        {prefix}
      </span>
      {control}
    </span>
  ) : (
    control
  );

  // Een echte control koppelen we expliciet met htmlFor/id. Is het geen control
  // maar een groepje knoppen (kleurkiezer, keuzeblokken), dan is `role="group"`
  // met een eigen label het juiste model: daar valt niets te labelen met `for`.
  if (isControl) {
    return (
      <div className="block">
        <label htmlFor={id}>{kop}</label>
        {binnen}
        {onder}
      </div>
    );
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={beschrijving}>
      <span id={`${id}-label`}>{kop}</span>
      {binnen}
      {onder}
    </div>
  );
}
