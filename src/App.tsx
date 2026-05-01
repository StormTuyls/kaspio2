import { useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { useAppState, visiblePots } from "./storage";
import { useSession } from "./auth";
import type { UserAccount } from "./auth";
import { Overview } from "./views/Overview";
import { PotDetail } from "./views/PotDetail";
import { MembersView } from "./views/MembersView";
import { AuditView } from "./views/AuditView";
import { SettingsView } from "./views/SettingsView";
import { Landing } from "./views/Landing";
import { AuthView } from "./views/AuthView";
import { Modal } from "./components/Modal";
import { PotForm } from "./components/PotForm";
import { TransactionForm } from "./components/TransactionForm";
import { UserSwitcher } from "./components/UserSwitcher";
import { ThemeToggle } from "./components/ThemeToggle";
import { Mark } from "./components/Logo";

type Tab = "potjes" | "leden" | "activiteit" | "instellingen";
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

  return <AuthedApp account={session.account} onLogout={() => session.signOut()} />;
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
  const adminCount = store.state.members.filter((m) => m.role === "admin").length;

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-navy-500 dark:bg-navy-950 dark:text-navy-300">
        Account aan het laden…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas dark:bg-navy-950">
      <div className="flex min-h-screen">
        <Sidebar
          tab={tab}
          isAdmin={!!isAdmin}
          membersCount={store.state.members.length}
          potsCount={store.state.pots.length}
          adminCount={adminCount}
          auditCount={store.state.auditLog.length}
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
            ) : tab === "activiteit" && isAdmin ? (
              <AuditView entries={store.state.auditLog} onClear={() => store.clearAuditLog()} />
            ) : tab === "instellingen" && isAdmin ? (
              <SettingsView
                account={account}
                notifications={store.state.notifications}
                onChange={(patch) => store.updateNotifications(patch)}
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
  adminCount,
  auditCount,
  organizationName,
  onTab,
}: {
  tab: Tab;
  isAdmin: boolean;
  membersCount: number;
  potsCount: number;
  adminCount: number;
  auditCount: number;
  organizationName: string;
  onTab: (t: Tab) => void;
}) {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-navy-900 bg-navy-900 px-5 py-6 text-navy-100 lg:flex dark:border-navy-800">
      <div className="mb-8 flex items-center gap-2.5">
        <Mark size={36} variant="light" />
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
    <header className="border-b border-navy-100 bg-white dark:border-navy-800 dark:bg-navy-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2 lg:hidden">
          <Mark size={32} />
          <div>
            <div className="text-sm font-bold text-navy-900 dark:text-white">Potly</div>
            <div className="text-[10px] text-navy-400 dark:text-navy-300">
              {account.organizationName}
            </div>
          </div>
        </div>
        <div className="hidden lg:block" />

        <div className="flex items-center gap-2 sm:gap-3">
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
          <button onClick={onLogout} className="btn-ghost">
            Uitloggen
          </button>
        </div>
      </div>
    </header>
  );
}

export default App;
