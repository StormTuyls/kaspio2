// =============================================================================
// Kaspio data layer (Supabase)
// =============================================================================
// Hooks die de Supabase database wrappen. Vervangt geleidelijk de localStorage
// data layer (src/storage.ts). Sprint 2A: orgs + pots + transactions.
// Sprint 2B (later): members, audit log, notifications, branding.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import type {
  MemberRole,
  Organisation,
  Pot,
  Transaction,
} from "./supabase";
import { supabase } from "./supabase";

// =============================================================================
// useCurrentOrg
// =============================================================================
// Geeft de eerste organisatie terug waar de huidige user lid van is.
// (Multi-org switch komt later, voor nu één org per user.)

export function useCurrentOrg() {
  const [org, setOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("organisations")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (err) setError(err.message);
    else setOrg((data as Organisation | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  return { org, loading, error, refresh: fetchOrg };
}

// =============================================================================
// usePots
// =============================================================================

export type PotInput = {
  name: string;
  color: string;
  targetAmount?: number | null;
  description?: string | null;
};

export function usePots(orgId: string | null) {
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPots = useCallback(async () => {
    if (!orgId) {
      setPots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("pots")
      .select("*")
      .eq("organisation_id", orgId)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setPots((data as Pot[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchPots();
  }, [fetchPots]);

  async function addPot(input: PotInput): Promise<{ error: string | null }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const row = {
      organisation_id: orgId,
      name: input.name,
      color: input.color,
      target_amount: input.targetAmount ?? null,
      description: input.description ?? null,
    };
    const { error: err } = await supabase
      .from("pots")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(row as any);
    if (err) return { error: err.message };
    await fetchPots();
    return { error: null };
  }

  async function updatePot(
    id: string,
    patch: Partial<PotInput>,
  ): Promise<{ error: string | null }> {
    const updateRow: Record<string, unknown> = {};
    if (patch.name !== undefined) updateRow.name = patch.name;
    if (patch.color !== undefined) updateRow.color = patch.color;
    if (patch.targetAmount !== undefined)
      updateRow.target_amount = patch.targetAmount;
    if (patch.description !== undefined)
      updateRow.description = patch.description;
    const { error: err } = await (
      supabase.from("pots") as unknown as {
        update: (
          v: Record<string, unknown>,
        ) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> };
      }
    )
      .update(updateRow)
      .eq("id", id);
    if (err) return { error: err.message };
    await fetchPots();
    return { error: null };
  }

  async function deletePot(id: string): Promise<{ error: string | null }> {
    const { error: err } = await supabase.from("pots").delete().eq("id", id);
    if (err) return { error: err.message };
    await fetchPots();
    return { error: null };
  }

  return { pots, loading, error, addPot, updatePot, deletePot, refresh: fetchPots };
}

// =============================================================================
// useTransactions
// =============================================================================

export type TransactionInput = {
  potId: string;
  amount: number;
  direction: "in" | "out";
  occurredOn: string; // YYYY-MM-DD
  memo?: string | null;
  counterparty?: string | null;
};

export function useTransactions(orgId: string | null, potId?: string | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!orgId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("organisation_id", orgId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (potId) query = query.eq("pot_id", potId);
    const { data, error: err } = await query;
    if (err) setError(err.message);
    else setTransactions((data as Transaction[]) ?? []);
    setLoading(false);
  }, [orgId, potId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function addTransaction(
    input: TransactionInput,
  ): Promise<{ error: string | null }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const row = {
      organisation_id: orgId,
      pot_id: input.potId,
      amount: input.amount,
      direction: input.direction,
      occurred_on: input.occurredOn,
      memo: input.memo ?? null,
      counterparty: input.counterparty ?? null,
    };
    const { error: err } = await supabase
      .from("transactions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(row as any);
    if (err) return { error: err.message };
    await fetchTransactions();
    return { error: null };
  }

  async function deleteTransaction(
    id: string,
  ): Promise<{ error: string | null }> {
    const { error: err } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    if (err) return { error: err.message };
    await fetchTransactions();
    return { error: null };
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    deleteTransaction,
    refresh: fetchTransactions,
  };
}

// =============================================================================
// Pot balance helper
// =============================================================================

/** Compute saldo van een potje uit een lijst transactions. */
export function potBalance(potId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.pot_id === potId)
    .reduce(
      (sum, t) => sum + (t.direction === "in" ? Number(t.amount) : -Number(t.amount)),
      0,
    );
}

// =============================================================================
// useOrgInvites , beheer pending invites voor een org (admin-only via RLS)
// =============================================================================

export type OrgInvite = {
  id: string;
  organisation_id: string;
  email: string;
  role: MemberRole;
  pot_id: string | null;
  invited_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export type InviteInput = {
  email: string;
  role: MemberRole;
  potId?: string | null;
  expiresAt?: string | null;
};

export function useOrgInvites(orgId: string | null) {
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    if (!orgId) {
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("org_invites")
      .select("*")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false });
    if (!error && data) setInvites(data as OrgInvite[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  async function sendInvite(
    input: InviteInput,
  ): Promise<{ error: string | null }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const { error } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "create_org_invite" as any,
      {
        p_org_id: orgId,
        p_email: input.email.trim().toLowerCase(),
        p_role: input.role,
        p_pot_id: input.potId ?? null,
        p_expires_at: input.expiresAt ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
    if (error) return { error: error.message };
    await fetchInvites();
    return { error: null };
  }

  async function revokeInvite(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from("org_invites")
      .delete()
      .eq("id", id);
    if (error) return { error: error.message };
    await fetchInvites();
    return { error: null };
  }

  return { invites, loading, sendInvite, revokeInvite, refresh: fetchInvites };
}

// =============================================================================
// acceptPendingInvites , éénmalige RPC call bij login
// =============================================================================

export async function acceptPendingInvites(): Promise<number> {
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "accept_pending_invites" as any,
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[Kaspio] accept_pending_invites failed:", error.message);
    return 0;
  }
  return (data as number) ?? 0;
}

// =============================================================================
// useOrgMembers , active memberships voor een org (joined met profiles)
// =============================================================================

export type OrgMember = {
  membership_id: string;
  user_id: string;
  organisation_id: string;
  role: MemberRole;
  pot_id: string | null;
  created_at: string;
  full_name: string;
  email: string;
};

type MembershipWithProfile = {
  id: string;
  user_id: string;
  organisation_id: string;
  role: MemberRole;
  pot_id: string | null;
  created_at: string;
  profile: {
    full_name: string;
    email: string;
  } | null;
};

export function useOrgMembers(orgId: string | null) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("memberships")
      .select("id, user_id, organisation_id, role, pot_id, created_at, profile:profiles(full_name, email)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      const rows = data as unknown as MembershipWithProfile[];
      setMembers(
        rows.map((m) => ({
          membership_id: m.id,
          user_id: m.user_id,
          organisation_id: m.organisation_id,
          role: m.role,
          pot_id: m.pot_id,
          created_at: m.created_at,
          full_name: m.profile?.full_name ?? "Onbekend",
          email: m.profile?.email ?? "",
        })),
      );
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function updateRole(
    membershipId: string,
    role: MemberRole,
    potId: string | null,
  ): Promise<{ error: string | null }> {
    const { error } = await (
      supabase.from("memberships") as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: Error | null }>;
        };
      }
    )
      .update({ role, pot_id: potId })
      .eq("id", membershipId);
    if (error) return { error: error.message };
    await fetchMembers();
    return { error: null };
  }

  async function removeMember(
    membershipId: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", membershipId);
    if (error) return { error: error.message };
    await fetchMembers();
    return { error: null };
  }

  return { members, loading, updateRole, removeMember, refresh: fetchMembers };
}

// =============================================================================
// useAuditLog , chronologisch overzicht van mutations binnen de org
// =============================================================================

export type AuditRow = {
  id: string;
  organisation_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name: string;
};

type AuditRowRaw = {
  id: string;
  organisation_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: { full_name: string } | null;
};

export function useAuditLog(orgId: string | null, limit = 100) {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLog = useCallback(async () => {
    if (!orgId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_log")
      .select("*, actor:profiles!user_id(full_name)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && data) {
      const rows = data as unknown as AuditRowRaw[];
      setEntries(
        rows.map((r) => ({
          id: r.id,
          organisation_id: r.organisation_id,
          user_id: r.user_id,
          action: r.action,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          metadata: r.metadata ?? {},
          created_at: r.created_at,
          actor_name: r.actor?.full_name ?? "Systeem",
        })),
      );
    }
    setLoading(false);
  }, [orgId, limit]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  return { entries, loading, refresh: fetchLog };
}
