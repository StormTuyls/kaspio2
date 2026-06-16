import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import "./App.css";
import { useAppState } from "./storage";
import {
  acceptPendingInvites,
  groupMembersByUser,
  lookupOrgInvite,
  redeemOrgInvite,
  useAuditLog,
  useMyOrgs,
  useOrgInvites,
  useOrgMembers,
  usePotGroups,
  usePots,
  useSubscription,
  useTransactions,
} from "./data";
import { UnallocatedInbox } from "./components/UnallocatedInbox";
import { InviteMemberForm } from "./components/InviteMemberForm";
import { MembersListView } from "./views/MembersListView";
import { AuditLogView } from "./views/AuditLogView";
import { OrgOnboardingView } from "./views/OrgOnboardingView";
import { OrgSwitcher } from "./components/OrgSwitcher";
import { CreateOrgForm } from "./components/CreateOrgForm";
import type { Organisation } from "./supabase";
import type { Pot as DbPot, Transaction as DbTransaction } from "./supabase";
import type { Pot, PotGroup, Role, Transaction } from "./types";
import { signOut, supabase, useSession } from "./supabase";
import { PotsView, Avatar } from "./views/Overview";
import { DashboardView } from "./views/DashboardView";
import { GroupsView } from "./views/GroupsView";
import { PotDetail } from "./views/PotDetail";
import { SettingsView } from "./views/SettingsView";
import { Landing } from "./views/Landing";
import { AuthView } from "./views/AuthView";
import { PasswordResetView } from "./views/PasswordResetView";
import { Modal } from "./components/Modal";
import { PotForm } from "./components/PotForm";
import { TransactionForm } from "./components/TransactionForm";
import { ThemeToggle } from "./components/ThemeToggle";
import { Mark } from "./components/Logo";
import { paletteToCssVars } from "./branding";
import type { Branding } from "./branding";

type Tab = "dashboard" | "potjes" | "groepen" | "leden" | "activiteit" | "instellingen";
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

// localStorage-sleutel: org-invite-token die nog verzilverd moet worden bij de
// eerste login (overleeft een e-mailbevestiging / page reload tijdens signup).
const PENDING_INVITE_TOKEN_KEY = "kaspio.pendingInviteToken";

// Leest een invite-link (?invite=<token>&email=...) uit de URL. De
// uitnodigingslink wijst hierheen zodat de signup vooraf ingevuld is.
function parseInviteParams(): { code: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("invite");
  if (!code) return null;
  const email = params.get("email") ?? "";
  // Bewaar de token METEEN (synchroon), nog vóór de async lookup, zodat
  // useEnsureOrg 'm zeker vindt bij de eerste login , ook voor bestaande
  // accounts die direct in AuthedApp landen (geen race meer).
  try {
    localStorage.setItem(PENDING_INVITE_TOKEN_KEY, code.trim());
  } catch {
    // localStorage geblokkeerd , token wordt dan via de lookup-effect bewaard
  }
  // Maak de URL schoon zodat de params niet blijven plakken bij refresh.
  window.history.replaceState(null, "", window.location.pathname);
  return { code: code.trim(), email: email.trim() };
}

function App() {
  const { session, loading } = useSession();
  const [invitePrefill] = useState(() => parseInviteParams());
  const [publicView, setPublicView] = useState<PublicView>(
    invitePrefill ? "signup" : "landing",
  );

  // Org-invite-token uit de link valideren: is dit een geldige org-uitnodiging?
  // Zo ja, dan tonen we "word lid van <org>" en slaan we de beta-code-stap over.
  // De token wordt bewaard zodat hij bij de eerste login verzilverd wordt.
  const [orgInvite, setOrgInvite] = useState<{
    email?: string;
    orgName?: string;
  } | null>(null);
  useEffect(() => {
    if (!invitePrefill) return;
    let active = true;
    lookupOrgInvite(invitePrefill.code).then((res) => {
      if (!active) return;
      if (res.status === "ok") {
        setOrgInvite({
          email: res.email ?? invitePrefill.email,
          orgName: res.orgName,
        });
        try {
          localStorage.setItem(PENDING_INVITE_TOKEN_KEY, invitePrefill.code);
        } catch {
          // localStorage geblokkeerd , token wordt dan direct na signup verzilverd
        }
      }
    });
    return () => {
      active = false;
    };
  }, [invitePrefill]);

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
        prefillEmail={orgInvite?.email ?? invitePrefill?.email}
        orgInviteName={orgInvite?.orgName}
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

// Bij eerste login: accepteer eventuele openstaande org-invites voor deze user.
// Een uitgenodigde gebruiker wordt zo automatisch lid van de bestaande org,
// zonder zelf een organisatie te hoeven aanmaken. Returnt `processing`: zolang
// dat true is weten we nog niet of de user een org heeft, dus tonen we laden
// i.p.v. (te vroeg) het onboarding-scherm.
function useEnsureOrg(
  session: Session,
  onJoined: (orgId?: string) => void,
): boolean {
  const [processing, setProcessing] = useState(true);
  useEffect(() => {
    let active = true;
    setProcessing(true);
    (async () => {
      let joined = 0;
      let joinedOrgId: string | undefined;

      // 1. Token-gebaseerde org-invite (nieuwe flow): koppelt aan precies die
      //    org (op org-ID uit de token, niet op naam).
      let pendingToken: string | null = null;
      try {
        pendingToken = localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
      } catch {
        pendingToken = null;
      }
      if (pendingToken) {
        const res = await redeemOrgInvite(pendingToken);
        try {
          localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
        } catch {
          // negeer
        }
        if (res.status === "ok" || res.status === "accepted") {
          joinedOrgId = res.orgId;
          joined += 1;
        }
      }

      // 2. E-mail-gebaseerde invites (legacy / backward compat).
      const accepted = await acceptPendingInvites();
      joined += accepted;

      // Geef het org-ID mee zodat de app je direct in de net-gejoinde org zet
      // (i.p.v. de oude/oudste selectie te behouden).
      if (active && joined > 0) onJoined(joinedOrgId);
    })().finally(() => {
      if (active) setProcessing(false);
    });
    return () => {
      active = false;
    };
    // onJoined is stabiel (useCallback); session.user.id is de echte trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);
  return processing;
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
    // Placeholder-owner: AuthedApp overschrijft dit met de echte pot_owner
    // (zie potsWithOwner). RLS filtert op DB-niveau welke pots de user ziet.
    ownerId: currentUserId,
    targetAmount: p.target_amount ?? undefined,
    groupId: p.group_id ?? null,
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

function useBridgedStore(
  localStore: LocalStore,
  currentUserId: string,
  orgId: string | null,
) {
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
    assignTransaction: assignDbTx,
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
        groupId?: string | null;
      }) => {
        await addDbPot({
          name: input.name,
          color: input.color ?? "#1D9E75",
          targetAmount: input.targetAmount,
          description: input.description,
          groupId: input.groupId ?? null,
        });
      },
      updatePot: async (
        id: string,
        patch: {
          name?: string;
          color?: string;
          targetAmount?: number;
          description?: string;
          groupId?: string | null;
        },
      ) => {
        await updateDbPot(id, patch);
      },
      deletePot: async (id: string) => {
        await deleteDbPot(id);
      },
      addTransaction: async (input: {
        potId: string | null;
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
      assignTransaction: assignDbTx,
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
    assignDbTx,
  ]);
}

function AuthedApp({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
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
  const {
    orgs,
    selected: org,
    loading: orgLoading,
    setSelected: selectOrg,
    createOrg,
    leaveOrg,
    refresh: refreshOrgs,
  } = useMyOrgs();
  // Accepteer openstaande org-invites bij eerste login, refetch de orgs en
  // selecteer meteen de net-gejoinde org (op ID), zodat een uitgenodigde user
  // direct in de júiste org belandt en niet in een oude/gelijknamige.
  const onJoinedOrg = useCallback(
    async (joinedOrgId?: string) => {
      await refreshOrgs();
      if (joinedOrgId) selectOrg(joinedOrgId);
    },
    [refreshOrgs, selectOrg],
  );
  const ensuringInvites = useEnsureOrg(session, onJoinedOrg);
  const orgId = org?.id ?? null;
  const store = useBridgedStore(localStore, account.id, orgId);
  const { pots: dbPots } = usePots(orgId);
  const { invites, sendInvite, revokeInvite } = useOrgInvites(orgId);
  const {
    members: orgMembers,
    setMemberPermissions,
    removeMember,
  } = useOrgMembers(orgId);
  const { entries: auditEntries, loading: auditLoading } = useAuditLog(orgId);
  const { tier, limits } = useSubscription(orgId);
  const {
    groups: dbGroups,
    addGroup,
    renameGroup,
    deleteGroup,
  } = usePotGroups(orgId);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);
  const [showAddPot, setShowAddPot] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  // Toon de publieke website (landing) terwijl je ingelogd bent.
  const [viewSite, setViewSite] = useState(false);
  // Groep-sectie waar de Potjes-pagina naartoe scrollt (gezet vanuit sidebar/dashboard).
  const [focusGroup, setFocusGroup] = useState<string | null | undefined>(undefined);

  /** Maak een nieuwe org aan en switch er naartoe (sluit modal). */
  async function handleCreateOrg(name: string): Promise<{ error: string | null }> {
    const res = await createOrg(name, account.id);
    if (!res.error) setShowNewOrg(false);
    return { error: res.error };
  }

  // Bepaal effectieve rol uit de (mogelijk meerdere) membership-rijen van deze
  // user. Voorrang: admin > pot_owner > reader. Fall back op "ben ik owner van
  // de org?" als de memberships-fetch nog niet klaar is of RLS de query blokkeert
  // (voorkomt eindeloos hangen). Een non-owner zonder membership valt terug op
  // reader: read-only is de veilige minimumtoegang.
  const myMemberships = orgMembers.filter((m) => m.user_id === account.id);
  const isOwner = org?.owner_id === account.id;
  const isAdmin = isOwner || myMemberships.some((m) => m.role === "admin");
  const isPotOwner = myMemberships.some((m) => m.role === "pot_owner");
  const myRole: Role = isAdmin
    ? "admin"
    : isPotOwner
      ? "pot_owner"
      : "reader";
  const isReader = myRole === "reader";

  // Synthetische currentUser, altijd gedefinieerd zolang session bestaat.
  const currentUser = {
    id: account.id,
    name: account.fullName,
    role: myRole,
    createdAt: account.createdAt,
  };

  // Echte leden uit Supabase, gemapt naar het UI Member-type dat de views
  // verwachten (id = user_id, name = full_name). Eén rij per unieke user.
  const uiMembers = useMemo(
    () =>
      groupMembersByUser(orgMembers).map((g) => ({
        id: g.user_id,
        name: g.full_name,
        role: g.effectiveRole,
        createdAt: "",
      })),
    [orgMembers],
  );

  // pot_id -> user_id van de (eerste) pot-verantwoordelijke, voor weergave.
  const ownerByPotId = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of orgMembers) {
      if (mem.role === "pot_owner" && mem.pot_id && !m.has(mem.pot_id)) {
        m.set(mem.pot_id, mem.user_id);
      }
    }
    return m;
  }, [orgMembers]);

  // Pot-IDs waar de ingelogde user verantwoordelijke van is (multi-owner-safe).
  const myPotIds = useMemo(() => {
    const s = new Set<string>();
    for (const mem of orgMembers) {
      if (mem.user_id === account.id && mem.role === "pot_owner" && mem.pot_id) {
        s.add(mem.pot_id);
      }
    }
    return s;
  }, [orgMembers, account.id]);

  // Override de bridge-ownerId met de echte verantwoordelijke voor weergave.
  const potsWithOwner = useMemo(
    () =>
      store.state.pots.map((p) => ({
        ...p,
        ownerId: ownerByPotId.get(p.id) ?? "",
      })),
    [store.state.pots, ownerByPotId],
  );

  // RLS filtert al op DB-niveau. Admins én lezers zien alle potjes; pot-owners
  // enkel hun eigen potjes (via echte memberships, multi-owner-safe). De vroegere
  // bug: lezers vielen onder de pot-owner-filter en zagen daardoor niets.
  const potsForUser =
    isAdmin || isReader
      ? potsWithOwner
      : potsWithOwner.filter((p) => myPotIds.has(p.id));
  const selectedPot = potsForUser.find((p) => p.id === selectedPotId) ?? null;

  // Potgroepen (takken/ploegen) voor weergave-groepering.
  const uiGroups: PotGroup[] = useMemo(
    () => dbGroups.map((g) => ({ id: g.id, name: g.name })),
    [dbGroups],
  );

  // Licentie-limiet: kan er nog een potje bij? (server dwingt 't ook af)
  const canAddPot = store.state.pots.length < limits.pots;
  const goToUpgrade = () => {
    setSelectedPotId(null);
    setTab("instellingen");
  };

  // Onverdeeld geld: transacties zonder potje (RLS: alleen admins zien deze).
  const unallocatedTx = useMemo(
    () => store.state.transactions.filter((t) => t.potId === null),
    [store.state.transactions],
  );

  // Wacht op de eerste org-fetch én op het afhandelen van openstaande invites,
  // zodat een net-uitgenodigde user niet kortstondig het onboarding-scherm ziet
  // voordat accepteren + refetch klaar zijn.
  if (orgLoading || ensuringInvites) {
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
        fullName={account.fullName}
        onCreate={async (name) => {
          const res = await createOrg(name, account.id);
          return { error: res.error };
        }}
      />
    );
  }

  // Publieke website bekijken terwijl je ingelogd bent (vanuit de sidebar).
  if (viewSite) {
    return (
      <Landing
        onLogin={() => setViewSite(false)}
        onSignup={() => setViewSite(false)}
        onExitPreview={() => setViewSite(false)}
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
          auditCount={auditEntries.length}
          orgs={orgs}
          currentOrg={org}
          onSelectOrg={(id) => {
            selectOrg(id);
            setSelectedPotId(null);
          }}
          onCreateOrg={() => setShowNewOrg(true)}
          onLeaveOrg={leaveOrg}
          pots={store.state.pots}
          groups={uiGroups}
          transactions={store.state.transactions}
          selectedPotId={selectedPotId}
          onSelectPot={(id) => setSelectedPotId(id)}
          onSelectGroup={(groupId) => {
            setTab("potjes");
            setSelectedPotId(null);
            setFocusGroup(groupId);
          }}
          onViewSite={() => setViewSite(true)}
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
            brandName={brandName}
            branding={store.state.branding}
            onLogout={onLogout}
          />

          <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-8 sm:pt-8 lg:pb-8">
            {selectedPot ? (
              <PotDetail
                pot={selectedPot}
                transactions={store.state.transactions}
                members={uiMembers}
                currentUser={currentUser}
                groups={uiGroups}
                tier={tier}
                onUpgrade={goToUpgrade}
                onCreateGroup={addGroup}
                onBack={() => setSelectedPotId(null)}
                onAddTransaction={() => setShowAddTx(true)}
                onDeleteTransaction={(id) => store.deleteTransaction(id)}
                onUpdatePot={(patch) => store.updatePot(selectedPot.id, patch)}
                onDeletePot={() => {
                  store.deletePot(selectedPot.id);
                  setSelectedPotId(null);
                }}
              />
            ) : tab === "potjes" ? (
              <PotsView
                pots={potsForUser}
                allTransactions={store.state.transactions}
                members={uiMembers}
                currentUser={currentUser}
                groups={uiGroups}
                focusGroupId={focusGroup}
                onFocusConsumed={() => setFocusGroup(undefined)}
                onSelect={(id) => setSelectedPotId(id)}
                onAddPot={() => setShowAddPot(true)}
                onAddTransaction={isAdmin ? () => setShowAddTx(true) : undefined}
                canAddPot={canAddPot}
                potLimit={limits.pots}
                onUpgrade={goToUpgrade}
              />
            ) : tab === "groepen" ? (
              <GroupsView
                groups={uiGroups}
                pots={potsForUser}
                allTransactions={store.state.transactions}
                isAdmin={!!isAdmin}
                onCreateGroup={addGroup}
                onRenameGroup={renameGroup}
                onDeleteGroup={deleteGroup}
                onSelectPot={(id) => setSelectedPotId(id)}
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
                orgId={org.id}
                tier={tier}
                potCount={store.state.pots.length}
                memberCount={uiMembers.length}
                isAdmin={!!isAdmin}
                notifications={store.state.notifications}
                branding={store.state.branding}
                onChange={(patch) => store.updateNotifications(patch)}
                onBrandingChange={(patch) => store.updateBranding(patch)}
                onBrandingReset={() => store.resetBranding()}
              />
            ) : (
              <DashboardView
                pots={potsForUser}
                allTransactions={store.state.transactions}
                members={uiMembers}
                currentUser={currentUser}
                organizationName={org.name}
                groups={uiGroups}
                tier={tier}
                onUpgrade={goToUpgrade}
                onSelect={(id) => setSelectedPotId(id)}
                onOpenGroup={(groupId) => {
                  setTab("potjes");
                  setSelectedPotId(null);
                  setFocusGroup(groupId);
                }}
                onOpenInbox={isAdmin ? () => setShowInbox(true) : undefined}
              />
            )}
          </main>
        </div>
      </div>

      <BottomNav
        tab={tab}
        isAdmin={!!isAdmin}
        potsCount={store.state.pots.length}
        membersCount={orgMembers.length}
        onTab={(t) => {
          setTab(t);
          setSelectedPotId(null);
        }}
      />

      <Modal open={showAddPot} title="Nieuw potje" onClose={() => setShowAddPot(false)}>
        <PotForm
          groups={uiGroups}
          onCreateGroup={addGroup}
          onSubmit={async (values) => {
            await store.addPot(values);
            setShowAddPot(false);
          }}
          onCancel={() => setShowAddPot(false)}
        />
      </Modal>

      <Modal open={showAddTx} title="Nieuwe transactie" onClose={() => setShowAddTx(false)}>
        {showAddTx && (
          <TransactionForm
            pots={potsForUser}
            initialPotId={selectedPot?.id ?? null}
            allowUnallocated={!!isAdmin}
            onSubmit={async (values) => {
              await store.addTransaction(values);
              setShowAddTx(false);
            }}
            onCancel={() => setShowAddTx(false)}
          />
        )}
      </Modal>

      <Modal
        open={showInbox}
        title="Nog toe te wijzen"
        onClose={() => setShowInbox(false)}
      >
        <UnallocatedInbox
          transactions={unallocatedTx}
          pots={potsForUser}
          onAssign={(txId, parts) => store.assignTransaction(txId, parts)}
          onDelete={(txId) => store.deleteTransaction(txId)}
        />
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
            onInvite={(input) =>
              sendInvite({
                ...input,
                orgName: org.name,
                inviterName: account.fullName,
              })
            }
            onRevoke={revokeInvite}
            onClose={() => setShowInvite(false)}
          />
        )}
      </Modal>

      <Modal
        open={showNewOrg}
        title="Nieuwe organisatie"
        onClose={() => setShowNewOrg(false)}
      >
        <CreateOrgForm
          title="Nieuwe organisatie aanmaken"
          description="Bijv. een tweede club, vereniging of side-project. Je kunt achteraf wisselen tussen organisaties via de menubalk links."
          onCreate={handleCreateOrg}
          onCancel={() => setShowNewOrg(false)}
        />
      </Modal>
    </div>
  );
}

function Sidebar({
  tab,
  isAdmin,
  membersCount,
  potsCount,
  auditCount,
  orgs,
  currentOrg,
  onSelectOrg,
  onCreateOrg,
  onLeaveOrg,
  brandName,
  branding,
  pots,
  groups,
  transactions,
  selectedPotId,
  onSelectPot,
  onSelectGroup,
  onViewSite,
  onTab,
}: {
  tab: Tab;
  isAdmin: boolean;
  membersCount: number;
  potsCount: number;
  auditCount: number;
  orgs: Organisation[];
  currentOrg: Organisation;
  onSelectOrg: (id: string) => void;
  onCreateOrg: () => void;
  onLeaveOrg: (id: string) => Promise<{ error: string | null }>;
  brandName: string;
  branding: Branding;
  pots: Pot[];
  groups: PotGroup[];
  transactions: Transaction[];
  selectedPotId: string | null;
  onSelectPot: (id: string) => void;
  /** Spring naar een groep-sectie op de Potjes-pagina (null = ongegroepeerde). */
  onSelectGroup: (groupId: string | null) => void;
  /** Toon de publieke website (landing). */
  onViewSite: () => void;
  onTab: (t: Tab) => void;
}) {
  const balanceFor = (potId: string) =>
    transactions
      .filter((t) => t.potId === potId)
      .reduce(
        (sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount),
        0,
      );

  // Potjes per groep voor de sidebar-lijst; groepsloze potjes achteraan.
  const sidebarSections: { id: string | null; label: string | null; pots: Pot[] }[] = [
    ...groups
      .map((g) => ({
        id: g.id as string | null,
        label: g.name as string | null,
        pots: pots.filter((p) => p.groupId === g.id),
      }))
      .filter((s) => s.pots.length > 0),
    {
      id: null,
      label: null,
      pots: pots.filter(
        (p) => !p.groupId || !groups.some((g) => g.id === p.groupId),
      ),
    },
  ].filter((s) => s.pots.length > 0);
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-navy-900 bg-navy-900 px-5 py-6 text-navy-100 lg:sticky lg:top-0 lg:flex lg:h-screen dark:border-navy-800">
      <div className="mb-8">
        <button
          onClick={() => onTab("dashboard")}
          className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-white/5"
          title="Naar dashboard"
        >
          <BrandLogo branding={branding} variant="light" />
          <div className="text-sm font-bold text-white">{brandName}</div>
        </button>
        <OrgSwitcher
          orgs={orgs}
          selected={currentOrg}
          onSelect={onSelectOrg}
          onCreateNew={onCreateOrg}
          onLeave={onLeaveOrg}
        />
      </div>

      <nav className="space-y-1 text-sm">
        <NavItem
          active={tab === "dashboard"}
          onClick={() => onTab("dashboard")}
          icon={
            <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />
          }
          label="Dashboard"
        />
        <NavItem
          active={tab === "potjes"}
          onClick={() => onTab("potjes")}
          icon={
            <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM3 7l2-3h14l2 3M9 12h6" />
          }
          label="Potjes"
          badge={potsCount > 0 ? String(potsCount) : undefined}
        />
        <NavItem
          active={tab === "groepen"}
          onClick={() => onTab("groepen")}
          icon={
            <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />
          }
          label="Groepen"
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
        <div className="mt-6 flex-1 overflow-y-auto border-t border-navy-800 pt-4">
          {sidebarSections.map((section, si) => {
            const headerLabel =
              section.label ?? (sidebarSections.length > 1 ? "Overige" : "Potjes");
            return (
            <div key={section.id ?? "__rest__"} className={si > 0 ? "mt-3" : ""}>
              <button
                type="button"
                onClick={() => onSelectGroup(section.id)}
                className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wider text-navy-400 transition hover:bg-white/5 hover:text-navy-200"
                title="Toon in dashboard"
              >
                <span className="truncate">{headerLabel}</span>
                <span className="font-normal normal-case text-navy-500">
                  {section.pots.length}
                </span>
              </button>
              <ul className="space-y-0.5 text-sm">
                {section.pots.map((p) => {
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
            );
          })}
        </div>
      )}

      <button
        onClick={onViewSite}
        className="mt-auto flex flex-shrink-0 items-center gap-2 rounded-lg px-2 py-2 pt-4 text-xs font-medium text-navy-400 transition hover:text-navy-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        Bekijk website
      </button>
    </aside>
  );
}

function BottomNav({
  tab,
  isAdmin,
  potsCount,
  membersCount,
  onTab,
}: {
  tab: Tab;
  isAdmin: boolean;
  potsCount: number;
  membersCount: number;
  onTab: (t: Tab) => void;
}) {
  const items: { tab: Tab; label: string; icon: ReactNode; badge?: string }[] = [
    {
      tab: "dashboard",
      label: "Dashboard",
      icon: <path d="M3 12l9-9 9 9M5 10v10a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10" />,
    },
    {
      tab: "potjes",
      label: "Potjes",
      badge: potsCount > 0 ? String(potsCount) : undefined,
      icon: <path d="M3 7h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM3 7l2-3h14l2 3M9 12h6" />,
    },
    {
      tab: "groepen",
      label: "Groepen",
      icon: <path d="M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z" />,
    },
    ...(isAdmin
      ? [
          {
            tab: "leden" as Tab,
            label: "Leden",
            badge: membersCount > 1 ? String(membersCount) : undefined,
            icon: (
              <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />
            ),
          },
          {
            tab: "instellingen" as Tab,
            label: "Meer",
            icon: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
          },
        ]
      : []),
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
                ? "text-teal-600 dark:text-teal-400"
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
                <span className="absolute -right-1.5 -top-1 flex min-w-[14px] items-center justify-center rounded-full bg-teal-500 px-1 text-[9px] font-bold text-white">
                  {it.badge}
                </span>
              )}
            </span>
            <span>{it.label}</span>
            {active && (
              <span className="absolute -top-px h-0.5 w-8 rounded-full bg-teal-500" />
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
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${
        active
          ? "bg-teal-500/15 text-white"
          : "text-navy-200 hover:bg-white/5 hover:text-white"
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-teal-400"
        />
      )}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={active ? "text-teal-300" : ""}
      >
        {icon}
      </svg>
      <span className="flex-1 text-left font-semibold">{label}</span>
      {badge && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            active ? "bg-teal-400/20 text-teal-200" : "bg-white/10"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Topbar({
  account,
  brandName,
  branding,
  onLogout,
}: {
  account: Account;
  brandName: string;
  branding: Branding;
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
          <div className="flex items-center gap-2.5 border-l border-navy-100 pl-2.5 dark:border-navy-700 sm:pl-3">
            <Avatar name={account.fullName} />
            <div className="hidden text-right sm:block">
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
