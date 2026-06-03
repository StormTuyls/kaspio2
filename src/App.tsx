import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import { useAppState, visiblePots } from "./storage";
import {
  acceptPendingInvites,
  useAuditLog,
  useCurrentOrg,
  useOrgInvites,
  useOrgMembers,
  usePots,
  useTransactions,
} from "./data";
import { InviteMemberForm } from "./components/InviteMemberForm";
import { MembersListView } from "./views/MembersListView";
import { AuditLogView } from "./views/AuditLogView";
import { OrgOnboardingView } from "./views/OrgOnboardingView";
import type { Pot as DbPot, Transaction as DbTransaction } from "./supabase";
import type { Pot, Transaction } from "./types";
import { signOut, supabase, useSession } from "./supabase";
import { Overview } from "./views/Overview";
import { PotDetail } from "./views/PotDetail";
import { SettingsView } from "./views/SettingsView";
import { Landing } from "./views/Landing";
import { AuthView } from "./views/AuthView";
import { PasswordResetView } from "./views/PasswordResetView";
import { Modal } from "./components/Modal";
import { PotForm } from "./components/PotForm";
import { TransactionForm } from "./components/TransactionForm";
import { UserSwitcher } from "./components/UserSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import { Mark } from "./components/Logo";
import { paletteToCssVars } from "./branding";
import type { Branding } from "./branding";

type Tab = "potjes" | "leden" | "activiteit" | "instellingen";
type PublicView = "landing" | "login" | "signup";

// Lokale Account-shape (bridge tussen Supabase user en de oude localStorage-laag).
// In sprint 2 vervangen we localStorage door Supabase queries — dan is dit type
// niet meer nodig.
type Account = {
  id: string;
  email: string;
  fullName: string;
  organizationName: string;
  createdAt: string;
};

type AuthErrorKind = "expired" | "invalid" | "other";

function parseHashError(): { kind: AuthErrorKind; description: string } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash.includes("error")) return null;
  const params = new URLSearchParams(hash);
  if (!params.get("error")) return null;
  const code = params.get("error_code") ?? "";
  const desc = params.get("error_description") ?? "";
  let kind: AuthErrorKind = "other";
  if (code === "otp_expired" || /expired/i.test(desc)) kind = "expired";
  else if (/invalid/i.test(desc)) kind = "invalid";
  // Maak de URL schoon zodat een refresh niet steeds dezelfde error toont
  window.history.replaceState(null, "", window.location.pathname);
  return { kind, description: desc.replace(/\+/g, " ") };
}

function App() {
  const { session, loading } = useSession();
  const [publicView, setPublicView] = useState<PublicView>("landing");

  // Recovery-mode initial state: check de URL hash direct (vóór React rendert).
  const [recoveryMode, setRecoveryMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    return hash.includes("type=recovery") || hash.includes("type%3Drecovery");
  });

  // Auth-error initial state: vang verlopen / ongeldige reset/magic-links af
  // zodat de user niet stilzwijgend op de landing belandt.
  const [authError, setAuthError] = useState(() => parseHashError());

  // Als er een auth-error in de hash zat, spring direct naar de AuthView
  // (login tab met forgot-password ingang) zodat de user makkelijk
  // een nieuwe link kan aanvragen.
  useEffect(() => {
    if (authError) {
      setPublicView("login");
    }
  }, [authError]);

  // Detect Supabase PASSWORD_RECOVERY event voor het geval Supabase
  // de hash later verwerkt (race-condition fallback).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-navy-500 dark:bg-navy-950 dark:text-navy-300">
        Laden…
      </div>
    );
  }

  if (recoveryMode) {
    return <PasswordResetView onDone={() => setRecoveryMode(false)} />;
  }

  if (!session) {
    if (publicView === "landing") {
      return (
        <Landing
          onLogin={() => setPublicView("login")}
          onSignup={() => setPublicView("signup")}
        />
      );
    }
    return (
      <AuthView
        initialMode={publicView === "login" ? "login" : "signup"}
        authError={authError}
        onAuth={() => {
          // useSession picks up the new session via onAuthStateChange.
        }}
        onBack={() => {
          setAuthError(null);
          setPublicView("landing");
        }}
        onDismissError={() => setAuthError(null)}
      />
    );
  }

  return <AuthedApp session={session} onLogout={() => signOut()} />;
}

// Bridges Supabase auth with the existing localStorage app state.
// Creates a pending org if signup left one queued in sessionStorage
// (happens when email-confirmation is enabled and signup-flow was interrupted).
function useEnsureOrg(session: Session) {
  useEffect(() => {
    // 1. Eventueel pending org aanmaken (uit interrupted signup-flow)
    const pendingName = sessionStorage.getItem("kaspio.pending_org_name");
    if (pendingName) {
      sessionStorage.removeItem("kaspio.pending_org_name");
      const orgInsert = { name: pendingName, owner_id: session.user.id };
      supabase
        .from("organisations")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(orgInsert as any)
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn(
              "[Kaspio] Kon pending org niet aanmaken:",
              error.message,
            );
          }
        });
    }

    // 2. Accepteer pending org-invites voor deze user (kan 0 of meer zijn)
    acceptPendingInvites().then((accepted) => {
      if (accepted > 0) {
        // eslint-disable-next-line no-console
        console.info(`[Kaspio] ${accepted} uitnodiging(en) geaccepteerd.`);
      }
    });
  }, [session.user.id]);
}

// =============================================================================
// useBridgedStore — combineert oude localStorage-store met Supabase pots/transactions
// =============================================================================
// Sprint 2A: pots + transactions komen uit Supabase. Members/audit/branding/
// notifications blijven (voor nu) in localStorage. Views krijgen dezelfde
// store-shape als voor de migratie, dus geen view-rewrites nodig.

type LocalStore = ReturnType<typeof useAppState>;

function dbPotToUiPot(p: DbPot, currentUserId: string): Pot {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    // ownerId mapping: alle Supabase-pots die de user kan zien horen via RLS bij hem.
    // Tot we members en pot_owner-rollen volledig migreren, doen we alsof de
    // current user owner is (zo werkt visiblePots() correct in admin-modus).
    ownerId: currentUserId,
    targetAmount: p.target_amount ?? undefined,
    createdAt: p.created_at,
  };
}

function dbTxToUiTx(t: DbTransaction): Transaction {
  return {
    id: t.id,
    potId: t.pot_id,
    direction: t.direction,
    amount: Number(t.amount),
    occurredOn: t.occurred_on,
    counterparty: t.counterparty ?? "",
    memo: t.memo ?? undefined,
    createdAt: t.created_at,
  };
}

function useBridgedStore(localStore: LocalStore, currentUserId: string) {
  const { org } = useCurrentOrg();
  const orgId = org?.id ?? null;
  const {
    pots: dbPots,
    addPot: addDbPot,
    updatePot: updateDbPot,
    deletePot: deleteDbPot,
  } = usePots(orgId);
  const {
    transactions: dbTx,
    addTransaction: addDbTx,
    deleteTransaction: deleteDbTx,
  } = useTransactions(orgId);

  const pots = useMemo(
    () => dbPots.map((p) => dbPotToUiPot(p, currentUserId)),
    [dbPots, currentUserId],
  );
  const transactions = useMemo(() => dbTx.map(dbTxToUiTx), [dbTx]);

  // Build a new store object met dezelfde shape als de oude useAppState,
  // maar met pots/transactions uit Supabase + mutaties die naar Supabase schrijven.
  return useMemo(() => {
    return {
      ...localStore,
      state: {
        ...localStore.state,
        pots,
        transactions,
      },
      addPot: async (input: {
        name: string;
        color?: string;
        targetAmount?: number;
        description?: string;
      }) => {
        await addDbPot({
          name: input.name,
          color: input.color ?? "#1D9E75",
          targetAmount: input.targetAmount,
          description: input.description,
        });
      },
      updatePot: async (
        id: string,
        patch: {
          name?: string;
          color?: string;
          targetAmount?: number;
          description?: string;
        },
      ) => {
        await updateDbPot(id, patch);
      },
      deletePot: async (id: string) => {
        await deleteDbPot(id);
      },
      addTransaction: async (input: {
        potId: string;
        direction: "in" | "out";
        amount: number;
        occurredOn: string;
        counterparty: string;
        memo?: string;
      }) => {
        await addDbTx({
          potId: input.potId,
          direction: input.direction,
          amount: input.amount,
          occurredOn: input.occurredOn,
          counterparty: input.counterparty || null,
          memo: input.memo || null,
        });
      },
      deleteTransaction: async (id: string) => {
        await deleteDbTx(id);
      },
    };
  }, [
    localStore,
    pots,
    transactions,
    addDbPot,
    updateDbPot,
    deleteDbPot,
    addDbTx,
    deleteDbTx,
  ]);
}

function AuthedApp({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  useEnsureOrg(session);

  // Bridge: existing localStorage layer expects {id, email, fullName, organizationName}.
  // Pull from Supabase user metadata that was set during signup.
  const meta = (session.user.user_metadata ?? {}) as {
    full_name?: string;
    organization_name?: string;
  };
  const account: Account = {
    id: session.user.id,
    email: session.user.email ?? "",
    fullName: meta.full_name ?? session.user.email?.split("@")[0] ?? "Gebruiker",
    organizationName: meta.organization_name ?? "Mijn organisatie",
    createdAt: session.user.created_at,
  };

  const localStore = useAppState(account.id, account.fullName);
  const store = useBridgedStore(localStore, account.id);
  const { org, loading: orgLoading, refresh: refreshOrg } = useCurrentOrg();
  const orgId = org?.id ?? null;
  const { pots: dbPots } = usePots(orgId);
  const { invites, sendInvite, revokeInvite } = useOrgInvites(orgId);
  const {
    members: orgMembers,
    setMemberPermissions,
    removeMember,
  } = useOrgMembers(orgId);
  const { entries: auditEntries, loading: auditLoading } = useAuditLog(orgId);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);
  const [showAddPot, setShowAddPot] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<Tab>("potjes");

  // Bepaal rol. Fall back op "ben ik owner van de org?" als de memberships-fetch
  // nog niet klaar is of RLS de query blokkeert. Voorkomt eindeloos hangen.
  const myMembership = orgMembers.find((m) => m.user_id === account.id) ?? null;
  const isOwner = org?.owner_id === account.id;
  const isAdmin = myMembership?.role === "admin" || isOwner;
  const adminCount = orgMembers.filter((m) => m.role === "admin").length;

  // Synthetische currentUser, altijd gedefinieerd zolang session bestaat.
  const currentUser = {
    id: account.id,
    name: account.fullName,
    role: isAdmin ? ("admin" as const) : ("pot_owner" as const),
    createdAt: account.createdAt,
  };

  // RLS in Supabase doet pot-filtering al, dus visiblePots() is een no-op voor admins.
  const potsForUser = visiblePots(store.state.pots, currentUser);
  const selectedPot = potsForUser.find((p) => p.id === selectedPotId) ?? null;

  // Wacht maximaal even op de eerste fetch. Daarna: als nog steeds geen org,
  // is dat geen netwerk-issue maar een data-issue (user heeft geen membership).
  if (orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-navy-500 dark:bg-navy-950 dark:text-navy-300">
        Organisatie aan het laden…
      </div>
    );
  }

  // Logged-in user heeft geen org en geen membership. Toon onboarding.
  if (!org) {
    return (
      <OrgOnboardingView
        userId={account.id}
        fullName={account.fullName}
        onCreated={() => refreshOrg()}
      />
    );
  }

  const brandName = store.state.branding.brandName ?? "Kaspio";
  const brandStyle = paletteToCssVars(store.state.branding.accent) as CSSProperties;

  return (
    <div className="min-h-screen bg-canvas dark:bg-navy-950" style={brandStyle}>
      <div className="flex min-h-screen">
        <Sidebar
          tab={tab}
          isAdmin={!!isAdmin}
          membersCount={orgMembers.length}
          potsCount={store.state.pots.length}
          adminCount={adminCount}
          auditCount={auditEntries.length}
          organizationName={org.name}
          pots={store.state.pots}
          transactions={store.state.transactions}
          selectedPotId={selectedPotId}
          onSelectPot={(id) => setSelectedPotId(id)}
          brandName={brandName}
          branding={store.state.branding}
          onTab={(t) => {
            setTab(t);
            setSelectedPotId(null);
          }}
        />

        <div className="flex-1 min-w-0">
          <Topbar
            account={account}
            members={store.state.members}
            currentUserId={store.state.currentUserId}
            brandName={brandName}
            branding={store.state.branding}
            onSwitchUser={(id) => {
              store.setCurrentUser(id);
              setSelectedPotId(null);
              setTab("potjes");
            }}
            onLogout={onLogout}
          />

          <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-8 sm:pt-8 lg:pb-8">
            {selectedPot ? (
              <PotDetail
                pot={selectedPot}
                transactions={store.state.transactions}
                members={store.state.members}
                currentUser={currentUser}
                onBack={() => setSelectedPotId(null)}
                onAddTransaction={() => setShowAddTx(true)}
                onDeleteTransaction={(id) => store.deleteTransaction(id)}
                onUpdatePot={(patch) => store.updatePot(selectedPot.id, patch)}
                onDeletePot={() => {
                  store.deletePot(selectedPot.id);
                  setSelectedPotId(null);
                }}
              />
            ) : tab === "leden" && isAdmin ? (
              <MembersListView
                orgId={org.id}
                currentUserId={account.id}
                members={orgMembers}
                invites={invites}
                pots={dbPots}
                onInviteClick={() => setShowInvite(true)}
                onSavePermissions={setMemberPermissions}
                onRemoveMember={removeMember}
                onRevokeInvite={revokeInvite}
              />
            ) : tab === "activiteit" && isAdmin ? (
              <AuditLogView entries={auditEntries} loading={auditLoading} />
            ) : tab === "instellingen" && isAdmin ? (
              <SettingsView
                account={account}
                notifications={store.state.notifications}
                branding={store.state.branding}
                onChange={(patch) => store.updateNotifications(patch)}
                onBrandingChange={(patch) => store.updateBranding(patch)}
                onBrandingReset={() => store.resetBranding()}
              />
            ) : (
              <Overview
                pots={potsForUser}
                allTransactions={store.state.transactions}
                members={store.state.members}
                currentUser={currentUser}
                organizationName={org.name}
                onSelect={(id) => setSelectedPotId(id)}
                onAddPot={() => setShowAddPot(true)}
              />
            )}
          </main>
        </div>
      </div>

      {isAdmin && (
        <BottomNav
          tab={tab}
          potsCount={store.state.pots.length}
          membersCount={orgMembers.length}
          auditCount={auditEntries.length}
          onTab={(t) => {
            setTab(t);
            setSelectedPotId(null);
          }}
        />
      )}

      <Modal open={showAddPot} title="Nieuw potje" onClose={() => setShowAddPot(false)}>
        <PotForm
          onSubmit={async (values) => {
            await store.addPot(values);
            setShowAddPot(false);
          }}
          onCancel={() => setShowAddPot(false)}
        />
      </Modal>

      <Modal open={showAddTx} title="Nieuwe transactie" onClose={() => setShowAddTx(false)}>
        {selectedPot && (
          <TransactionForm
            onSubmit={(values) => {
              store.addTransaction({ ...values, potId: selectedPot.id });
              setShowAddTx(false);
            }}
            onCancel={() => setShowAddTx(false)}
          />
        )}
      </Modal>

      <Modal
        open={showInvite}
        title="Lid uitnodigen"
        onClose={() => setShowInvite(false)}
      >
        {orgId && (
          <InviteMemberForm
            orgId={orgId}
            pots={dbPots}
            pendingInvites={invites}
            onInvite={sendInvite}
            onRevoke={revokeInvite}
            onClose={() => setShowInvite(false)}
          />
        )}
      </Modal>
    </div>
  );
}

function Sidebar({
  tab,
  isAdmin,
  membersCount,
  potsCount,
  adminCount,
  auditCount,
  organizationName,
  brandName,
  branding,
  pots,
  transactions,
  selectedPotId,
  onSelectPot,
  onTab,
}: {
  tab: Tab;
  isAdmin: boolean;
  membersCount: number;
  potsCount: number;
  adminCount: number;
  auditCount: number;
  organizationName: string;
  brandName: string;
  branding: Branding;
  pots: Pot[];
  transactions: Transaction[];
  selectedPotId: string | null;
  onSelectPot: (id: string) => void;
  onTab: (t: Tab) => void;
}) {
  const balanceFor = (potId: string) =>
    transactions
      .filter((t) => t.potId === potId)
      .reduce(
        (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
        0,
      );
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-navy-900 bg-navy-900 px-5 py-6 text-navy-100 lg:flex dark:border-navy-800">
      <div className="mb-8 flex items-center gap-2.5">
        <BrandLogo branding={branding} variant="light" />
        <div>
          <div className="text-sm font-bold text-white">{brandName}</div>
          <div className="truncate text-xs text-navy-300">{organizationName}</div>
        </div>
      </div>

      <nav className="space-y-1 text-sm">
        <NavItem
          active={tab === "potjes"}
          onClick={() => onTab("potjes")}
          icon={
            <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />
          }
          label="Dashboard"
          badge={potsCount > 0 ? String(potsCount) : undefined}
        />
        {isAdmin && (
          <>
            <NavItem
              active={tab === "leden"}
              onClick={() => onTab("leden")}
              icon={
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />
              }
              label="Leden"
              badge={String(membersCount)}
            />
            <NavItem
              active={tab === "activiteit"}
              onClick={() => onTab("activiteit")}
              icon={
                <path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              }
              label="Activiteit"
              badge={auditCount > 0 ? String(Math.min(auditCount, 99)) : undefined}
            />
            <NavItem
              active={tab === "instellingen"}
              onClick={() => onTab("instellingen")}
              icon={
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              }
              label="Instellingen"
            />
          </>
        )}
      </nav>

      {pots.length > 0 && (
        <div className="mt-6 border-t border-navy-800 pt-4">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-navy-400">
            Potjes
          </p>
          <ul className="space-y-0.5 text-sm">
            {pots.map((p) => {
              const active = tab === "potjes" && selectedPotId === p.id;
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      onTab("potjes");
                      onSelectPot(p.id);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                      active
                        ? "bg-white/10 font-semibold text-white"
                        : "text-navy-200 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: p.color ?? "#1D9E75" }}
                    />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[11px] text-navy-400">
                      €{Math.round(balanceFor(p.id))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-auto rounded-2xl border border-navy-700 bg-navy-800/60 p-4 text-xs text-navy-200">
        {adminCount > 1 ? (
          <>
            <p className="mb-1 font-semibold text-white">{adminCount} admins</p>
            <p>Meerdere mensen kunnen volledige toegang hebben tot de organisatie.</p>
          </>
        ) : (
          <>
            <p className="mb-1 font-semibold text-white">💡 Tip</p>
            <p>Schakel rechtsboven van rol om te zien wat een potjesbeheerder ziet.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function BottomNav({
  tab,
  potsCount,
  membersCount,
  auditCount,
  onTab,
}: {
  tab: Tab;
  potsCount: number;
  membersCount: number;
  auditCount: number;
  onTab: (t: Tab) => void;
}) {
  const items: { tab: Tab; label: string; icon: ReactNode; badge?: string }[] = [
    {
      tab: "potjes",
      label: "Dashboard",
      badge: potsCount > 0 ? String(potsCount) : undefined,
      icon: <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />,
    },
    {
      tab: "leden",
      label: "Leden",
      badge: membersCount > 1 ? String(membersCount) : undefined,
      icon: (
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />
      ),
    },
    {
      tab: "activiteit",
      label: "Activiteit",
      badge: auditCount > 0 ? String(Math.min(auditCount, 99)) : undefined,
      icon: <path d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
    },
    {
      tab: "instellingen",
      label: "Instellingen",
      icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-navy-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_-2px_rgba(15,23,42,0.06)] lg:hidden dark:border-navy-800 dark:bg-navy-900"
      aria-label="Navigatie"
    >
      {items.map((it) => {
        const active = tab === it.tab;
        return (
          <button
            key={it.tab}
            onClick={() => onTab(it.tab)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
              active
                ? "text-mint-600 dark:text-mint-400"
                : "text-navy-400 hover:text-navy-700 dark:text-navy-400 dark:hover:text-white"
            }`}
          >
            <span className="relative">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                {it.icon}
              </svg>
              {it.badge && (
                <span className="absolute -right-1.5 -top-1 flex min-w-[14px] items-center justify-center rounded-full bg-mint-500 px-1 text-[9px] font-bold text-white">
                  {it.badge}
                </span>
              )}
            </span>
            <span>{it.label}</span>
            {active && (
              <span className="absolute -top-px h-0.5 w-8 rounded-full bg-mint-500" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function BrandLogo({
  branding,
  size = 36,
  variant = "default",
}: {
  branding: Branding;
  size?: number;
  variant?: "default" | "light";
}) {
  if (branding.logoDataUrl) {
    return (
      <span
        className={`flex items-center justify-center overflow-hidden rounded-xl ${
          variant === "light" ? "bg-white/10 ring-1 ring-white/20" : "bg-canvas dark:bg-navy-800"
        }`}
        style={{ width: size, height: size }}
      >
        <img
          src={branding.logoDataUrl}
          alt="Logo"
          className="h-full w-full object-contain"
        />
      </span>
    );
  }
  return <Mark size={size} variant={variant} />;
}

function NavItem({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${
        active
          ? "bg-white/10 text-white"
          : "text-navy-200 hover:bg-white/5 hover:text-white"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {icon}
      </svg>
      <span className="flex-1 text-left font-semibold">{label}</span>
      {badge && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold">
          {badge}
        </span>
      )}
    </button>
  );
}

function Topbar({
  account,
  members,
  currentUserId,
  brandName,
  branding,
  onSwitchUser,
  onLogout,
}: {
  account: Account;
  members: ReturnType<typeof useAppState>["state"]["members"];
  currentUserId: string | null;
  brandName: string;
  branding: Branding;
  onSwitchUser: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <header className="border-b border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <BrandLogo branding={branding} size={32} />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-sm font-bold text-navy-900 dark:text-white">
              {brandName}
            </div>
            <div className="truncate text-[10px] text-navy-400 dark:text-navy-300">
              {account.organizationName}
            </div>
          </div>
        </div>
        <div className="hidden lg:block" />

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
          <ThemeToggle />
          <UserSwitcher
            members={members}
            currentUserId={currentUserId}
            onChange={onSwitchUser}
          />
          <div className="hidden items-center gap-3 border-l border-navy-100 pl-3 dark:border-navy-700 sm:flex">
            <div className="text-right">
              <div className="text-sm font-semibold text-navy-900 dark:text-navy-50">
                {account.fullName}
              </div>
              <div className="text-xs text-navy-400 dark:text-navy-300">{account.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="rounded-xl p-2 text-navy-500 transition hover:bg-navy-50 hover:text-navy-900 sm:hidden dark:text-navy-300 dark:hover:bg-navy-800 dark:hover:text-white"
            aria-label="Uitloggen"
            title="Uitloggen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
          <button onClick={onLogout} className="hidden btn-ghost sm:inline-flex">
            Uitloggen
          </button>
        </div>
      </div>
    </header>
  );
}

export default App;
