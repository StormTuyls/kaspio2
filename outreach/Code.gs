// =============================================================================
// Kaspio cold outreach — Google Apps Script
// =============================================================================
// Verstuurt gepersonaliseerde mails vanuit je Gmail naar leads in deze Sheet.
// Throttled: max 18 mails per run (sendNextBatch), 30 sec pauze tussen mails.
// Markeert verzonden rijen + plant follow-up 4 dagen later.
//
// Setup (1x):
//   1. Open Google Sheet → Extensies → Apps Script
//   2. Plak deze code, sla op (Ctrl+S), naam: "Kaspio outreach"
//   3. Klik "Run" op sendNextBatch → autoriseer Gmail-toegang
//
// Runnen:
//   - Klik op Run > sendNextBatch  (verzendt 1e batch, ~18 mails)
//   - Tweede dag: klik nog eens. Skip rijen met status="sent" automatisch.
//   - Na 4 dagen: Run > sendFollowUps (stuurt herinnering naar wie niet replyde)
//
// LET OP: vul de SIGNATURE constante hieronder aan met JOUW naam + link.
// =============================================================================

// -----------------------------------------------------------------------------
// CONFIG — pas aan voor verzending
// -----------------------------------------------------------------------------
const SIGNATURE = `Groeten,
Storm Tuyls
Founder , Kaspio
https://kaspio.be`;

const CALENDLY = "https://calendly.com/stormtuyls-4e1o/30min";

const BATCH_SIZE = 18; // max mails per run (Gmail limit ~100/dag, we blijven onder)
const DELAY_BETWEEN_MAILS_MS = 30 * 1000; // 30 sec pauze (vermijdt spam-flag)
const FOLLOWUP_AFTER_DAYS = 4;

// -----------------------------------------------------------------------------
// TEMPLATES — onderwerp + body per categorie. {{naam}}, {{locatie}}, {{hook}}
// worden vervangen door de Sheet-waardes.
// -----------------------------------------------------------------------------
const TEMPLATES = {
  jeugdbeweging: {
    subject: "Hoe houden jullie de groepskas bij {{naam}}?",
    body: `Hoi,

Mijn naam is Storm. Ik werk aan Kaspio, een kleine tool om geldstromen op één bankrekening overzichtelijker te beheren. Ik begon eraan omdat ik zelf beheerder was van een sportgroep, en daar liep ik elke week tegen hetzelfde aan: hoeveel sponsorgeld al binnen was, hoeveel we nog verwachtten, hoeveel we nodig hadden voor kleren en materiaal. Mijn Excel raakte elke week dat overzicht kwijt. Iedereen die ik daarna sprak, van scouts-leiding tot jeugdhuizen, bleek een variant van datzelfde probleem te hebben.

Ik probeer nu te begrijpen hoe verschillende groepen het vandaag oplossen, voor ik dieper bouw. Geen sales-pitch, ik schrijf jullie omdat ik graag wil weten hoe {{naam}} dit aanpakt: kampgeld, materiaalbudget, ledenbijdragen, hoe houden jullie dat allemaal apart? Excel? Schrift? Iets anders?

Als je 30 minuten wil maken voor een gesprek (telefoon of video), kan je een moment kiezen via {{CALENDLY}}. Of antwoord gewoon op deze mail met een paar lijnen, dat is voor mij evengoed waardevol.

Alvast bedankt voor je tijd.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou even checken of mijn vorige mail nog ergens onderaan je inbox staat. Als het niet past voor {{naam}}, hoor ik dat ook graag, dan stop ik je verder lastig te vallen.

{{SIGNATURE}}`,
  },
  sportclub: {
    subject: "Hoe houden jullie de clubkas bij {{naam}}?",
    body: `Hoi,

Mijn naam is Storm. Ik werk aan Kaspio, een kleine tool om geldstromen op één bankrekening overzichtelijker te beheren. Ik begon eraan omdat ik zelf beheerder was van een sportgroep, en daar liep ik tegen iets aan dat jullie waarschijnlijk herkennen: hoeveel sponsorgeld al binnen was, hoeveel we nog verwachtten, hoeveel we nodig hadden voor kleren en materiaal. Mijn Excel raakte elke week dat overzicht kwijt.

Ik probeer nu te begrijpen hoe andere sportclubs het oplossen, voor ik dieper bouw. Geen sales-pitch, ik schrijf jullie omdat ik graag wil weten hoe {{naam}} dit aanpakt: lidgeld, sponsoring, kantine, ploeg-budgetten, hoe houden jullie dat allemaal apart? Boekhoudpakket, Excel, of iets daartussenin?

Als je 30 minuten wil maken voor een gesprek (telefoon of video), kan je een moment kiezen via {{CALENDLY}}. Of antwoord gewoon op deze mail met een paar lijnen, dat is voor mij evengoed waardevol.

Alvast bedankt voor je tijd.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou even checken of mijn vorige mail nog ergens onderaan je inbox staat. Als het niet past voor {{naam}}, hoor ik dat ook graag, dan stop ik je verder lastig te vallen.

{{SIGNATURE}}`,
  },
  vzw: {
    subject: "Hoe houden jullie subsidies en projecten apart bij {{naam}}?",
    body: `Hoi,

Mijn naam is Storm. Ik werk aan Kaspio, een kleine tool om geldstromen op één bankrekening overzichtelijker te beheren. Ik begon eraan omdat ik zelf beheerder was van een sportgroep, en daar liep ik tegen iets aan: hoeveel geld al binnen was per project, hoeveel we nog verwachtten, hoeveel we nodig hadden voor verschillende uitgaven. Mijn Excel raakte elke week dat overzicht kwijt. Iedereen die ik daarna sprak, van jeugdhuizen tot kleinere VZW's, bleek een variant van datzelfde probleem te hebben.

Ik probeer nu te begrijpen hoe verschillende organisaties het vandaag oplossen, voor ik dieper bouw. Geen sales-pitch, ik schrijf jullie omdat ik graag wil weten hoe {{naam}} dit aanpakt: subsidies, donaties, projectgeld, hoe houden jullie dat apart en hoe rapporteer je terug aan een subsidieverstrekker? Boekhoudpakket, Excel, of iets daartussenin?

Als je 30 minuten wil maken voor een gesprek (telefoon of video), kan je een moment kiezen via {{CALENDLY}}. Of antwoord gewoon op deze mail met een paar lijnen, dat is voor mij evengoed waardevol.

Alvast bedankt voor je tijd.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou even checken of mijn vorige mail nog ergens onderaan je inbox staat. Als het niet past voor {{naam}}, hoor ik dat ook graag, dan stop ik je verder lastig te vallen.

{{SIGNATURE}}`,
  },
  artist: {
    subject: "Hoe verrekenen jullie commissies bij {{naam}}?",
    body: `Hoi,

Mijn naam is Storm. Ik werk aan Kaspio, een kleine tool om geldstromen op één bankrekening overzichtelijker te beheren. Ik begon eraan omdat ik zelf beheerder was van een sportgroep, en daar liep ik tegen iets aan: hoeveel geld al binnen was, hoeveel we nog verwachtten, hoeveel er nog uit moest voor verschillende doelen. Mijn Excel raakte elke week dat overzicht kwijt. Toen ik daarna met mensen in andere sectoren begon te praten, bleek het probleem breder, ook bij boekingskantoren en artiestenmanagement.

Ik probeer nu te begrijpen hoe verschillende bureaus dit oplossen, voor ik dieper bouw. Geen sales-pitch, ik schrijf jullie omdat ik graag wil weten hoe {{naam}} dit aanpakt: uitbetalingen aan artiesten, commissie-verrekening, royalties of merch-inkomsten, hoe houden jullie dat per artiest apart? Boekhoudpakket, Excel, of iets daartussenin?

Als je 30 minuten wil maken voor een gesprek (telefoon of video), kan je een moment kiezen via {{CALENDLY}}. Of antwoord gewoon op deze mail met een paar lijnen, dat is voor mij evengoed waardevol.

Alvast bedankt voor je tijd.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou even checken of mijn vorige mail nog ergens onderaan je inbox staat. Als het niet past voor {{naam}}, hoor ik dat ook graag, dan stop ik je verder lastig te vallen.

{{SIGNATURE}}`,
  },
};

// -----------------------------------------------------------------------------
// MAIN ENTRY POINTS — klik "Run" naast deze functies in de Apps Script editor
// -----------------------------------------------------------------------------

/** Verstuur de volgende batch koude mails (max BATCH_SIZE rijen met status=pending). */
function sendNextBatch() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const idx = headerIndex(header);

  let sent = 0;
  for (let i = 1; i < data.length && sent < BATCH_SIZE; i++) {
    const row = data[i];
    if (row[idx.status] !== "pending") continue;

    const tmpl = TEMPLATES[row[idx.type]];
    if (!tmpl) {
      Logger.log(`Skipping row ${i + 1}: onbekend type "${row[idx.type]}"`);
      continue;
    }

    const subject = render(tmpl.subject, row, idx);
    const body = render(tmpl.body, row, idx);

    try {
      GmailApp.sendEmail(row[idx.email], subject, body);
      sheet.getRange(i + 1, idx.status + 1).setValue("sent");
      sheet
        .getRange(i + 1, idx.sent_at + 1)
        .setValue(formatDate(new Date()));
      sheet
        .getRange(i + 1, idx.followup_at + 1)
        .setValue(formatDate(addDays(new Date(), FOLLOWUP_AFTER_DAYS)));
      sent++;
      Logger.log(`[${sent}/${BATCH_SIZE}] verzonden → ${row[idx.email]}`);
      if (sent < BATCH_SIZE) Utilities.sleep(DELAY_BETWEEN_MAILS_MS);
    } catch (err) {
      sheet.getRange(i + 1, idx.status + 1).setValue("failed");
      Logger.log(`FOUT bij ${row[idx.email]}: ${err}`);
    }
  }
  Logger.log(`Batch klaar: ${sent} mails verstuurd.`);
}

/** Verstuur follow-ups naar mensen die >4 dagen geleden zijn aangeschreven en niet replyden. */
function sendFollowUps() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const idx = headerIndex(header);

  const today = new Date();
  let sent = 0;

  for (let i = 1; i < data.length && sent < BATCH_SIZE; i++) {
    const row = data[i];
    if (row[idx.status] !== "sent") continue;
    if (row[idx.replied] && row[idx.replied].toString().trim() !== "") continue;

    const followupDate = parseDate(row[idx.followup_at]);
    if (!followupDate || followupDate > today) continue;

    const tmpl = TEMPLATES[row[idx.type]];
    if (!tmpl) continue;

    const subject = "Re: " + render(tmpl.subject, row, idx);
    const body = render(tmpl.followup, row, idx);

    try {
      GmailApp.sendEmail(row[idx.email], subject, body);
      sheet.getRange(i + 1, idx.status + 1).setValue("followup_sent");
      sent++;
      Logger.log(`[FU ${sent}] follow-up → ${row[idx.email]}`);
      if (sent < BATCH_SIZE) Utilities.sleep(DELAY_BETWEEN_MAILS_MS);
    } catch (err) {
      Logger.log(`FOUT follow-up ${row[idx.email]}: ${err}`);
    }
  }
  Logger.log(`Follow-ups klaar: ${sent} verstuurd.`);
}

/** Reset alle "sent" rijen terug naar "pending" — alleen voor testing. */
function resetAllForTesting() {
  if (
    !confirmDialog(
      "Reset alle rijen naar pending? Dit is onomkeerbaar (verzonden mails blijven verzonden).",
    )
  )
    return;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const idx = headerIndex(data[0]);
  for (let i = 1; i < data.length; i++) {
    sheet.getRange(i + 1, idx.status + 1).setValue("pending");
    sheet.getRange(i + 1, idx.sent_at + 1).setValue("");
    sheet.getRange(i + 1, idx.followup_at + 1).setValue("");
    sheet.getRange(i + 1, idx.replied + 1).setValue("");
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function headerIndex(header) {
  const map = {};
  header.forEach((h, i) => {
    map[h] = i;
  });
  return map;
}

function render(tmpl, row, idx) {
  return tmpl
    .replace(/\{\{naam\}\}/g, row[idx.naam] || "")
    .replace(/\{\{locatie\}\}/g, row[idx.locatie] || "")
    .replace(/\{\{hook\}\}/g, row[idx.hook] || "jullie organisatie")
    .replace(/\{\{CALENDLY\}\}/g, CALENDLY)
    .replace(/\{\{SIGNATURE\}\}/g, SIGNATURE);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const parts = s.toString().split("-");
  if (parts.length !== 3) return null;
  return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function confirmDialog(msg) {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert("Bevestig", msg, ui.ButtonSet.OK_CANCEL);
  return r === ui.Button.OK;
}

/** Diagnostische functie: log wat het script in de Sheet ziet. Run dit bij twijfel. */
function debugSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const data = sheet.getDataRange().getValues();
  Logger.log(`Aantal rijen totaal (incl header): ${data.length}`);
  if (data.length === 0) {
    Logger.log("LEEG. Geen data in de Sheet.");
    return;
  }
  Logger.log(`Aantal kolommen in rij 1: ${data[0].length}`);
  Logger.log(`Headers (rij 1): ${JSON.stringify(data[0])}`);
  if (data[0].length === 1) {
    Logger.log(
      "WAARSCHUWING: maar 1 kolom gedetecteerd. CSV is niet gesplitst. Doe: Data > Tekst splitsen in kolommen > Komma.",
    );
    return;
  }
  const idx = headerIndex(data[0]);
  Logger.log(`Header-index mapping: ${JSON.stringify(idx)}`);
  if (idx.status === undefined) {
    Logger.log("FOUT: geen 'status' kolom gevonden in rij 1.");
    return;
  }
  let pendingCount = 0;
  let knownTypes = 0;
  let unknownTypes = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[idx.status] === "pending") {
      pendingCount++;
      if (TEMPLATES[row[idx.type]]) {
        knownTypes++;
      } else {
        unknownTypes.push(`rij ${i + 1}: type="${row[idx.type]}"`);
      }
    }
  }
  Logger.log(`Aantal rijen met status="pending": ${pendingCount}`);
  Logger.log(`Daarvan met bekend type: ${knownTypes}`);
  if (unknownTypes.length) {
    Logger.log(`Rijen met onbekend type:\n  ${unknownTypes.join("\n  ")}`);
  }
  if (pendingCount === 0 && data.length > 1) {
    Logger.log(
      `Voorbeeld rij 2: ${JSON.stringify(data[1])}. Controleer of status-kolom letterlijk "pending" staat (kleine letters, geen spaties).`,
    );
  }
}
