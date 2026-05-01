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

export type AppState = {
  members: Member[];
  pots: Pot[];
  transactions: Transaction[];
  currentUserId: string | null;
};
