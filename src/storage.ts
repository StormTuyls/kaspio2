import { useEffect, useState } from "react";
import type {
  AppState,
  AuditAction,
  AuditEntityType,
  AuditEntry,
  Member,
  NotificationSettings,
  Pot,
  PotTargetKind,
  Role,
  Transaction,
} from "./types";
import { defaultNotificationSettings } from "./types";
import type { Branding } from "./branding";
import { defaultBranding } from "./branding";

const STORAGE_KEY_PREFIX = "kaspio:data:";
const LEGACY_STORAGE_KEY_PREFIX = "potjesbeheer:data:";
const MAX_AUDIT_ENTRIES = 500;

if (typeof window !== "undefined") {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(LEGACY_STORAGE_KEY_PREFIX)) {
        const newKey = STORAGE_KEY_PREFIX + key.slice(LEGACY_STORAGE_KEY_PREFIX.length);
        if (!window.localStorage.getItem(newKey)) {
          window.localStorage.setItem(newKey, window.localStorage.getItem(key) ?? "");
        }
      }
    }
  } catch {
    // ignore migration failures
  }
}

const emptyState: AppState = {
  members: [],
  pots: [],
  transactions: [],
  currentUserId: null,
  auditLog: [],
  notifications: defaultNotificationSettings,
  branding: defaultBranding,
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
      auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
      notifications: { ...defaultNotificationSettings, ...(parsed.notifications ?? {}) },
      branding: { ...defaultBranding, ...(parsed.branding ?? {}) },
    };
  } catch {
    return emptyState;
  }
}

function saveState(accountId: string, state: AppState) {
  window.localStorage.setItem(storageKey(accountId), JSON.stringify(state));
}

function makeAudit(
  s: AppState,
  action: AuditAction,
  entityType: AuditEntityType,
  entityName: string,
  details?: string,
): AuditEntry {
  const actor = s.members.find((m) => m.id === s.currentUserId);
  return {
    id: crypto.randomUUID(),
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "Systeem",
    action,
    entityType,
    entityName,
    details,
    createdAt: new Date().toISOString(),
  };
}

function withAudit(s: AppState, entry: AuditEntry): AuditEntry[] {
  return [entry, ...s.auditLog].slice(0, MAX_AUDIT_ENTRIES);
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
      const initial: AppState = {
        ...loaded,
        members: [admin],
        currentUserId: admin.id,
      };
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
        const entry = makeAudit(s, "created", "member", member.name, `Rol: ${member.role}`);
        return { ...next, auditLog: withAudit(s, entry) };
      });
      return member;
    },
    updateMember(id: string, patch: Partial<Pick<Member, "name" | "role">>) {
      setState((s) => {
        const before = s.members.find((m) => m.id === id);
        const members = s.members.map((m) => (m.id === id ? { ...m, ...patch } : m));
        const after = members.find((m) => m.id === id);
        const changes: string[] = [];
        if (before && after && before.name !== after.name) {
          changes.push(`naam: ${before.name} → ${after.name}`);
        }
        if (before && after && before.role !== after.role) {
          changes.push(`rol: ${before.role} → ${after.role}`);
        }
        const entry = makeAudit(
          s,
          "updated",
          "member",
          after?.name ?? before?.name ?? "—",
          changes.join(", ") || undefined,
        );
        return { ...s, members, auditLog: withAudit(s, entry) };
      });
    },
    deleteMember(id: string) {
      setState((s) => {
        const ownsAnyPot = s.pots.some((p) => p.ownerId === id);
        if (ownsAnyPot) {
          alert(
            "Dit lid is verantwoordelijke van een potje. Wijs het potje eerst toe aan iemand anders.",
          );
          return s;
        }
        const target = s.members.find((m) => m.id === id);
        const entry = makeAudit(s, "deleted", "member", target?.name ?? "—");
        return {
          ...s,
          members: s.members.filter((m) => m.id !== id),
          currentUserId: s.currentUserId === id ? null : s.currentUserId,
          auditLog: withAudit(s, entry),
        };
      });
    },
    addPot(input: {
      name: string;
      ownerId: string;
      targetAmount?: number;
      targetKind?: PotTargetKind;
    }) {
      const pot: Pot = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => {
        const owner = s.members.find((m) => m.id === pot.ownerId);
        const entry = makeAudit(
          s,
          "created",
          "pot",
          pot.name,
          owner ? `Verantwoordelijke: ${owner.name}` : undefined,
        );
        return { ...s, pots: [...s.pots, pot], auditLog: withAudit(s, entry) };
      });
      return pot;
    },
    updatePot(
      id: string,
      patch: Partial<Pick<Pot, "name" | "ownerId" | "targetAmount" | "targetKind">>,
    ) {
      setState((s) => {
        const before = s.pots.find((p) => p.id === id);
        const pots = s.pots.map((p) => (p.id === id ? { ...p, ...patch } : p));
        const after = pots.find((p) => p.id === id);
        const changes: string[] = [];
        if (before && after && before.name !== after.name) {
          changes.push(`naam: ${before.name} → ${after.name}`);
        }
        if (before && after && before.ownerId !== after.ownerId) {
          const oldOwner = s.members.find((m) => m.id === before.ownerId)?.name ?? "—";
          const newOwner = s.members.find((m) => m.id === after.ownerId)?.name ?? "—";
          changes.push(`verantwoordelijke: ${oldOwner} → ${newOwner}`);
        }
        if (before && after && before.targetAmount !== after.targetAmount) {
          changes.push(`doelbedrag aangepast`);
        }
        if (before && after && before.targetKind !== after.targetKind) {
          changes.push(
            after.targetKind === "budget" ? "omgezet naar budget" : "omgezet naar spaardoel",
          );
        }
        const entry = makeAudit(
          s,
          "updated",
          "pot",
          after?.name ?? before?.name ?? "—",
          changes.join(", ") || undefined,
        );
        return { ...s, pots, auditLog: withAudit(s, entry) };
      });
    },
    deletePot(id: string) {
      setState((s) => {
        const pot = s.pots.find((p) => p.id === id);
        const entry = makeAudit(s, "deleted", "pot", pot?.name ?? "—");
        return {
          ...s,
          pots: s.pots.filter((p) => p.id !== id),
          transactions: s.transactions.filter((t) => t.potId !== id),
          auditLog: withAudit(s, entry),
        };
      });
    },
    addTransaction(input: Omit<Transaction, "id" | "createdAt">) {
      const tx: Transaction = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      setState((s) => {
        const pot = s.pots.find((p) => p.id === tx.potId);
        const sign = tx.direction === "in" ? "+" : "−";
        const entry = makeAudit(
          s,
          "created",
          "transaction",
          pot?.name ?? "—",
          `${sign}€${tx.amount.toFixed(2)} · ${tx.counterparty}`,
        );
        return { ...s, transactions: [...s.transactions, tx], auditLog: withAudit(s, entry) };
      });
      return tx;
    },
    deleteTransaction(id: string) {
      setState((s) => {
        const tx = s.transactions.find((t) => t.id === id);
        const pot = s.pots.find((p) => p.id === tx?.potId);
        const sign = tx?.direction === "in" ? "+" : "−";
        const entry = makeAudit(
          s,
          "deleted",
          "transaction",
          pot?.name ?? "—",
          tx ? `${sign}€${tx.amount.toFixed(2)} · ${tx.counterparty}` : undefined,
        );
        return {
          ...s,
          transactions: s.transactions.filter((t) => t.id !== id),
          auditLog: withAudit(s, entry),
        };
      });
    },
    updateNotifications(patch: Partial<NotificationSettings>) {
      setState((s) => {
        const next = { ...s.notifications, ...patch };
        const entry = makeAudit(s, "updated", "settings", "Notificaties");
        return { ...s, notifications: next, auditLog: withAudit(s, entry) };
      });
    },
    updateBranding(patch: Partial<Branding>) {
      setState((s) => {
        const next = { ...s.branding, ...patch };
        const entry = makeAudit(s, "updated", "settings", "Branding");
        return { ...s, branding: next, auditLog: withAudit(s, entry) };
      });
    },
    resetBranding() {
      setState((s) => {
        const entry = makeAudit(s, "updated", "settings", "Branding gereset");
        return { ...s, branding: defaultBranding, auditLog: withAudit(s, entry) };
      });
    },
    clearAuditLog() {
      setState((s) => ({ ...s, auditLog: [] }));
    },
  };
}

/**
 * Canonieke saldo-berekening voor een potje. Eén bron van waarheid: alle views
 * en de sidebar horen dit te gebruiken. 'pending' transacties tellen niet mee
 * (wachten op goedkeuring), conform de regel in types.ts.
 *
 * potId null = de hoofdpot, dus al het geld dat nog geen potje heeft.
 */
export function calcBalance(transactions: Transaction[], potId: string | null) {
  return transactions
    .filter((t) => t.potId === potId && t.status !== "pending")
    .reduce((sum, t) => sum + (t.direction === "in" ? t.amount : -t.amount), 0);
}

/**
 * Som van de uitgaven van een potje, voor budgetopvolging. Sluit net als
 * calcBalance de transacties uit die nog op goedkeuring wachten, anders drukt
 * een openstaande uitgave het budget al op terwijl het saldo nog niet beweegt.
 */
export function calcSpent(transactions: Transaction[], potId: string) {
  return transactions
    .filter((t) => t.potId === potId && t.status !== "pending" && t.direction === "out")
    .reduce((sum, t) => sum + t.amount, 0);
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

/**
 * Korte euro-notatie voor grafiek-assen: "€ 2,5k". Het volledige formatEuro
 * ("€ 2.500,00") is breder dan de ruimte links van een grafiek en werd daar
 * afgekapt.
 */
export function formatEuroCompact(value: number) {
  if (value === 0) return "€ 0";
  if (Math.abs(value) >= 1000) {
    const k = value / 1000;
    const n = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(".", ",");
    return `€ ${n}k`;
  }
  return `€ ${Math.round(value)}`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium" }).format(new Date(iso));
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}
