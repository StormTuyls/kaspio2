# Product

## Register

product

## Users

Vrijwillige penningmeesters van Belgische clubs, verenigingen en VZW's. Sportclubs,
scouts, artiestenbureaus. Geen boekhouders: mensen die dit erbij doen.

De scène die alles stuurt: een penningmeester van een tennisclub, aan de
keukentafel, dinsdagavond in november na de training. Laptop open, bankafschrift
ernaast, kop thee. Hij is geen financieel professioneel. Hij is licht ongerust dat
de cijfers niet kloppen en dat hij dat op de algemene vergadering moet uitleggen.
Hij wil klaar zijn.

Daar volgen twee dingen uit. Het is **licht**, want dit is papierwerk, geen
nachtelijk monitoring-scherm. En het moet **af** voelen: elk scherm eindigt in een
getal waar je op kan vertrouwen.

Deze mensen komen uit Excel. De klant die dit ontwerp stuurde heeft veertien
comitébladen met 120 posten. Kaspio moet aanvoelen als een beter rekenblad, niet
als een dashboard dat hen iets nieuws leert.

## Product Purpose

Eén bankrekening opdelen in virtuele potjes, zodat een club per tak, ploeg of post
weet waar het geld staat zonder tien rekeningen te openen.

Succes is niet "engagement". Succes is dat de penningmeester sneller klaar is dan
in Excel en dat de cijfers op de algemene vergadering kloppen tot op de cent.

## Brand Personality

Nuchter, precies, onopgesmukt.

Kaspio praat zoals een goede penningmeester praat: kort, concreet, zonder jargon
en zonder enthousiasme die niemand gevraagd heeft. Nederlands, geen
Engelse productwoorden.

De emotie om na te streven is **opluchting**, niet plezier. Geen confetti.

## Anti-references

- **Het SaaS-dashboard.** Kaarten op kaarten, kleurverlopen, een grote metriek
  bovenaan met drie steuncijfers eronder. Kaspio is geen analytics-product.
- **Neobank-apps.** Grote ronde hoeken, felle merkkleur overal, saldo als
  spektakel. Een club is geen consument die zijn uitgaven wil "ontdekken".
- **Boekhoudsoftware.** Dichte grijze tabellen, twaalf kolommen, alles even
  belangrijk. Dat is precies waar deze mensen van weglopen.
- **Crème, zand, papier-beige.** De verzadigde warme bijna-witte achtergrond is de
  standaardreflex geworden. Kaspio's oppervlak is neutraal en koel, niet warm.

## Design Principles

1. **Kleur betekent geld.** Groen is binnenkomend, amber is uitgaand, rood is een
   fout. Kleur wordt nergens gebruikt om iets mooi te maken. Als een element geen
   bedrag toont, is het inkt of niets.

2. **Het document, niet het dashboard.** Lijnen en uitlijning in plaats van dozen.
   Een kaart is pas verantwoord als het ding er echt los van de rest staat. Twee
   kaarten in elkaar is altijd fout.

3. **Het getal wint.** Op elk scherm is er precies één bedrag dat het antwoord is
   op de vraag waarom je er bent. Alles eromheen is kleiner, stiller of weg.

4. **Zwijgen over wat leeg is.** Geen "Geen verantwoordelijke" op 67 kaarten. Wat
   niet ingevuld is, neemt geen ruimte in.

5. **Uitlegbaar aan de algemene vergadering.** Elk getal moet te herleiden zijn tot
   de regels eronder. Geen afgeronde samenvattingen die niet optellen.

## Accessibility & Inclusion

WCAG 2.2 AA als ondergrens, doorgerekend en niet geschat. Elke tekst-op-achtergrond
combinatie in `DESIGN.md` is gemeten; de meting staat in
`scripts/design/contrast.py` en draait mee als controle.

Twee dingen die specifiek voor deze doelgroep tellen:

- **Kleurenblindheid.** De gebruikersgroep is grotendeels mannen van middelbare
  leeftijd, waarvan ongeveer 8% deuteranopie heeft. Daarom is de as niet
  groen/rood maar groen/amber, die veel verder uit elkaar liggen in zowel
  lichtheid als in het blauwkanaal. Bovendien is kleur nooit het enige kanaal:
  elk bedrag draagt ook een expliciet + of − teken.
- **Muisvrij werken.** Penningmeesters werken met een toetsenbord en een
  bankafschrift naast zich. Focus moet altijd zichtbaar zijn, dialogen vangen en
  herstellen de focus.

Beweging is altijd optioneel: alles achter `prefers-reduced-motion`.
