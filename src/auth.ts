import { useEffect, useState } from "react";

export type UserAccount = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  organizationName: string;
  createdAt: string;
};

const ACCOUNTS_KEY = "kaspio:accounts";
const SESSION_KEY = "kaspio:session";

if (typeof window !== "undefined") {
  try {
    for (const [oldKey, newKey] of [
      ["potjesbeheer:accounts", ACCOUNTS_KEY],
      ["potjesbeheer:session", SESSION_KEY],
    ] as const) {
      const legacy = localStorage.getItem(oldKey);
      if (legacy != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, legacy);
      }
    }
  } catch {
    // ignore migration failures
  }
}

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadAccounts(): UserAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as UserAccount[]) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: UserAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(accountId: string | null) {
  if (accountId) localStorage.setItem(SESSION_KEY, accountId);
  else localStorage.removeItem(SESSION_KEY);
}

export function getAccountById(id: string): UserAccount | null {
  return loadAccounts().find((a) => a.id === id) ?? null;
}

export async function signup(input: {
  email: string;
  password: string;
  fullName: string;
  organizationName: string;
}): Promise<UserAccount> {
  const email = input.email.trim().toLowerCase();
  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === email)) {
    throw new Error("Dit e-mailadres is al geregistreerd.");
  }
  if (input.password.length < 6) {
    throw new Error("Wachtwoord moet minstens 6 tekens lang zijn.");
  }
  const account: UserAccount = {
    id: crypto.randomUUID(),
    email,
    passwordHash: await hashPassword(input.password),
    fullName: input.fullName.trim(),
    organizationName: input.organizationName.trim(),
    createdAt: new Date().toISOString(),
  };
  saveAccounts([...accounts, account]);
  setSession(account.id);
  return account;
}

export async function login(email: string, password: string): Promise<UserAccount> {
  const normalized = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  const account = loadAccounts().find(
    (a) => a.email === normalized && a.passwordHash === hash,
  );
  if (!account) throw new Error("Verkeerd e-mailadres of wachtwoord.");
  setSession(account.id);
  return account;
}

export function logout() {
  setSession(null);
}

export function useSession() {
  const [accountId, setAccountId] = useState<string | null>(() => getSession());
  const [account, setAccount] = useState<UserAccount | null>(() =>
    accountId ? getAccountById(accountId) : null,
  );

  useEffect(() => {
    setAccount(accountId ? getAccountById(accountId) : null);
  }, [accountId]);

  return {
    account,
    refresh: () => setAccountId(getSession()),
    signOut: () => {
      logout();
      setAccountId(null);
    },
  };
}
