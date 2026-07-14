import { useState, type ReactNode } from "react";
import { Mark } from "../components/Logo";
import { DashboardView } from "./DashboardView";
import { PotsView } from "./Overview";
import { PotDetail } from "./PotDetail";
import { DEMO_CURRENT_USER, DEMO_ORGS, DEMO_TIER } from "../demoData";

type Props = {
  /** Naar het aanmeld-scherm (echte account). */
  onSignup: () => void;
  /** Terug naar de publieke website. */
  onExit: () => void;
};

type Tab = "overzicht" | "potjes";

/**
 * Read-only rondleiding door Kaspio zonder account. Hergebruikt de échte
 * DashboardView / PotsView / PotDetail met de vier demo-organisaties uit
 * demoData en een demo-gebruiker met rol "reader". Die rol verbergt in alle
 * views elke toevoeg-/bewerk-/verwijder-knop, dus de demo is automatisch
 * alleen-lezen. Een org-switcher toont dat Kaspio voor elk type org werkt.
 */
export function DemoView({ onSignup, onExit }: Props) {
  const [orgId, setOrgId] = useState<string>(DEMO_ORGS[0].id);
  const [tab, setTab] = useState<Tab>("overzicht");
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);

  const org = DEMO_ORGS.find((o) => o.id === orgId) ?? DEMO_ORGS[0];
  const selectedPot = selectedPotId
    ? org.pots.find((p) => p.id === selectedPotId) ?? null
    : null;

  // Mutatie-callbacks zijn no-ops: de bijbehorende knoppen zijn voor een reader
  // sowieso verborgen. onUpgrade nudget naar aanmelden.
  const noop = () => {};
  const noopAsync = async () => {};

  function switchOrg(id: string) {
    setOrgId(id);
    setSelectedPotId(null);
    setTab("overzicht");
  }

  function switchTab(next: Tab) {
    setSelectedPotId(null);
    setTab(next);
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-navy-950">
      <DemoBanner onSignup={onSignup} onExit={onExit} />

      <header className="border-b border-navy-100 bg-white/80 backdrop-blur dark:border-navy-800 dark:bg-navy-900/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Mark size={30} />
            <OrgSwitcher orgId={org.id} onChange={switchOrg} />
          </div>
          <nav className="flex items-center gap-1 rounded-xl bg-canvas p-1 dark:bg-navy-800">
            <TabButton active={!selectedPot && tab === "overzicht"} onClick={() => switchTab("overzicht")}>
              Overzicht
            </TabButton>
            <TabButton active={!!selectedPot || tab === "potjes"} onClick={() => switchTab("potjes")}>
              Potjes
            </TabButton>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-8 sm:pt-8">
        {selectedPot ? (
          <PotDetail
            key={selectedPot.id}
            pot={selectedPot}
            transactions={org.transactions}
            members={org.members}
            currentUser={DEMO_CURRENT_USER}
            groups={org.groups}
            tier={DEMO_TIER}
            orgId={null}
            onUpgrade={onSignup}
            onBack={() => setSelectedPotId(null)}
            onAddTransaction={noop}
            onDeleteTransaction={noop}
            onUpdatePot={noopAsync}
            onDeletePot={noop}
          />
        ) : tab === "potjes" ? (
          <PotsView
            pots={org.pots}
            allTransactions={org.transactions}
            members={org.members}
            currentUser={DEMO_CURRENT_USER}
            groups={org.groups}
            onSelect={setSelectedPotId}
            onAddPot={noop}
            onUpgrade={onSignup}
          />
        ) : (
          <DashboardView
            pots={org.pots}
            allTransactions={org.transactions}
            members={org.members}
            currentUser={DEMO_CURRENT_USER}
            organizationName={org.name}
            groups={org.groups}
            tier={DEMO_TIER}
            onUpgrade={onSignup}
            onSelect={setSelectedPotId}
            onOpenGroup={() => switchTab("potjes")}
            onNavigate={() => switchTab("potjes")}
          />
        )}
      </main>
    </div>
  );
}

function OrgSwitcher({ orgId, onChange }: { orgId: string; onChange: (id: string) => void }) {
  return (
    <label className="relative">
      <span className="sr-only">Kies een voorbeeld-organisatie</span>
      <select
        value={orgId}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-lg border border-navy-200 bg-white py-1.5 pl-3 pr-8 text-sm font-bold text-navy-900 shadow-sm transition hover:border-navy-300 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
      >
        {DEMO_ORGS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400"
      >
        ▾
      </span>
    </label>
  );
}

function DemoBanner({ onSignup, onExit }: { onSignup: () => void; onExit: () => void }) {
  return (
    <div className="sticky top-0 z-50 bg-navy-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full bg-mint-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-mint-300">
            Demo
          </span>
          <span className="text-white/80">
            Voorbeelddata, alleen-lezen. Niks wordt bewaard.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:text-white"
          >
            ← Terug naar site
          </button>
          <button
            onClick={onSignup}
            className="rounded-lg bg-mint-500 px-4 py-1.5 text-sm font-bold text-navy-900 transition hover:bg-mint-400"
          >
            Gratis account maken
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-white text-navy-900 shadow-sm dark:bg-navy-700 dark:text-white"
          : "text-navy-500 hover:text-navy-900 dark:text-navy-300 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
