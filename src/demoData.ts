// Voorbeelddata voor de read-only demo (zie DemoView). Dit is een client-side
// reproductie van de vier demo-organisaties uit de Supabase-seeds
// (supabase/demo-seed*.sql), zodat een uitgelogde bezoeker Kaspio kan
// verkennen zonder account en zonder DB-toegang. Bron van waarheid blijven de
// seed-scripts: pas je die aan, werk dan ook dit bestand bij.
//
// De demo-gebruiker heeft rol "reader": die ziet alles maar krijgt in geen
// enkele view een toevoeg-/bewerk-/verwijder-knop. Zo is de demo automatisch
// alleen-lezen zonder de echte views aan te passen.

import type { Member, Pot, PotGroup, Transaction } from "./types";
import type { SubTier } from "./supabase";

/** Tier van de demo-orgs: "team" toont grafieken én potgroepen. */
export const DEMO_TIER: SubTier = "team";

/** De rondkijkende bezoeker. Rol "reader" = alles zien, niets wijzigen. */
export const DEMO_CURRENT_USER: Member = {
  id: "demo-viewer",
  name: "Jij (demo)",
  role: "reader",
  createdAt: "2026-01-05T09:00:00.000Z",
};

/** Eigenaar/verantwoordelijke van de potjes in elke demo-org. */
const DEMO_OWNER: Member = {
  id: "demo-owner",
  name: "Demo penningmeester",
  role: "admin",
  createdAt: "2026-01-05T09:00:00.000Z",
};

export type DemoOrg = {
  id: string;
  name: string;
  members: Member[];
  groups: PotGroup[];
  pots: Pot[];
  transactions: Transaction[];
};

// --- compacte seed-vorm, dicht bij de SQL ------------------------------------

type PotSeed = {
  key: string;
  name: string;
  color: string;
  group: string;
  target?: number;
};
// [potKey, richting, bedrag, datum, tegenpartij, mededeling]
type TxSeed = [string, "in" | "out", number, string, string, string];

type OrgSeed = {
  id: string;
  name: string;
  groups: { key: string; name: string }[];
  pots: PotSeed[];
  tx: TxSeed[];
};

function buildOrg(seed: OrgSeed): DemoOrg {
  // De demo blijft één niveau: platte hoofdgroepen, geen subgroepen.
  const groups: PotGroup[] = seed.groups.map((g, i) => ({
    id: `${seed.id}-${g.key}`,
    name: g.name,
    parentId: null,
    sortOrder: i,
  }));
  const pots: Pot[] = seed.pots.map((p) => ({
    id: `${seed.id}-${p.key}`,
    name: p.name,
    ownerId: DEMO_OWNER.id,
    color: p.color,
    targetAmount: p.target,
    groupId: `${seed.id}-${p.group}`,
    createdAt: "2026-01-12T09:00:00.000Z",
  }));
  const transactions: Transaction[] = seed.tx.map(
    ([potKey, direction, amount, occurredOn, counterparty, memo], i) => ({
      // In de demo is elke transactie precies één allocatie, dus id en
      // transactionId vallen samen.
      id: `${seed.id}-t${String(i + 1).padStart(2, "0")}`,
      transactionId: `${seed.id}-t${String(i + 1).padStart(2, "0")}`,
      potId: `${seed.id}-${potKey}`,
      direction,
      amount,
      occurredOn,
      counterparty,
      memo,
      status: "approved",
      createdAt: `${occurredOn}T10:00:00.000Z`,
    }),
  );
  return { id: seed.id, name: seed.name, members: [DEMO_OWNER], groups, pots, transactions };
}

// --- 1. Jeugdbeweging --------------------------------------------------------

const SCOUTS: OrgSeed = {
  id: "scouts",
  name: "Scouts Sint-Joris (demo)",
  groups: [
    { key: "werking", name: "Werking" },
    { key: "takken", name: "Takken" },
  ],
  pots: [
    { key: "groepskas", name: "Groepskas", color: "#1D9E75", group: "werking" },
    { key: "kampkas", name: "Kampkas", color: "#E8A23D", group: "werking", target: 4000 },
    { key: "materiaal", name: "Materiaal", color: "#3B82F6", group: "werking" },
    { key: "lokalen", name: "Lokalen & energie", color: "#6366F1", group: "werking" },
    { key: "kapoenen", name: "Kapoenen", color: "#EF4444", group: "takken" },
    { key: "wouters", name: "Wouters", color: "#F59E0B", group: "takken" },
    { key: "jonggivers", name: "Jonggivers", color: "#10B981", group: "takken" },
    { key: "givers", name: "Givers", color: "#0EA5E9", group: "takken" },
  ],
  tx: [
    ["groepskas", "in", 1850, "2026-02-03", "Lidgelden", "Lidgeld voorjaar (37 leden)"],
    ["groepskas", "in", 600, "2026-03-15", "Gemeente Sint-Joris", "Gemeentelijke jeugdsubsidie"],
    ["groepskas", "in", 1240.5, "2026-04-26", "Eetfestijn", "Opbrengst spaghettiavond"],
    ["groepskas", "out", 742, "2026-02-10", "Scouts en Gidsen Vlaanderen", "Verzekering leden 2026"],
    ["groepskas", "out", 96.3, "2026-03-02", "Copyshop", "Drukwerk infoboekje"],
    ["groepskas", "out", 180, "2026-05-18", "Scouts en Gidsen Vlaanderen", "Bivakvergunning en EHBO-kit"],
    ["kampkas", "in", 3300, "2026-04-01", "Ouders", "Kampinschrijvingen (33 x 100)"],
    ["kampkas", "in", 320, "2026-05-09", "Papierophaling", "Opbrengst oud papier"],
    ["kampkas", "out", 540, "2026-05-04", "De Lijn", "Bus naar kampplaats"],
    ["kampkas", "out", 1180.75, "2026-06-10", "Colruyt", "Kampvoeding groothandel"],
    ["kampkas", "out", 240, "2026-06-15", "Kampplaats De Hoge Rielen", "Huur kampweide"],
    ["materiaal", "in", 600, "2026-02-05", "Toelage groepskas", "Startbudget materiaal"],
    ["materiaal", "in", 150, "2026-03-22", "Tweedehands", "Verkoop oude tenten"],
    ["materiaal", "out", 220, "2026-02-20", "De Banier", "Nieuwe sjortouwen"],
    ["materiaal", "out", 410.4, "2026-05-28", "De Banier", "Reparatie patrouilletent"],
    ["lokalen", "in", 800, "2026-02-02", "Toelage groepskas", "Toelage lokalen"],
    ["lokalen", "out", 145, "2026-02-01", "Fluvius", "Elektriciteit jan-feb"],
    ["lokalen", "out", 145, "2026-04-01", "Fluvius", "Elektriciteit mrt-apr"],
    ["lokalen", "out", 89.9, "2026-03-10", "Brico", "Schoonmaakmateriaal lokaal"],
    ["kapoenen", "in", 120, "2026-02-15", "Ouders Kapoenen", "Bijdrage takactiviteit"],
    ["kapoenen", "out", 64.5, "2026-03-08", "Ava", "Knutselmateriaal"],
    ["kapoenen", "out", 38.2, "2026-05-10", "Action", "Verkleedspullen bosspel"],
    ["wouters", "in", 120, "2026-02-22", "Ouders Wouters", "Bijdrage daguitstap"],
    ["wouters", "out", 110, "2026-04-12", "Sportoase", "Inkom zwembad"],
    ["jonggivers", "in", 160, "2026-03-29", "Wafelverkoop", "Opbrengst wafelverkoop"],
    ["jonggivers", "out", 75.6, "2026-05-24", "Decathlon", "Materiaal hike"],
    ["givers", "in", 200, "2026-03-01", "Ouders Givers", "Bijdrage weekend"],
    ["givers", "out", 132, "2026-04-20", "NMBS", "Treintickets stadsspel"],
    ["givers", "out", 58, "2026-06-07", "Blokker", "Kookmateriaal weekend"],
  ],
};

// --- 2. Amateur-sportclub ----------------------------------------------------

const SPORTCLUB: OrgSeed = {
  id: "sportclub",
  name: "VK De Meeuwen (demo)",
  groups: [
    { key: "werking", name: "Werking" },
    { key: "ploegen", name: "Ploegen" },
  ],
  pots: [
    { key: "kantine", name: "Kantine", color: "#16A34A", group: "werking" },
    { key: "uitrusting", name: "Uitrusting", color: "#2563EB", group: "werking" },
    { key: "scheids", name: "Scheidsrechters", color: "#DC2626", group: "werking" },
    { key: "verplaats", name: "Verplaatsingen", color: "#7C3AED", group: "werking" },
    { key: "u11", name: "U11", color: "#F59E0B", group: "ploegen" },
    { key: "u15", name: "U15", color: "#0891B2", group: "ploegen" },
    { key: "eerste", name: "Eerste ploeg", color: "#1D9E75", group: "ploegen" },
    { key: "dames", name: "Damesploeg", color: "#DB2777", group: "ploegen" },
  ],
  tx: [
    ["kantine", "in", 720, "2026-02-08", "Bar", "Kantine thuiswedstrijd"],
    ["kantine", "in", 845.5, "2026-03-15", "Bar", "Kantine thuiswedstrijd"],
    ["kantine", "in", 610, "2026-04-19", "Bar", "Kantine thuiswedstrijd"],
    ["kantine", "out", 480, "2026-02-12", "Drankenhandel Janssens", "Drankbestelling"],
    ["kantine", "out", 510.3, "2026-04-02", "Drankenhandel Janssens", "Drankbestelling"],
    ["uitrusting", "in", 1500, "2026-02-01", "Bouwwerken Dhondt", "Hoofdsponsor truitjes"],
    ["uitrusting", "out", 1320, "2026-02-25", "Jartazi", "Wedstrijdtruitjes en ballen"],
    ["uitrusting", "out", 165, "2026-05-06", "Decathlon", "Nieuwe netten en hoekvlaggen"],
    ["scheids", "in", 300, "2026-02-01", "Toelage werking", "Toelage uit lidgelden"],
    ["scheids", "out", 70, "2026-03-01", "KBVB", "Scheidsrechtervergoeding"],
    ["scheids", "out", 70, "2026-04-12", "KBVB", "Scheidsrechtervergoeding"],
    ["scheids", "out", 25, "2026-03-22", "KBVB", "Boete laattijdig wedstrijdblad"],
    ["verplaats", "in", 500, "2026-02-01", "Toelage werking", "Toelage werking"],
    ["verplaats", "out", 280, "2026-03-08", "De Lijn", "Bus uitwedstrijd"],
    ["verplaats", "out", 120, "2026-05-10", "Vrijwilligers", "Brandstofvergoeding"],
    ["u11", "in", 540, "2026-02-10", "Lidgelden", "Lidgeld voorjaar (18 spelers)"],
    ["u11", "out", 96, "2026-04-18", "Tornooiorganisatie", "Inschrijving paastornooi"],
    ["u15", "in", 660, "2026-02-10", "Lidgelden", "Lidgeld voorjaar (22 spelers)"],
    ["u15", "out", 130, "2026-05-16", "Decathlon", "Trainingsmateriaal"],
    ["eerste", "in", 900, "2026-02-10", "Lidgelden", "Lidgeld voorjaar"],
    ["eerste", "in", 750, "2026-03-20", "Garage Verhoeven", "Sponsoring reclamebord"],
    ["eerste", "out", 240, "2026-04-26", "KBVB", "Tornooi-inschrijving"],
    ["eerste", "out", 320, "2026-05-30", "Bowling", "Teamuitstap"],
    ["dames", "in", 600, "2026-02-10", "Lidgelden", "Lidgeld voorjaar (20 speelsters)"],
    ["dames", "out", 145, "2026-04-05", "Decathlon", "Nieuwe ballen en bidons"],
  ],
};

// --- 3. Evenement-VZW --------------------------------------------------------

const FESTIVAL: OrgSeed = {
  id: "festival",
  name: "Buurtfestival De Kade (demo)",
  groups: [
    { key: "alg", name: "Algemeen" },
    { key: "prog", name: "Programmatie" },
    { key: "bar", name: "Bar & catering" },
    { key: "log", name: "Logistiek" },
    { key: "com", name: "Communicatie" },
  ],
  pots: [
    { key: "werk", name: "Werkingskas", color: "#1D9E75", group: "alg" },
    { key: "subs", name: "Subsidies & sponsoring", color: "#F59E0B", group: "alg" },
    { key: "art", name: "Artiesten & gages", color: "#7C3AED", group: "prog" },
    { key: "pod", name: "Podium, licht & geluid", color: "#2563EB", group: "prog" },
    { key: "drank", name: "Drank", color: "#16A34A", group: "bar" },
    { key: "food", name: "Foodtrucks", color: "#DB2777", group: "bar" },
    { key: "mat", name: "Materiaal & tenten", color: "#0891B2", group: "log" },
    { key: "veil", name: "Veiligheid & EHBO", color: "#DC2626", group: "log" },
    { key: "promo", name: "Promo & drukwerk", color: "#EA580C", group: "com" },
  ],
  tx: [
    ["werk", "in", 1000, "2026-02-15", "Gemeente", "Gemeentelijke projectsubsidie"],
    ["werk", "out", 380, "2026-03-01", "Verzekeraar", "Evenementenverzekering"],
    ["werk", "out", 120, "2026-02-20", "Gemeente", "Vergunning en SABAM-aangifte"],
    ["subs", "in", 500, "2026-03-10", "Bakkerij 't Molentje", "Sponsoring"],
    ["subs", "in", 750, "2026-03-18", "Garage Verhoeven", "Sponsoring"],
    ["subs", "in", 300, "2026-04-05", "Apotheek Centrum", "Sponsoring"],
    ["art", "in", 2000, "2026-05-01", "Interne toelage", "Budget boekingen (uit werking)"],
    ["art", "out", 850, "2026-05-20", "Boekingskantoor Nova", "Gage hoofdact"],
    ["art", "out", 450, "2026-05-22", "Local Heroes", "Gage support-act"],
    ["art", "out", 300, "2026-06-01", "DJ Lumen", "Gage DJ"],
    ["pod", "in", 1400, "2026-04-20", "Interne toelage", "Budget techniek (uit werking)"],
    ["pod", "out", 780, "2026-05-25", "EventRent", "Podiumhuur"],
    ["pod", "out", 540, "2026-05-28", "SoundCrew", "Licht en geluid"],
    ["drank", "in", 2450, "2026-06-21", "Bar", "Baromzet festivaldag"],
    ["drank", "out", 1320, "2026-06-05", "Drankenhandel Janssens", "Drankbestelling"],
    ["drank", "out", 180, "2026-06-10", "Drankenhandel Janssens", "Huur tapinstallatie"],
    ["food", "in", 600, "2026-06-21", "Foodtrucks", "Standgeld foodtrucks"],
    ["food", "out", 75, "2026-06-02", "EventRent", "Stroomvoorziening foodzone"],
    ["mat", "in", 900, "2026-04-10", "Interne toelage", "Budget logistiek (uit werking)"],
    ["mat", "out", 620, "2026-05-30", "EventRent", "Huur tenten en nadarhekken"],
    ["mat", "out", 210, "2026-06-12", "Verhuur Peeters", "Tafels, banken, koelwagen"],
    ["veil", "in", 400, "2026-05-05", "Interne toelage", "Budget veiligheid (uit werking)"],
    ["veil", "out", 250, "2026-06-15", "Rode Kruis Vlaanderen", "EHBO-post"],
    ["veil", "out", 140, "2026-06-18", "Veiligheidshuis", "Brandblussers en signalisatie"],
    ["promo", "in", 350, "2026-03-25", "Interne toelage", "Budget communicatie (uit werking)"],
    ["promo", "out", 240, "2026-04-15", "Drukkerij Devos", "Affiches en flyers"],
    ["promo", "out", 90, "2026-05-12", "Meta", "Online promo"],
  ],
};

// --- 4. Zelfstandige (BTW & sociale potjes) ----------------------------------

const ZELFSTANDIGE: OrgSeed = {
  id: "zelfstandige",
  name: "Studio Tuft (demo)",
  groups: [
    { key: "res", name: "Reserveringen" },
    { key: "atelier", name: "Atelier" },
    { key: "prive", name: "Privé" },
  ],
  pots: [
    { key: "btw", name: "BTW (21%)", color: "#DC2626", group: "res" },
    { key: "soc", name: "Sociale bijdragen", color: "#F59E0B", group: "res" },
    { key: "bel", name: "Belastingbuffer", color: "#7C3AED", group: "res" },
    { key: "grond", name: "Grondstoffen", color: "#16A34A", group: "atelier" },
    { key: "gereed", name: "Gereedschap", color: "#2563EB", group: "atelier" },
    { key: "atelierkost", name: "Atelierkosten", color: "#0891B2", group: "atelier" },
    { key: "loon", name: "Eigen loon", color: "#1D9E75", group: "prive" },
    { key: "buffer", name: "Spaarbuffer", color: "#DB2777", group: "prive" },
  ],
  tx: [
    ["btw", "in", 380, "2026-02-28", "Reservering", "BTW opzij - omzet februari"],
    ["btw", "in", 420, "2026-03-31", "Reservering", "BTW opzij - omzet maart"],
    ["btw", "in", 510, "2026-04-30", "Reservering", "BTW opzij - omzet april"],
    ["btw", "out", 980, "2026-04-20", "FOD Financiën", "BTW-afdracht Q1"],
    ["soc", "in", 250, "2026-02-28", "Reservering", "Opzij sociale bijdragen"],
    ["soc", "in", 250, "2026-03-31", "Reservering", "Opzij sociale bijdragen"],
    ["soc", "in", 250, "2026-04-30", "Reservering", "Opzij sociale bijdragen"],
    ["soc", "out", 720, "2026-03-20", "Liantis", "Sociale bijdragen Q1"],
    ["bel", "in", 200, "2026-02-28", "Reservering", "Opzij personenbelasting"],
    ["bel", "in", 200, "2026-03-31", "Reservering", "Opzij personenbelasting"],
    ["bel", "in", 200, "2026-04-30", "Reservering", "Opzij personenbelasting"],
    ["grond", "in", 500, "2026-02-10", "Reservering", "Budget grondstoffen"],
    ["grond", "out", 215.4, "2026-02-14", "De Wolfabriek", "Tuftgaren (wol en acryl)"],
    ["grond", "out", 142, "2026-03-18", "Tuftshop.eu", "Primary tuftdoek 5m"],
    ["grond", "out", 96.5, "2026-05-02", "Tuftshop.eu", "Lijm en afwerkdoek"],
    ["gereed", "in", 700, "2026-02-01", "Reservering", "Budget gereedschap"],
    ["gereed", "out", 540, "2026-02-08", "Tuftshop.eu", "Cut & loop tuftgun"],
    ["gereed", "out", 85, "2026-04-22", "Tuftshop.eu", "Reserveonderdelen en naalden"],
    ["atelierkost", "in", 900, "2026-02-01", "Reservering", "Budget atelier"],
    ["atelierkost", "out", 350, "2026-02-05", "Verhuurder", "Huur atelierruimte februari"],
    ["atelierkost", "out", 350, "2026-03-05", "Verhuurder", "Huur atelierruimte maart"],
    ["atelierkost", "out", 78.3, "2026-03-12", "Fluvius", "Elektriciteit atelier"],
    ["loon", "in", 850, "2026-02-25", "Webshop", "Verkoop wandkleed + workshop"],
    ["loon", "in", 1100, "2026-03-28", "Markt Gent", "Markt + online verkoop"],
    ["loon", "in", 1300, "2026-04-26", "Workshops", "Workshops + verkoop"],
    ["loon", "out", 1200, "2026-03-01", "Overschrijving privé", "Eigen loon februari"],
    ["loon", "out", 1200, "2026-04-01", "Overschrijving privé", "Eigen loon maart"],
    ["buffer", "in", 150, "2026-02-25", "Reservering", "Buffer opzij"],
    ["buffer", "in", 150, "2026-03-28", "Reservering", "Buffer opzij"],
    ["buffer", "in", 200, "2026-04-26", "Reservering", "Buffer opzij"],
  ],
};

/** Alle demo-organisaties, in de volgorde waarin de switcher ze toont. */
export const DEMO_ORGS: DemoOrg[] = [
  buildOrg(SCOUTS),
  buildOrg(SPORTCLUB),
  buildOrg(FESTIVAL),
  buildOrg(ZELFSTANDIGE),
];
