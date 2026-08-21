export type Role = "admin" | "pot_owner" | "reader";

export type Member = {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
};

/** Hoe target_amount gelezen moet worden: saldodoel of uitgavenbudget. */
export type PotTargetKind = "saving" | "budget";

export type Pot = {
  id: string;
  name: string;
  ownerId: string;
  color?: string;
  targetAmount?: number;
  /** Default 'saving' voor alles wat van voor de budgetpotjes dateert. */
  targetKind?: PotTargetKind;
  /** Optionele potgroep (tak, ploeg, werkgroep). */
  groupId?: string | null;
  createdAt: string;
};

export type PotGroup = {
  id: string;
  name: string;
};

export type TransactionDirection = "in" | "out";

export type Transaction = {
  id: string;
  /** null = onverdeeld, nog toe te wijzen aan een potje. */
  potId: string | null;
  direction: TransactionDirection;
  amount: number;
  occurredOn: string;
  counterparty: string;
  memo?: string;
  /** 'pending' = wacht op goedkeuring (telt niet mee in saldo). */
  status?: "approved" | "pending";
  /** Gezet op beide benen van een overboeking tussen potjes (uit + in). */
  transferGroup?: string | null;
  createdAt: string;
};

export type AuditAction = "created" | "updated" | "deleted";
export type AuditEntityType = "pot" | "member" | "transaction" | "settings";

export type AuditEntry = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityName: string;
  details?: string;
  createdAt: string;
};

export type DigestFrequency = "never" | "daily" | "weekly";

export type NotificationSettings = {
  emailOnTransaction: boolean;
  emailOnPotCreated: boolean;
  emailOnMemberAdded: boolean;
  digestFrequency: DigestFrequency;
};

export const defaultNotificationSettings: NotificationSettings = {
  emailOnTransaction: true,
  emailOnPotCreated: false,
  emailOnMemberAdded: true,
  digestFrequency: "never",
};

import type { Branding } from "./branding";

export type AppState = {
  members: Member[];
  pots: Pot[];
  transactions: Transaction[];
  currentUserId: string | null;
  auditLog: AuditEntry[];
  notifications: NotificationSettings;
  branding: Branding;
};
