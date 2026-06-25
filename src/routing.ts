// =============================================================================
// Lichtgewicht URL-routing , state <-> pad, zonder router-library
// =============================================================================
// We houden de bestaande state-gedreven rendering, maar synchroniseren met de
// URL via de History API. Zo werken deep-links, de back-knop en refresh-blijft-
// staan, zonder App.tsx te herschrijven naar <Route>-componenten.
//
// Pad-conventie:
//   /dashboard /potjes /groepen /leden /activiteit /instellingen
//   /potjes/:potId      (een potje open)
//   /groepen/:groupId   (een groep open)
// =============================================================================

export type Tab =
  | "dashboard"
  | "potjes"
  | "groepen"
  | "leden"
  | "activiteit"
  | "instellingen";

export const TABS: Tab[] = [
  "dashboard",
  "potjes",
  "groepen",
  "leden",
  "activiteit",
  "instellingen",
];

export type Route = { tab: Tab; potId: string | null; groupId: string | null };

export function parseRoute(pathname: string): Route {
  const seg = pathname.split("/").filter(Boolean);
  const first = seg[0] as Tab | undefined;
  if (first && (TABS as string[]).includes(first)) {
    if (first === "potjes" && seg[1]) {
      return { tab: "potjes", potId: decodeURIComponent(seg[1]), groupId: null };
    }
    if (first === "groepen" && seg[1]) {
      return { tab: "groepen", potId: null, groupId: decodeURIComponent(seg[1]) };
    }
    return { tab: first, potId: null, groupId: null };
  }
  return { tab: "dashboard", potId: null, groupId: null };
}

export function buildPath(r: {
  tab: Tab;
  potId: string | null;
  groupId: string | null;
}): string {
  if (r.potId) return `/potjes/${encodeURIComponent(r.potId)}`;
  if (r.groupId) return `/groepen/${encodeURIComponent(r.groupId)}`;
  return `/${r.tab}`;
}
