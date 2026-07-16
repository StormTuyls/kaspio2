// Startsjablonen voor de opzet-wizard (zie SetupWizard). Elke sjabloon is een
// setje potjes (en optioneel groepen) om nieuwe gebruikers op weg te helpen,
// zodat ze niet naar een leeg scherm staren. De wizard houdt rekening met de
// subscription: op gratis worden potjes gecapt op de limiet en worden groepen
// overgeslagen (groepen zijn team-only).

export type TemplatePot = {
  name: string;
  color: string;
  /** Groepsnaam; alleen gebruikt wanneer de tier groepen toelaat (team). */
  group?: string;
};

export type SetupTemplate = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Groepen die deze sjabloon voorstelt (enkel op team aangemaakt). */
  groups: string[];
  /** Potjes in voorgestelde volgorde. De eerste vullen de vrije plaatsen. */
  pots: TemplatePot[];
};

export const SETUP_TEMPLATES: SetupTemplate[] = [
  {
    id: "persoonlijk",
    label: "Persoonlijk",
    emoji: "🧍",
    description: "Je eigen inkomsten verdelen over vaste kosten, sparen en vrij besteedbaar.",
    groups: [],
    pots: [
      { name: "Vaste kosten", color: "#6366F1" },
      { name: "Boodschappen", color: "#16A34A" },
      { name: "Sparen", color: "#1D9E75" },
      { name: "Buffer", color: "#F59E0B" },
      { name: "Vrij te besteden", color: "#DB2777" },
    ],
  },
  {
    id: "zelfstandige",
    label: "Zelfstandige",
    emoji: "🧑‍💻",
    description: "Zet BTW, sociale bijdragen en belastingen apart, en betaal jezelf een vast loon.",
    groups: ["Reserveringen", "Zaak", "Privé"],
    pots: [
      { name: "BTW (opzij)", color: "#DC2626", group: "Reserveringen" },
      { name: "Sociale bijdragen", color: "#F59E0B", group: "Reserveringen" },
      { name: "Belastingbuffer", color: "#7C3AED", group: "Reserveringen" },
      { name: "Bedrijfskosten", color: "#2563EB", group: "Zaak" },
      { name: "Eigen loon", color: "#1D9E75", group: "Privé" },
      { name: "Spaarbuffer", color: "#DB2777", group: "Privé" },
    ],
  },
  {
    id: "vereniging",
    label: "Vereniging of club",
    emoji: "🎪",
    description: "Werking, activiteiten en materiaal transparant uit elkaar houden.",
    groups: [],
    pots: [
      { name: "Werkingskas", color: "#1D9E75" },
      { name: "Activiteiten & kamp", color: "#F59E0B" },
      { name: "Materiaal", color: "#2563EB" },
      { name: "Sponsoring & subsidies", color: "#16A34A" },
      { name: "Buffer", color: "#DB2777" },
    ],
  },
];
