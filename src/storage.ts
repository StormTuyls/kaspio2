import { useEffect, useState } from "react";
import type { AppState, Member, Pot, Role, Transaction } from "./types";

const STORAGE_KEY_PREFIX = "potjesbeheer:data:";

const emptyState: AppState = {
  members: [],
  pots: [],
  transactions: [],
  currentUserId: null,
};

function storageKey(accountId: string) {
  return STORAGE_KEY_PREFIX + accountId;
}

function loadState(accountId: string): AppState {
  if (typeof window === "undefined") return emptyState;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      members: Array.isArray(parsed.members) ? parsed.members : [],
      pots: Array.isArray(parsed.pots) ? parsed.pots : [],
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      currentUserId: parsed.currentUserId ?? null,
    };
  } catch {
    return emptyState;
  }
}

function saveState(accountId: string, state: AppState) {
  window.localStorage.setItem(storageKey(accountId), JSON.stringify(state));
}

export function useAppState(accountId: string, bootstrapAdminName?: string) {
  const [state, setState] = useState<AppState>(() => {
    const loaded = loadState(accountId);
    if (loaded.members.length === 0 && bootstrapAdminName) {
      const admin: Member = {
        id: crypto.randomUUID(),
        name: bootstrapAdminName,
        role: "admin",
        createdAt: new Date().toISOString(),
      };
      const initial: AppState = { ...loaded, members: [admin], currentUserId: admin.id };
      saveState(accountId, initial);
      return initial;
    }
    return loaded;
  });

  useEffect(() => {
    saveState(accountId, state);
  }, [accountId, state]);

  return {
    state,
    setCurrentUser(id: string | null) {
      setState((s) => ({ ...s, currentUserId: id }));
    },
    addMember(input: { name: string; role: Role }) {
      const member: Member = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => {
        const next = { ...s, members: [...s.members, member] };
        if (!s.currentUserId) next.currentUserId = member.id;
        return next;
      });
      return member;
    },
    updateMember(id: string, patch: Partial<Pick<Member, "name" | "role">>) {
      setState((s) => ({
        ...s,
        members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      }));
    },
    deleteMember(id: string) {
      setState((s) => {
        const ownsAnyPot = s.pots.some((p) => p.ownerId === id);
        if (ownsAnyPot) {
          alert("Dit lid is verantwoordelijke van een potje. Wijs het potje eerst toe aan iemand anders.");
          return s;
        }
        return {
          ...s,
          members: s.members.filter((m) => m.id !== id),
          currentUserId: s.currentUserId === id ? null : s.currentUserId,
        };
      });
    },
    addPot(input: { name: string; ownerId: string; targetAmount?: number }) {
      const pot: Pot = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, pots: [...s.pots, pot] }));
      return pot;
    },
    updatePot(id: string, patch: Partial<Pick<Pot, "name" | "ownerId" | "targetAmount">>) {
      setState((s) => ({
        ...s,
        pots: s.pots.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      }));
    },
    deletePot(id: string) {
      setState((s) => ({
        ...s,
        pots: s.pots.filter((p) => p.id !== id),
        transactions: s.transactions.filter((t) => t.potId !== id),
      }));
    },
    addTransaction(input: Omit<Transaction, "id" | "createdAt">) {
      const tx: Transaction = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({ ...s, transactions: [...s.transactions, tx] }));
      return tx;
    },
    deleteTransaction(id: string) {
      setState((s) => ({
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
      }));
    },
  };
}

export function calcBalance(transactions: Transaction[], potId: string) {
  return transactions
    .filter((t) => t.potId === potId)
    .reduce((sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount), 0);
}

export function visiblePots(pots: Pot[], currentUser: Member | null): Pot[] {
  if (!currentUser) return [];
  if (currentUser.role === "admin") return pots;
  return pots.filter((p) => p.ownerId === currentUser.id);
}

export function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-BE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(new Date(iso));
}
