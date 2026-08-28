import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// ============================================================================
// CLIENT
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Nieuwe naamgeving (sb_publishable_...) heeft voorrang.
// Legacy VITE_SUPABASE_ANON_KEY blijft werken voor oudere setups.
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!SUPABASE_CONFIGURED && import.meta.env.DEV) {
  console.warn(
    "[Kaspio] VITE_SUPABASE_URL en/of VITE_SUPABASE_PUBLISHABLE_KEY ontbreken. " +
      "Maak een .env.local aan (zie .env.example). Auth en data via Supabase werken niet tot dat klaar is.",
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL ?? "https://placeholder.supabase.co",
  SUPABASE_KEY ?? "placeholder-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: "kaspio.auth",
    },
  },
);

// ============================================================================
// SESSION HOOK
// ============================================================================

/**
 * useSession() — geeft de huidige Supabase auth session terug.
 * - `session === null` betekent: niet ingelogd (kan ook nog laden zijn)
 * - `loading === true` op de eerste render terwijl we de session ophalen
 *
 * Gebruik in App.tsx:
 *   const { session, loading } = useSession();
 *   if (loading) return <Spinner />;
 *   if (!session) return <AuthView />;
 *   return <App user={session.user} />;
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

/** Sign up met email + password + extra metadata (volledige naam). */
export async function signUpWithPassword(
  email: string,
  password: string,
  fullName: string,
) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
}

/** Magic-link login: stuurt een mail met klik-om-in-te-loggen link. */
export async function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
}

/** Klassieke email/password login. */
export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/** Sign out — clears session + redirects naar landing. */
export async function signOut() {
  return supabase.auth.signOut();
}

/** Vraag een wachtwoord-reset mail aan. Supabase stuurt link met recovery token. */
export async function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
}

/** Update het wachtwoord van de ingelogde (of recovering) user. */
export async function updateUserPassword(password: string) {
  return supabase.auth.updateUser({ password });
}

// ============================================================================
// DATABASE TYPES
// ============================================================================
// Deze types matchen exact met supabase/schema.sql.
// Wanneer je het schema in Supabase aanpast, update je ook deze types
// (later vervangen door auto-generated types via `supabase gen types typescript`).

export type MemberRole = "admin" | "pot_owner" | "reader" | "group_owner";
export type TransactionDirection = "in" | "out";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Organisation {
  id: string;
  name: string;
  owner_id: string;
  /** Goedkeuringsflows (Team): vereis goedkeuring voor uitgaven boven de drempel. */
  require_approval?: boolean;
  approval_threshold?: number;
  created_at: string;
  updated_at: string;
}

export interface Pot {
  id: string;
  organisation_id: string;
  name: string;
  color: string;
  target_amount: number | null;
  /**
   * Bijgestelde verwachting naast target_amount. NULL = geen prognose, dan
   * geldt het budget. Zelfde teken- en leesregels als target_amount.
   */
  forecast_amount: number | null;
  /** 'saving' = saldodoel, 'budget' = uitgavenplafond. */
  target_kind: "saving" | "budget";
  description: string | null;
  archived: boolean;
  /** Optionele potgroep (tak, ploeg, werkgroep). */
  group_id: string | null;
  /** De hoofdpot van de organisatie. Precies één per org, niet te verwijderen. */
  is_hoofdpot: boolean;
  created_at: string;
  updated_at: string;
}

export interface PotGroup {
  id: string;
  organisation_id: string;
  name: string;
  /** De hoofdgroep waar deze subgroep onder hangt. null = hoofdgroep. */
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface Membership {
  id: string;
  organisation_id: string;
  user_id: string;
  role: MemberRole;
  pot_id: string | null;
  /** Alleen voor group_owner: de groep waarvan dit lid alle potjes beheert. */
  group_id: string | null;
  invited_by: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  /** NULL = onverdeeld geld, nog toe te wijzen aan een potje (admin-only). */
  pot_id: string | null;
  organisation_id: string;
  amount: number;
  direction: TransactionDirection;
  occurred_on: string;
  memo: string | null;
  counterparty: string | null;
  created_by: string | null;
  /** Verwijst naar de originele transactie als deze uit een splitsing komt. */
  split_from: string | null;
  /** Gezet op beide benen van een overboeking tussen potjes (uit + in). */
  transfer_group?: string | null;
  /**
   * Rekening waarop de verrichting stond (IBAN als tekst). NULL voor regels die
   * Kaspio zelf maakte: verdelingen, reserveringen, overboekingen tussen potjes.
   */
  bank_account?: string | null;
  /** 'approved' (telt mee) of 'pending' (wacht op goedkeuring, telt niet mee). */
  status?: "approved" | "pending";
  created_at: string;
}

export interface AuditEntry {
  id: string;
  organisation_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type SubTier = "free" | "pro" | "team";
export type SubStatus = "active" | "trialing" | "past_due" | "canceled";

export interface Subscription {
  organisation_id: string;
  tier: SubTier;
  status: SubStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  updated_at: string;
}

export interface NotificationSettings {
  user_id: string;
  email_new_income: boolean;
  email_low_balance: boolean;
  email_digest_weekly: boolean;
  email_pending_approval: boolean;
  updated_at: string;
}

export interface PotBalance {
  pot_id: string;
  organisation_id: string;
  name: string;
  color: string;
  target_amount: number | null;
  balance: number;
  transaction_count: number;
}

// Supabase typed client schema
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      organisations: {
        Row: Organisation;
        Insert: Omit<Organisation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Organisation>;
      };
      pots: {
        Row: Pot;
        Insert: Omit<Pot, "id" | "created_at" | "updated_at" | "archived" | "group_id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          archived?: boolean;
          group_id?: string | null;
        };
        Update: Partial<Pot>;
      };
      memberships: {
        Row: Membership;
        Insert: Omit<Membership, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Membership>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "split_from"> & {
          id?: string;
          created_at?: string;
          split_from?: string | null;
        };
        Update: Partial<Transaction>;
      };
      pot_groups: {
        Row: PotGroup;
        Insert: Omit<PotGroup, "id" | "created_at" | "sort_order"> & {
          id?: string;
          created_at?: string;
          sort_order?: number;
        };
        Update: Partial<PotGroup>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: never; // alleen via Stripe-webhook (service role)
        Update: never;
      };
      audit_log: {
        Row: AuditEntry;
        Insert: never; // alleen via DB-triggers
        Update: never;
      };
      notification_settings: {
        Row: NotificationSettings;
        Insert: Partial<NotificationSettings> & { user_id: string };
        Update: Partial<NotificationSettings>;
      };
    };
    Views: {
      pot_balances: { Row: PotBalance };
    };
    Enums: {
      member_role: MemberRole;
      txn_direction: TransactionDirection;
    };
  };
}
