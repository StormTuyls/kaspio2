# Landingspagina, herstructurering

Datum: 2026-08-29
Status: goedgekeurd in gesprek, implementatie gestart voor de spec-review op
uitdrukkelijke vraag ("begin met implementeren, ik wil een design zien").

## Waarom

De pagina telt elf secties in de standaardvolgorde van elke SaaS-landing. Er
komt nauwelijks bezoek. De echte functie van de pagina is nu niet conversie uit
koud verkeer, maar **een verkoopmiddel voor het eerste gesprek met een club**:
de lezer is warm, vrijwilliger, sceptisch, en moet het misschien nog uitleggen
aan een bestuur.

Elf secties zijn in die situatie geen kracht maar onderhoudsschuld. Elke sectie
is een belofte die waar moet blijven.

## Randvoorwaarde: versmallen moet later goedkoop zijn

Het is nog niet beslist of Kaspio zich richt op clubs met comités of breed
blijft. Daarom mag doelgroeptaal op **precies één plek** staan: de onderregel
van de hero. Versmallen is dan één zin wijzigen in plaats van vier secties
uitkammen. Dit is de reden dat `UseCases` verdwijnt en niet verhuist.

## Van elf secties naar zes

| nu | straks |
|---|---|
| Hero | **Hero**, met de vertrouwensregels erin opgenomen |
| TrustStrip | op in Hero |
| Problem, "Herken je dit?" | vervangen: beweren wordt tonen |
| HowItWorks | op in Rekenblad |
| Features | **Rekenblad**, het nieuwe hart |
| UseCases | **Functies**, van negen tegels naar zes |
| Pricing | **Prijzen** |
| BuildInPublic | op in Bestuursvragen, als antwoord op "wat als jij stopt" |
| Faq | **Bestuursvragen** |
| FinalCta | **Slot** |
| Footer | **Footer** |

## Het bewijsstuk

Twee kolommen: links een rekenbladfragment met een subtotaalformule die één
regel overslaat, rechts dezelfde posten in Kaspio met het totaal dat wel klopt,
en het verschil eronder.

Verzonnen data, echte fout. Het patroon komt uit een echt klantbestand
(`TOTAALKOST ONDERHOUD =E42+E47+E51+E67+E98+E61`, waar één post buiten de
formule viel), maar er wordt geen klant genoemd en geen club verzonnen: alleen
een comité, zodat de lezer zijn eigen club invult.

Echte HTML, geen screenshot: scherp, themabewust, leesbaar voor een
schermlezer. De rechterkolom gebruikt de lijststijl uit de app zelf, dus wat je
ziet is wat je krijgt.

## De bento

Negen tegels worden zes. "Virtuele potjes" verdwijnt als tegel (dat is het
product, niet een functie ervan), import en labelen worden één, bijlagen en
export worden één, meldingen gaan eruit. De grote tegel wordt inkt: het paarse
verloop was een migratierestant uit het oude palet.

## De FAQ

Wordt de bezwarenlijst: "Wat je bestuur gaat vragen". Waar staat onze data, wat
als we stoppen, wat kost het volgend jaar, wie ziet wat, en wat als jij ermee
stopt.

## Code

`src/views/Landing.tsx` (1388 regels) wordt `src/views/landing/` met een bestand
per sectie en een `Landing.tsx` die ze alleen opsomt. Dat 1388-regelbestand is
de reden dat deze herordening niet eerder gebeurde.

## Controle

Build, typecheck, `scripts/design/contrast.py`, schermafdrukken op 390, 768 en
1440 in licht en donker, inhoud zichtbaar zonder JavaScript, en geen enkel oud
kleurtoken meer.
