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
// useMyOrgs , alle organisaties waar huidige user lid van is + welke geselecteerd
// =============================================================================

const SELECTED_ORG_STORAGE_KEY = "kaspio:selected_org";

export function useMyOrgs() {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("organisations")
      .select("*")
      .order("created_at", { ascending: true });
    if (err) {
      setError(err.message);
    } else {
      setOrgs((data as Organisation[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Als de geselecteerde org niet (meer) bestaat, default naar de eerste.
  useEffect(() => {
    if (orgs.length === 0) return;
    if (!selectedId || !orgs.find((o) => o.id === selectedId)) {
      const fallbackId = orgs[0].id;
      setSelectedIdState(fallbackId);
      try {
        window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, fallbackId);
      } catch {
        // ignore
      }
    }
  }, [orgs, selectedId]);

  const setSelected = useCallback((id: string) => {
    setSelectedIdState(id);
    try {
      window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  /** Maak een nieuwe org aan en selecteer 'm direct. */
  const createOrg = useCallback(
    async (
      name: string,
      ownerId: string,
    ): Promise<{ error: string | null; orgId?: string }> => {
      const insert = { name, owner_id: ownerId };
      const { data, error: err } = await (
        supabase.from("organisations") as unknown as {
          insert: (v: Record<string, unknown>) => {
            select: () => {
              single: () => Promise<{
                data: { id: string } | null;
                error: Error | null;
              }>;
            };
          };
        }
      )
        .insert(insert)
        .select()
        .single();
      if (err) return { error: err.message };
      await fetchOrgs();
      if (data?.id) {
        setSelectedIdState(data.id);
        try {
          window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, data.id);
        } catch {
          // ignore
        }
      }
      return { error: null, orgId: data?.id };
    },
    [fetchOrgs],
  );

  const selected = orgs.find((o) => o.id === selectedId) ?? null;

  return {
    orgs,
    selected,
    loading,
    error,
    setSelected,
    createOrg,
    refresh: fetchOrgs,
  };
}

// Backward-compat alias: useCurrentOrg blijft werken maar geeft enkel `selected` terug.
// Nieuwe code zou direct useMyOrgs moeten gebruiken voor toegang tot de full lijst.
export function useCurrentOrg() {
  const { selected, loading, error, refresh } = useMyOrgs();
  return { org: selected, loading, error, refresh };
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
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else {
      // Filter archived in JS (defensief: NULL = niet gearchiveerd)
      const rows = (data as Pot[]) ?? [];
      setPots(rows.filter((p) => p.archived !== true));
    }
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
  /** Legacy single pot_id, blijft voor backward compat. */
  pot_id: string | null;
  /** Nieuwe multi-pot toewijzing. */
  pot_ids: string[] | null;
  invited_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export type InviteInput = {
  email: string;
  role: MemberRole;
  potIds?: string[];
  expiresAt?: string | null;
};

export type InviteResult = {
  error: string | null;
  /** Beta invite code die de admin moet doorsturen aan de uitgenodigde. */
  betaCode?: string;
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

  async function sendInvite(input: InviteInput): Promise<InviteResult> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const email = input.email.trim().toLowerCase();

    // 1. Maak de org-invite (rol + pot-toewijzing)
    const { error: orgInviteError } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "create_org_invite" as any,
      {
        p_org_id: orgId,
        p_email: email,
        p_role: input.role,
        p_pot_ids: input.role === "pot_owner" ? input.potIds ?? null : null,
        p_expires_at: input.expiresAt ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
    if (orgInviteError) return { error: orgInviteError.message };

    // 2. Genereer automatisch een beta-invite-code voor diezelfde email,
    //    zodat de admin niet apart in SQL Editor hoeft te werken.
    const { data: codeData, error: codeError } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "create_invite" as any,
      {
        p_email: email,
        p_note: `Auto-generated bij org-invite naar ${email}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
    await fetchInvites();
    if (codeError) {
      // Org invite is gemaakt, beta code niet. Geen kritieke fout maar wel warnen.
      // eslint-disable-next-line no-console
      console.warn("[Kaspio] Beta-invite-code niet gegenereerd:", codeError.message);
      return { error: null };
    }
    return { error: null, betaCode: codeData as string };
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

  /** Set all permissions atomically: replaces existing memberships for this user. */
  async function setMemberPermissions(
    userId: string,
    orgId: string,
    role: MemberRole,
    potIds: string[],
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "set_member_permissions" as any,
      {
        p_org_id: orgId,
        p_user_id: userId,
        p_role: role,
        p_pot_ids: role === "pot_owner" ? potIds : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    );
    if (error) return { error: error.message };
    await fetchMembers();
    return { error: null };
  }

  async function removeMember(
    userId: string,
    orgId: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "remove_member" as any,
      { p_org_id: orgId, p_user_id: userId } as never,
    );
    if (error) return { error: error.message };
    await fetchMembers();
    return { error: null };
  }

  return {
    members,
    loading,
    setMemberPermissions,
    removeMember,
    refresh: fetchMembers,
  };
}

// =============================================================================
// Grouped members: één rij per user met al z'n permissions geaggregeerd
// =============================================================================

export type GroupedMember = {
  user_id: string;
  full_name: string;
  email: string;
  /** Effectieve rol: admin als ze er één hebben, anders pot_owner of reader. */
  effectiveRole: MemberRole;
  /** Pot IDs als ze pot_owner zijn. Lege array voor admin/reader. */
  potIds: string[];
};

export function groupMembersByUser(members: OrgMember[]): GroupedMember[] {
  const byUser = new Map<string, GroupedMember>();
  for (const m of members) {
    const existing = byUser.get(m.user_id);
    if (!existing) {
      byUser.set(m.user_id, {
        user_id: m.user_id,
        full_name: m.full_name,
        email: m.email,
        effectiveRole: m.role,
        potIds: m.pot_id ? [m.pot_id] : [],
      });
    } else {
      // Admin trumps alles
      if (m.role === "admin") existing.effectiveRole = "admin";
      else if (m.role === "reader" && existing.effectiveRole !== "admin") {
        existing.effectiveRole = "reader";
      }
      if (m.pot_id && !existing.potIds.includes(m.pot_id)) {
        existing.potIds.push(m.pot_id);
      }
    }
  }
  return Array.from(byUser.values());
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
