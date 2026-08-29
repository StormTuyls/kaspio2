# Design

Het visuele systeem van Kaspio. De tokens hieronder zijn de bron van waarheid en
staan één op één in `src/App.css`. Wijzig je hier iets, wijzig het daar ook, en
draai `python3 scripts/design/contrast.py` om te bewijzen dat het nog haalt.

## Theme

**Licht als standaard.** De scène in `PRODUCT.md` is een keukentafel op een
dinsdagavond, met een bankafschrift ernaast. Papierwerk, geen monitoring. Donker
bestaat en is volwaardig, maar het is de uitzondering, niet de houding.

Het oppervlak is **neutraal-koel**, niet warm. Bewust geen crème of zand: die
warme bijna-witte achtergrond is de verzadigde standaardkeuze geworden. De
neutralen hier hebben chroma 0.002 tot 0.014 richting hue 250, net genoeg om niet
dood grijs te zijn en te weinig om een kleur te lijken.

## Color

Strategie: **restrained**. Getinte neutralen plus betekeniskleur. Er is geen
merkkleur die overal opduikt.

De regel die het systeem draagt: **kleur betekent geld**. Groen is binnenkomend,
amber is uitgaand, rood is een fout. Al het interactieve is inkt: knoppen zijn
bijna zwart, links zijn inkt met een onderlijning, de focusring is inkt. Zo blijft
kleur voorbehouden aan data en hoeft de gebruiker nooit te leren wat een tint
betekent buiten "geld erin" en "geld eruit".

Groen/amber in plaats van groen/rood is geen smaak maar toegankelijkheid: zie
`PRODUCT.md`. Rood is uitsluitend gereserveerd voor fouten en verwijderen.

### Tokens

Alle waarden in OKLCH, allemaal binnen sRGB-gamut (geen browser-gamutmapping, dus
wat gemeten is, is wat je ziet). De hex erachter is de weergave.

```
--color-paper     oklch(0.9930 0.0020 250)   #fcfdfe   pagina
--color-ink-50    oklch(0.9740 0.0030 250)   #f5f7f8   verhoogd vlak
--color-ink-100   oklch(0.9430 0.0045 250)   #eaecef   vulling, hover
--color-ink-200   oklch(0.8950 0.0060 250)   #d9dde0   haarlijn
--color-ink-300   oklch(0.8100 0.0080 250)   #bdc1c6   rand, scheiding
--color-ink-400   oklch(0.6600 0.0110 250)   #8d9399   uitgeschakeld
--color-ink-500   oklch(0.5560 0.0130 250)   #6e747b   placeholder    4.64:1
--color-ink-600   oklch(0.4700 0.0130 250)   #555c62   tertiair       6.67:1
--color-ink-700   oklch(0.3850 0.0130 250)   #3f444b   secundair      9.64:1
--color-ink-800   oklch(0.2950 0.0130 250)   #282d33   
--color-ink-900   oklch(0.2250 0.0130 250)   #171c22   hoofdtekst    16.82:1
--color-ink-950   oklch(0.1650 0.0140 250)   #0a0f14   primaire knop, donkere pagina

--color-in-700    oklch(0.4300 0.0940 162)   #015f3f
--color-in-600    oklch(0.5020 0.1090 162)   #047650   bedrag binnen  5.55:1
--color-in-500    oklch(0.6300 0.1350 162)   #11a26f
--color-in-400    oklch(0.7300 0.1200 162)   #56bf90   bedrag binnen, donker
--color-in-300    oklch(0.8300 0.0850 162)   #94d9b7
--color-in-100    oklch(0.9530 0.0300 162)   #dff6e9   badge-vulling

--color-uit-700   oklch(0.4500 0.1030 62)    #7d4601
--color-uit-600   oklch(0.5300 0.1200 62)    #9c5906   bedrag buiten  5.36:1
--color-uit-500   oklch(0.6600 0.1400 62)    #ce7c22
--color-uit-400   oklch(0.7600 0.1250 62)    #e99e58   bedrag buiten, donker
--color-uit-300   oklch(0.8500 0.0850 62)    #f7c294
--color-uit-100   oklch(0.9500 0.0330 70)    #fdebd7   badge-vulling

--color-fout-700  oklch(0.4400 0.1750 25)    #a01d23   fout, hover
--color-fout-600  oklch(0.5250 0.1900 25)    #c0242b   fout           5.84:1
--color-fout-400  oklch(0.7000 0.1600 25)    #f2716a   fout, donker
--color-fout-100  oklch(0.9450 0.0260 25)    #fee7e4
```

### De semantische laag

De trap hierboven is het palet. **Een component gebruikt hem niet rechtstreeks.**
Er zijn vier tekstrollen, en die draaien zelf mee met het thema:

```
text-sterk    hoofdtekst      licht ink-900   donker ink-100
text-basis    secundair       licht ink-700   donker ink-300
text-zacht    tertiair        licht ink-600   donker ink-400
text-zwak     placeholder     licht ink-500   donker ink-400
```

Schrijf `text-zacht`, niet `text-ink-600 dark:text-ink-500`. Dat laatste werkte,
maar iedereen koos zijn eigen paar: er stonden veertien verschillende
licht/donker-combinaties in de app voor vier rollen, en 228 daarvan zakten in
donkere modus onder 4.5:1 terwijl `contrast.py` "allemaal goed" meldde. Het
script mat het palet, niet het gebruik. Nu meet het allebei.

Waarom dit werkt: Tailwind v4 zendt een utility uit als
`color: var(--color-zacht)`, en `html.dark` herdefinieert die variabele. Eén
klasse, twee thema's, één plek waar donker gedefinieerd staat.

Uitzondering: vlakken die in **beide** thema's donker zijn (de bankkaart, de
zijbalk, de voettekst van de landing). Daar staat licht op donker in lichte
modus, dus daar horen de inkt-klassen wel rechtstreeks. `contrast.py` scant
daarom alleen de `dark:`-kant statisch; die kant is eenduidig. Voor de lichte
kant meet je op een echte pagina met `contrast-in-de-browser.js`.

Donker keert de inkt-ramp om: `ink-950` wordt de pagina, `ink-900` het verhoogde
vlak, `ink-100` de hoofdtekst. De geldkleuren schuiven naar de `-400`-trap.

**Potjeskleuren** zijn iets anders dan de palettokens hierboven. Een gebruiker
kiest zelf een kleur per potje, puur als herkenningsteken. Die kleur verschijnt
als één bolletje van 8px naast de naam en nergens anders. Nooit als vlak, nooit
als rand, nooit twee keer op hetzelfde element.

Heeft een potje geen eigen kleur, dan geldt `POT_KLEUR_STANDAARD` uit
`src/types.ts`. Eén constante, want die fallback stond op negen plaatsen en op
drie ervan anders: hetzelfde potje was groen in de zijbalk, indigo op het
dashboard en grijs in de transactielijst.

## Typography

Twee families, allebei met een reden.

**Instrument Sans** voor alles wat tekst is. Een grotesk met eigen karakter (de
`g`, de `R`, de licht smalle proporties), gebouwd voor interfaces, uitstekend op
13 en 14px. Bewust niet Inter: dat is de meest voorspelbare keuze die er is.

**JetBrains Mono** uitsluitend voor bedragen, datums en rekeningnummers. Niet
decoratief: in een kasboek moeten cijfers onder elkaar uitlijnen, en een
monospace maakt dat onvoorwaardelijk. De regel is scherp: **elk bedrag in de app
staat in `font-num`, zonder uitzondering.** Voorheen was dat lukraak, waardoor het
dashboard en de potjespagina er als twee producten uitzagen.

Geen derde familie. Hiërarchie komt uit gewicht en schaal, niet uit een display-font.

```
--font-sans: "Instrument Sans Variable"
--font-num:  "JetBrains Mono Variable"
```

Schaal (`clamp` waar het meebeweegt):

```
--text-display   clamp(2rem, 1.4rem + 2.6vw, 3.25rem)   700, -0.025em   landing h1
--text-title     clamp(1.5rem, 1.3rem + 0.9vw, 2rem)    650, -0.02em    pagina h1
--text-section   1.0625rem                              650, -0.01em    h2
--text-body      0.9375rem                              400             lopende tekst
--text-meta      0.8125rem                              450             secundair
--text-micro     0.75rem                                500             label
```

Letterafstand op display gaat nooit strakker dan -0.025em. `text-wrap: balance` op
koppen, `pretty` op lopende tekst, regellengte gemaximeerd op 68ch.

## Layout

**Lijnen, geen dozen.** De vorige versie wikkelde alles in een witte
`rounded-2xl` doos op een bijna-witte achtergrond, waardoor niets nog hiërarchie
had. Nu draagt uitlijning het werk: secties worden gescheiden door witruimte en
een haarlijn, niet door een rand rondom.

Een kaart (`.panel`) is toegestaan als het ding echt los staat van de leesrichting:
een dialoog, een neerklapmenu, een blok dat je kan verplaatsen. Niet voor
"een lijst met een kopje erboven".

Spacingschaal, met ritme in plaats van overal hetzelfde:

```
--space-1  0.25rem     binnen een label
--space-2  0.5rem      tussen verwante regels
--space-3  0.75rem
--space-4  1rem        binnen een blok
--space-6  1.5rem      tussen blokken
--space-10 2.5rem      tussen secties
--space-16 4rem        tussen paginadelen
```

Radius blijft klein: 8px standaard, 10px voor panelen, vol rond voor labels.
Nooit 24px of meer, dat leest als speelgoed.

Rasters zonder breekpunten waar het kan: `repeat(auto-fit, minmax(17rem, 1fr))`.

Breekpunten die er echt toe doen: 390 (telefoon), 768 (tablet, zijbalk verdwijnt),
1024 (zijbalk terug), 1440 (comfortabel), 1920+ (inhoud gecentreerd op max 90rem,
zodat een ultrabreed scherm geen regels van 200 tekens geeft).

### z-index

Een schaal, geen willekeurige getallen:

```
--z-dropdown 10
--z-sticky   20
--z-overlay  30
--z-modal    40
--z-toast    50
```

## Motion

Ingetogen en functioneel. Bewegingen zijn kort (120 tot 220ms), gaan over
`opacity` en `transform`, en gebruiken één curve: `--ease-out` =
`cubic-bezier(0.16, 1, 0.3, 1)`.

Wat weg is uit de vorige versie: de zwevende gloed-blobs achter de hero, de
aurora op het inlogscherm, de kleurverloop op een voortgangsbalk van 6px. Dat was
beweging zonder functie.

Wat blijft: de scroll-reveal op de landing (die maakt de leesvolgorde duidelijk),
en state-overgangen op knoppen en rijen.

Alles staat achter `@media (prefers-reduced-motion: reduce)`.

## Components

CSS-klassen in `src/App.css`:

| naam | rol |
|---|---|
| `.btn` + `.btn--primary/secondary/ghost/danger` | knoppen, 44px op touch, 36px vanaf `sm` |
| `.input` | invoer, 16px op touch zodat iOS niet inzoomt |
| `.panel` | los blok met rand, alleen waar het echt losstaat |
| `.rule` | haarlijn tussen secties |
| `.tag` + `.tag--in/uit/neutraal/fout` | statuslabel, gevuld met betekeniskleur |
| `.amount` + `.amount--in/uit` | bedrag: mono, tabular, teken altijd zichtbaar |
| `.titel` / `.sectiekop` / `.meta` / `.micro` | tekstrollen, h1 tot label |

React-componenten die een patroon dragen:

| naam | rol |
|---|---|
| `<Modal>` | dialoog: rol, naam, focusval, focus terug naar de opener |
| `<Veld>` | label, hint en fout rond één invoer, correct gekoppeld |
| `<Foutmelding>` | "dit ging mis", met `role="alert"` |

`<Veld>` bestaat omdat de hint eerder binnen het `<label>` stond. Voor een
schermlezer is dat de naam van het veld, dus "Potje" heette in werkelijkheid
"Potje Weet je nog niet waarvoor het is? Kies 'Nog toe te wijzen', dan verdeel
je het later." Bij elke focus opnieuw. De hint hangt er nu aan via
`aria-describedby`, waar hij hoort.

## Anti-patterns die hier verboden zijn

- Gekleurde zijstrepen op kaarten of rijen.
- Kleurverloop in tekst of op elementen kleiner dan 24px.
- Dezelfde informatie twee keer coderen (bolletje én streep in dezelfde kleur).
- Een kaart in een kaart.
- Een klein hoofdletterlabel met brede letterafstand boven elke sectie.
- Een `<button>` om een hele kaart heen: de toegankelijke naam wordt dan de hele
  inhoud. De naam is de link, de rest van de kaart is tekst.
- Een eigen licht/donker-paar kiezen waar `text-sterk/basis/zacht/zwak` bestaat.
- Betekeniskleur voor iets dat geen geld is. Groen was ook de markering van het
  actieve menu-item en van een broodkruimel-link; dan betekent groen niets meer.
  Rood was ook de kleur van een uitgaand bedrag, terwijl rood alleen fout is.
- Een hoverstaat die dezelfde waarde teruggeeft (`bg-in-600 hover:bg-in-600`).
  Er stonden er negentien, waaronder de hoofdknop van de landing en de
  inlogknop: die gaven bij aanwijzen geen enkel signaal.
- Mono op iets dat geen getal is. Een groepsnaam of een sectiekop in
  JetBrains Mono is hetzelfde kapstoklabel als een kleinkapitaal-kopje, alleen
  met een ander lettertype.
- Ruwe z-index-getallen. De schaal staat in `:root`; gebruik
  `z-[var(--z-sticky)]` en verwanten.
