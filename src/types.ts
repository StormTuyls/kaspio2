export type Role = "admin" | "pot_owner";

export type Member = {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
};

export type Pot = {
  id: string;
  name: string;
  ownerId: string;
  color?: string;
  targetAmount?: number;
  createdAt: string;
};

export type TransactionDirection = "in" | "out";

export type Transaction = {
  id: string;
  potId: string;
  direction: TransactionDirection;
  amount: number;
  occurredOn: string;
  counterparty: string;
  memo?: string;
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
