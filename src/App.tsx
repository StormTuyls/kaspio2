import { useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { useAppState, visiblePots } from "./storage";
import { useSession } from "./auth";
import type { UserAccount } from "./auth";
import { Overview } from "./views/Overview";
import { PotDetail } from "./views/PotDetail";
import { MembersView } from "./views/MembersView";
import { Landing } from "./views/Landing";
import { AuthView } from "./views/AuthView";
import { Modal } from "./components/Modal";
import { PotForm } from "./components/PotForm";
import { TransactionForm } from "./components/TransactionForm";
import { UserSwitcher } from "./components/UserSwitcher";

type Tab = "potjes" | "leden";
type PublicView = "landing" | "login" | "signup";

function App() {
  const session = useSession();
  const [publicView, setPublicView] = useState<PublicView>("landing");

  if (!session.account) {
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
        onAuth={() => session.refresh()}
        onBack={() => setPublicView("landing")}
      />
    );
  }

  return (
    <AuthedApp
      account={session.account}
      onLogout={() => session.signOut()}
    />
  );
}

function AuthedApp({
  account,
  onLogout,
}: {
  account: UserAccount;
  onLogout: () => void;
}) {
  const store = useAppState(account.id, account.fullName);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);
  const [showAddPot, setShowAddPot] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [tab, setTab] = useState<Tab>("potjes");

  const currentUser =
    store.state.members.find((m) => m.id === store.state.currentUserId) ?? null;
  const potsForUser = visiblePots(store.state.pots, currentUser);
  const selectedPot = potsForUser.find((p) => p.id === selectedPotId) ?? null;
  const isAdmin = currentUser?.role === "admin";

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-navy-500">
        Account aan het laden…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="flex min-h-screen">
        <Sidebar
          tab={tab}
          isAdmin={!!isAdmin}
          membersCount={store.state.members.length}
          potsCount={store.state.pots.length}
          organizationName={account.organizationName}
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
            onSwitchUser={(id) => {
              store.setCurrentUser(id);
              setSelectedPotId(null);
              setTab("potjes");
            }}
            onLogout={onLogout}
          />

          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
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
              <MembersView
                members={store.state.members}
                currentUserId={store.state.currentUserId}
                onAdd={(values) => store.addMember(values)}
                onUpdate={(id, values) => store.updateMember(id, values)}
                onDelete={(id) => store.deleteMember(id)}
              />
            ) : (
              <Overview
                pots={potsForUser}
                allTransactions={store.state.transactions}
                members={store.state.members}
                currentUser={currentUser}
                organizationName={account.organizationName}
                onSelect={(id) => setSelectedPotId(id)}
                onAddPot={() => setShowAddPot(true)}
              />
            )}
          </main>
        </div>
      </div>

      <Modal open={showAddPot} title="Nieuw potje" onClose={() => setShowAddPot(false)}>
        <PotForm
          members={store.state.members}
          onSubmit={(values) => {
            store.addPot(values);
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
    </div>
  );
}

function Sidebar({
  tab,
  isAdmin,
  membersCount,
  potsCount,
  organizationName,
  onTab,
}: {
  tab: Tab;
  isAdmin: boolean;
  membersCount: number;
  potsCount: number;
  organizationName: string;
  onTab: (t: Tab) => void;
}) {
  return (
    <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-navy-100 bg-navy-900 px-5 py-6 text-navy-100 lg:flex">
      <div className="mb-8 flex items-center gap-2">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-mint-500/15 ring-1 ring-mint-500/40">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2fbf71" strokeWidth="2">
            <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
        </span>
        <div>
          <div className="text-sm font-bold text-white">Potly</div>
          <div className="truncate text-xs text-navy-300">{organizationName}</div>
        </div>
      </div>

      <nav className="space-y-1 text-sm">
        <NavItem
          active={tab === "potjes"}
          onClick={() => onTab("potjes")}
          icon={
            <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8zM9 8V6a3 3 0 0 1 6 0v2" />
          }
          label="Potjes"
          badge={potsCount > 0 ? String(potsCount) : undefined}
        />
        {isAdmin && (
          <NavItem
            active={tab === "leden"}
            onClick={() => onTab("leden")}
            icon={
              <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6z" />
            }
            label="Leden"
            badge={String(membersCount)}
          />
        )}
      </nav>

      <div className="mt-auto rounded-2xl border border-navy-700 bg-navy-800 p-4 text-xs text-navy-200">
        <p className="mb-1 font-semibold text-white">💡 Tip</p>
        <p>Schakel rechtsboven van rol om te zien wat een potjesbeheerder ziet.</p>
      </div>
    </aside>
  );
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
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
  onSwitchUser,
  onLogout,
}: {
  account: UserAccount;
  members: ReturnType<typeof useAppState>["state"]["members"];
  currentUserId: string | null;
  onSwitchUser: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <header className="border-b border-navy-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="lg:hidden flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          </span>
          <div>
            <div className="text-sm font-bold text-navy-900">Potly</div>
            <div className="text-[10px] text-navy-400">{account.organizationName}</div>
          </div>
        </div>
        <div className="hidden lg:block" />

        <div className="flex items-center gap-2 sm:gap-3">
          <UserSwitcher
            members={members}
            currentUserId={currentUserId}
            onChange={onSwitchUser}
          />
          <div className="hidden items-center gap-3 border-l border-navy-100 pl-3 sm:flex">
            <div className="text-right">
              <div className="text-sm font-semibold text-navy-900">{account.fullName}</div>
              <div className="text-xs text-navy-400">{account.email}</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-navy-500 transition hover:bg-navy-50 hover:text-navy-900"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </header>
  );
}

export default App;
