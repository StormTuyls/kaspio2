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
    subject: "Hoe regelen jullie de kamppenning bij {{naam}}?",
    body: `Hoi,

Korte vraag: hoe houden jullie de kampgeld-administratie nu bij? Excel, een schrift, iets anders?

Ik werk aan een tool die scouts- en chiro-groepen helpt om geldstromen zoals kampgeld, materiaalbudget en ledenbijdragen overzichtelijk te beheren op één bankrekening. Voor ik dieper bouw, wil ik graag begrijpen waar de echte pijn zit, vooral bij de overdracht naar nieuwe leiding.

Als je tijd hebt om daar kort over te vertellen, kan je een moment kiezen via {{CALENDLY}} (30 min, telefoon of video). Of antwoord gewoon op deze mail als dat makkelijker is.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou mijn vorige mail nog eens bovenaan je inbox krijgen. Mocht het niet relevant zijn, hoor ik het ook graag, dan stop ik je niet meer lastig te vallen.

{{SIGNATURE}}`,
  },
  sportclub: {
    subject: "Hoe houden jullie de clubkas bij {{naam}}?",
    body: `Hoi,

Korte vraag: hoe verdelen jullie lidgeld, sponsoring en kantine-inkomsten nu? Eén grote kas of aparte budgetten per ploeg of project?

Ik werk aan een tool die sportclubs helpt om die geldstromen overzichtelijk te beheren op één bankrekening, zodat ploegen of project-budgetten apart zichtbaar zijn zonder dat je een hele boekhouding moet opzetten. Voor ik dieper bouw, wil ik begrijpen waar de echte pijn zit.

Als je tijd hebt om daar kort over te vertellen, kan je een moment kiezen via {{CALENDLY}} (30 min, telefoon of video). Of antwoord gewoon op deze mail als dat makkelijker is.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou mijn vorige mail nog eens bovenaan je inbox krijgen. Mocht het niet relevant zijn, hoor ik het ook graag, dan stop ik je niet meer lastig te vallen.

{{SIGNATURE}}`,
  },
  vzw: {
    subject: "Hoe houden jullie subsidies en projecten apart bij {{naam}}?",
    body: `Hoi,

Korte vraag: hoe rapporteren jullie nu terug aan subsidieverstrekkers welk geld aan welk project is besteed? Boekhoudpakket, Excel, of iets daartussenin?

Ik werk aan een tool die VZW's en jeugdhuizen helpt om subsidies, donaties en eigen inkomsten apart te beheren op één bankrekening, zonder dat je daarvoor een hele boekhouding moet opzetten. Voor ik dieper bouw, wil ik begrijpen waar de echte pijn zit.

Als je tijd hebt om daar kort over te vertellen, kan je een moment kiezen via {{CALENDLY}} (30 min, telefoon of video). Of antwoord gewoon op deze mail als dat makkelijker is.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou mijn vorige mail nog eens bovenaan je inbox krijgen. Mocht het niet relevant zijn, hoor ik het ook graag, dan stop ik je niet meer lastig te vallen.

{{SIGNATURE}}`,
  },
  artist: {
    subject: "Hoe verrekenen jullie commissies bij {{naam}}?",
    body: `Hoi,

Korte vraag: hoe houden jullie de uitbetalingen aan artiesten en commissies nu bij? Excel per artiest, een boekhoudpakket, of iets anders?

Ik werk aan een tool voor boekingskantoren en artiestenmanagement om die geldstromen transparant te beheren op één bankrekening, met een potje per artiest waar gigs en commissies in terechtkomen. Voor ik dieper bouw, wil ik begrijpen hoe jullie dit vandaag oplossen en waar de echte pijn zit.

Als je tijd hebt om daar kort over te vertellen, kan je een moment kiezen via {{CALENDLY}} (30 min, telefoon of video). Of antwoord gewoon op deze mail als dat makkelijker is.

{{SIGNATURE}}`,
    followup: `Hoi,

Wou mijn vorige mail nog eens bovenaan je inbox krijgen. Mocht het niet relevant zijn, hoor ik het ook graag, dan stop ik je niet meer lastig te vallen.

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
