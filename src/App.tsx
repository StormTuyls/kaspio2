import { useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import { useAppState, visiblePots } from "./storage";
import { useSession } from "./auth";
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
      accountId={session.account.id}
      adminName={session.account.fullName}
      onLogout={() => session.signOut()}
    />
  );
}

function AuthedApp({
  accountId,
  adminName,
  onLogout,
}: {
  accountId: string;
  adminName: string;
  onLogout: () => void;
}) {
  const store = useAppState(accountId, adminName);
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
    return <div className="p-8 text-center text-gray-500">Account aan het laden…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <button
            onClick={() => {
              setSelectedPotId(null);
              setTab("potjes");
            }}
            className="flex items-center gap-2 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 8h14l-1 11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Potjesbeheer</h1>
              <p className="text-xs text-gray-500">Lokale prototype</p>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <UserSwitcher
              members={store.state.members}
              currentUserId={store.state.currentUserId}
              onChange={(id) => {
                store.setCurrentUser(id);
                setSelectedPotId(null);
                setTab("potjes");
              }}
            />
            <button
              onClick={onLogout}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Uitloggen"
            >
              Uitloggen
            </button>
          </div>
        </div>

        {isAdmin && !selectedPot && (
          <div className="mx-auto max-w-5xl px-4">
            <nav className="-mb-px flex gap-1">
              <TabButton active={tab === "potjes"} onClick={() => setTab("potjes")}>
                Potjes
              </TabButton>
              <TabButton active={tab === "leden"} onClick={() => setTab("leden")}>
                Leden ({store.state.members.length})
              </TabButton>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
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
            onSelect={(id) => setSelectedPotId(id)}
            onAddPot={() => setShowAddPot(true)}
          />
        )}
      </main>

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
      className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

export default App;
