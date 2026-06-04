# Kaspio outreach automatisering — setup

Verstuur de 34 leads uit `leads.csv` automatisch vanuit je Gmail, met
gepersonaliseerde templates per categorie, throttled tot 18 mails/dag,
follow-up na 4 dagen.

**Totale setup-tijd: 15-20 minuten. Daarna 1 klik per dag.**

---

## Stap 1: Maak Google Sheet aan

1. Ga naar [sheets.new](https://sheets.new) (opent een blanco Sheet)
2. Naam: `Kaspio outreach`
3. Open `outreach/leads.csv` in je IDE of Finder
4. **Selecteer alles + kopieer** (Cmd+A, Cmd+C)
5. Klik cel A1 in Google Sheet → **Plak** (Cmd+V)
6. Klik op het klembord-icoon dat verschijnt → kies **"Splitsen in kolommen"** (of: Data → Tekst splitsen in kolommen → komma)

Je hebt nu 9 kolommen: `status | type | naam | email | locatie | hook | sent_at | followup_at | replied`

---

## Stap 2: Installeer het Apps Script

1. In de Sheet: **Extensies → Apps Script** (opent nieuw tabblad)
2. Verwijder de standaard `function myFunction()` boilerplate
3. Open `outreach/Code.gs` in je IDE
4. **Kopieer ALLE inhoud** (Cmd+A, Cmd+C)
5. Plak in de Apps Script editor
6. **Pas de SIGNATURE constante aan** (bovenaan in de file):
   ```js
   const SIGNATURE = `Groeten,
   Storm Tuyls
   Founder — Kaspio
   https://kaspio.be`;
   ```
   Vervang door je eigen naam/link.
7. **Save** (Cmd+S of het diskette-icoon). Geef het project een naam: "Kaspio outreach".

---

## Stap 3: Eerste batch versturen + autoriseren

1. Bovenaan in Apps Script: dropdown naast Run → kies **`sendNextBatch`**
2. Klik **Run** (de play-knop)
3. **Eerste keer:** Google vraagt autorisatie
   - Klik "Review permissions"
   - Kies je Gmail-account
   - Je krijgt waarschuwing "Google heeft deze app niet geverifieerd" → **Geavanceerd → Ga naar Kaspio outreach (onveilig)**
   - Toestaan dat het script Gmail mag versturen + de Sheet kan lezen/schrijven
4. Script begint te draaien. Duurt ~10 min (18 mails × 30 sec pauze).
5. Bekijk de **Logger output** (View → Logs) om de voortgang te zien.

**Check je verzonden-map in Gmail om te bevestigen dat de mails ECHT zijn vertrokken.**

In de Sheet wordt voor elke rij:
- `status` → `sent`
- `sent_at` → vandaag
- `followup_at` → +4 dagen

---

## Stap 4: Volgende dagen

**Dag 2:** klik weer Run → `sendNextBatch`. Verstuurt de volgende ~16 mails (alle resterende `pending` rijen).

**Dag 6 (= 4 dagen na dag 2):** klik Run → `sendFollowUps`. Verstuurt herinneringen naar wie nog niet replyde.

---

## Stap 5: Replies bijhouden

Wanneer iemand antwoordt in Gmail:
1. Ga naar de Sheet
2. Vind de rij met dat e-mailadres
3. Vul iets in de `replied` kolom (bv. "ja", de datum, of "interesse")

Het Apps Script slaat die rijen over bij de follow-up-batch.

---

## Veelgemaakte fouten

**"Quota exceeded"** — Gmail-limiet is 100/dag voor gratis accounts, 1500 voor Google Workspace. Met BATCH_SIZE=18 ben je veilig. Als je vandaag al manueel veel mails verstuurde: verlaag BATCH_SIZE naar 10.

**"Authorization required"** — Klik opnieuw Run en herautoriseer.

**Mails gaan naar spam** — Lower BATCH_SIZE naar 10, verhoog DELAY_BETWEEN_MAILS_MS naar 60000 (= 1 min). En check of je signature er menselijk uit ziet (geen tracking-pixels, geen unsubscribe-link nodig voor B2B-prospect).

**Iemand antwoordt geïrriteerd** — Excuses sturen, en vul "stop" in de `replied` kolom. Verwijder ze NIET (anders krijg je geen tracking als je per ongeluk dezelfde lijst opnieuw verwerkt).

---

## Wat het script doet (en niet doet)

✅ Verstuurt vanuit jouw Gmail (replies komen in je inbox)
✅ Personaliseert per categorie + per lead (hook)
✅ Throttled tegen Gmail-flagging
✅ Tracked status in de Sheet
✅ Follow-up na 4 dagen, alleen naar wie niet replyde
✅ Slaat rijen over met status "sent" of "failed" of "replied"

❌ Geen open/click tracking (bewust — voelt creepy in cold mail)
❌ Geen A/B test (te kleine schaal)
❌ Geen automatische lead-toevoeging vanuit LEADS.md updates (handmatig CSV opnieuw plakken)
❌ Geen integratie met Kaspio's eigen database (deze outreach gebeurt buiten de app)

---

## Volgende stappen na de batch

1. **Track open-rates manueel** in een aparte kolom (bv. door iemand 2 dagen na verzending te vragen of ze het kregen — kleine schaal)
2. **Top 3 replies → uitnodigen voor 20 min Calendly** (zoals beschreven in INTERVIEWS.md)
3. **Na 10 gesprekken**: pay-signaal scores invullen, beslissen of je doorbouwt of pivotert
4. **Voor volgende ronde leads:** vul `leads.csv` aan (handmatig vanuit LinkedIn / scoutsmap.be) en plak nieuwe rijen onderaan de Sheet. Het script pakt automatisch alleen `pending` rijen op.

---

## Snel hertesten

Wil je het script eerst testen voordat je naar échte leads stuurt?

1. Voeg een test-rij toe in de Sheet met je eigen e-mailadres als email
2. Run `sendNextBatch` (verstuurt naar jezelf + alle pending leads)
3. Check de mail die je krijgt
4. Als het niet klopt: stop de execution, fix de template in Code.gs, en run `resetAllForTesting` om alle `sent` terug op `pending` te zetten (verzonden mails blijven verzonden, maar je kan opnieuw testen)
