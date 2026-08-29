// =============================================================================
// Foutmelding , één blok voor "dit ging mis"
// =============================================================================
// Dit blok stond twintig keer letterlijk overgeschreven in de app, elke keer
// zonder `role="alert"`. Voor een schermlezer betekende dat: je drukt op
// Opslaan, er verschijnt rood, en je hoort niets. De focus blijft op de knop,
// de tekst staat elders, en je merkt pas dat er iets misging als je terugtabt.
//
// Verder was de rand dezelfde kleur als de vulling (`border-fout-100
// bg-fout-100`), dus die deed niets, en op één plek na had geen enkele kopie
// een donkere variant: een bijna-witte roze doos midden op een donkere pagina.
//
// Hier staat het één keer, met de themavolgende tokens uit App.css.
// =============================================================================

import type { ReactNode } from "react";

export function Foutmelding({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg px-3 py-2 text-sm ${className}`}
      style={{
        background: "var(--fout-vlak)",
        color: "var(--fout)",
        boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--fout) 24%, transparent)",
      }}
    >
      {children}
    </div>
  );
}
