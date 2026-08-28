export type Role = "admin" | "pot_owner" | "reader" | "group_owner";

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
  /**
   * Bijgestelde verwachting naast targetAmount. Leeg = geen prognose, dan is
   * het budget nog steeds het plan.
   */
  forecastAmount?: number;
  /** Default 'saving' voor alles wat van voor de budgetpotjes dateert. */
  targetKind?: PotTargetKind;
  /** Optionele potgroep (tak, ploeg, werkgroep). */
  groupId?: string | null;
  createdAt: string;
};

export type PotGroup = {
  id: string;
  name: string;
  /**
   * De hoofdgroep waar deze subgroep onder hangt. null = hoofdgroep. Maximaal
   * één niveau diep, de databank dwingt dat af (check_group_depth).
   */
  parentId: string | null;
  sortOrder: number;
};

export type TransactionDirection = "in" | "out";

export type Transaction = {
  /**
   * Id van de ALLOCATIE, niet van de bankregel. Eén bankregel kan over
   * meerdere potjes gesplitst zijn en verschijnt dan als meerdere rijen.
   * Voor alles wat de bankregel zelf raakt (verwijderen, bijlagen, toewijzen)
   * moet je `transactionId` gebruiken.
   */
  id: string;
  /** Id van de bankregel waar deze rij een stuk van is. */
  transactionId: string;
  /** null = staat in de hoofdpot. */
  potId: string | null;
  /**
   * Alleen zinvol voor rijen in de hoofdpot: is er al over beslist? Onbeslist
   * geld staat in de inbox en kan niet verdeeld worden.
   */
  confirmed?: boolean;
  direction: TransactionDirection;
  amount: number;
  occurredOn: string;
  counterparty: string;
  memo?: string;
  /** 'pending' = wacht op goedkeuring (telt niet mee in saldo). */
  status?: "approved" | "pending";
  /** Gezet op beide benen van een overboeking tussen potjes (uit + in). */
  transferGroup?: string | null;
  /**
   * Rekening waarop deze verrichting stond, zoals op het afschrift. Leeg voor
   * regels die Kaspio zelf maakte en voor imports van voor deze kolom bestond.
   */
  bankAccount?: string | null;
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
