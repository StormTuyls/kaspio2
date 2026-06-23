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
  PotGroup,
  SubTier,
  Subscription,
  Transaction,
} from "./supabase";
import { supabase } from "./supabase";
import type { NotificationSettings } from "./types";
import { defaultNotificationSettings } from "./types";

// =============================================================================
// useRealtimeRefresh , live sync via Supabase Realtime
// =============================================================================
// Abonneert op postgres_changes voor één tabel binnen één org en roept refetch
// aan bij elke wijziging (insert/update/delete). Zo zien alle tabbladen en
// gebruikers elkaars wijzigingen zonder handmatig verversen. RLS blijft gelden:
// we vertrouwen de event-payload niet, we refetchen via de normale query.
// Vereist dat de tabel in de supabase_realtime publicatie zit (zie
// supabase/realtime.sql).
//
// Elk abonnement krijgt een UNIEK channel-topic (via rtSeq). Sommige hooks
// (bv. usePots) worden meerdere keren met dezelfde orgId aangeroepen; zonder
// uniek topic hergebruikt supabase-js het al-gesubscribede channel-object en
// gooit ".on() after subscribe()". Uniek topic = altijd een vers channel.
let rtSeq = 0;
function useRealtimeRefresh(
  table: string,
  orgId: string | null,
  refetch: () => void,
) {
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`rt:${table}:${orgId}:${(rtSeq += 1)}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          filter: `organisation_id=eq.${orgId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, orgId, refetch]);
}

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
      _ownerId: string,
    ): Promise<{ error: string | null; orgId?: string }> => {
      // Gebruik de SECURITY DEFINER RPC i.p.v. direct INSERT. Die zorgt dat
      // het profile bestaat en maakt org + admin-membership atomair aan.
      // Bypasst RLS-edge cases op een gecontroleerde manier (de RPC checkt
      // auth.uid() expliciet en weigert anonieme calls).
      void _ownerId;
      const { data: newOrgId, error: err } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: string | null; error: Error | null }>
      )("create_organisation", { p_name: name });
      if (err) return { error: err.message };

      // Refetch zodat onze lijst de nieuwe org bevat.
      const { data: refreshed } = await supabase
        .from("organisations")
        .select("*")
        .order("created_at", { ascending: true });
      const list = (refreshed as Organisation[]) ?? [];
      setOrgs(list);

      const freshId =
        (typeof newOrgId === "string" ? newOrgId : null) ??
        list[list.length - 1]?.id ??
        null;
      if (freshId) {
        setSelectedIdState(freshId);
        try {
          window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, freshId);
        } catch {
          // ignore
        }
      }
      return { error: null, orgId: freshId ?? undefined };
    },
    [],
  );

  /** Verlaat een organisatie. Daarna verdwijnt 'ie uit de lijst (RLS) en
   *  valt de selectie terug op een andere org (of onboarding als er geen meer is). */
  const leaveOrg = useCallback(
    async (leaveId: string): Promise<{ error: string | null }> => {
      const { error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: Error | null }>
      )("leave_organisation", { p_org_id: leaveId });
      if (error) return { error: error.message };
      // Selectie wissen als we de actieve org verlaten; effect kiest nieuwe default.
      setSelectedIdState((cur) => (cur === leaveId ? null : cur));
      await fetchOrgs();
      return { error: null };
    },
    [fetchOrgs],
  );

  /** Verwijder een organisatie volledig (alleen de eigenaar). Cascade ruimt
   *  alle gekoppelde data op. Onomkeerbaar. */
  const deleteOrg = useCallback(
    async (deleteId: string): Promise<{ error: string | null }> => {
      const { error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ error: Error | null }>
      )("delete_organisation", { p_org_id: deleteId });
      if (error) return { error: error.message };
      setSelectedIdState((cur) => (cur === deleteId ? null : cur));
      await fetchOrgs();
      return { error: null };
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
    leaveOrg,
    deleteOrg,
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
  /** Optionele potgroep. null = expliciet geen groep. */
  groupId?: string | null;
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
  useRealtimeRefresh("pots", orgId, fetchPots);

  async function addPot(input: PotInput): Promise<{ error: string | null }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const row = {
      organisation_id: orgId,
      name: input.name,
      color: input.color,
      target_amount: input.targetAmount ?? null,
      description: input.description ?? null,
      group_id: input.groupId ?? null,
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
    if (patch.groupId !== undefined) updateRow.group_id = patch.groupId;
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
  /** null = onverdeeld, komt in de "Toe te wijzen" inbox (alleen admins). */
  potId: string | null;
  amount: number;
  direction: "in" | "out";
  occurredOn: string; // YYYY-MM-DD
  memo?: string | null;
  counterparty?: string | null;
};

/** Eén deel van een toewijzing: bedrag X naar potje Y. */
export type AssignPart = {
  potId: string;
  amount: number;
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
  useRealtimeRefresh("transactions", orgId, fetchTransactions);

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

  /** Bulk-import (CSV): één insert voor alle rijen, daarna één refresh. */
  async function importTransactions(
    inputs: TransactionInput[],
  ): Promise<{ error: string | null; count: number }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd.", count: 0 };
    if (inputs.length === 0) return { error: "Geen rijen om te importeren.", count: 0 };
    const rows = inputs.map((input) => ({
      organisation_id: orgId,
      pot_id: input.potId,
      amount: input.amount,
      direction: input.direction,
      occurred_on: input.occurredOn,
      memo: input.memo ?? null,
      counterparty: input.counterparty ?? null,
    }));
    const { error: err } = await supabase
      .from("transactions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any);
    if (err) return { error: err.message, count: 0 };
    await fetchTransactions();
    return { error: null, count: rows.length };
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

  /**
   * Wijs een onverdeelde transactie toe aan één of meerdere potjes.
   * Bij splitsen: de originele rij krijgt deel 1 (id blijft stabiel),
   * de overige delen worden nieuwe rijen met split_from = origineel.
   * De delen moeten exact optellen tot het originele bedrag.
   */
  async function assignTransaction(
    id: string,
    parts: AssignPart[],
  ): Promise<{ error: string | null }> {
    const original = transactions.find((t) => t.id === id);
    if (!original) return { error: "Transactie niet gevonden." };
    if (parts.length === 0) return { error: "Kies minstens één potje." };

    const sum = parts.reduce((s, p) => s + p.amount, 0);
    // Centen-vergelijking om floating-point ruis te vermijden
    if (Math.round(sum * 100) !== Math.round(Number(original.amount) * 100)) {
      return { error: "De delen moeten samen exact het originele bedrag zijn." };
    }
    if (parts.some((p) => p.amount <= 0)) {
      return { error: "Elk deel moet een positief bedrag zijn." };
    }

    // Deel 1: originele rij bijwerken (audit-trigger logt de wijziging)
    const first = parts[0];
    const { error: updErr } = await (
      supabase.from("transactions") as unknown as {
        update: (
          v: Record<string, unknown>,
        ) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> };
      }
    )
      .update({ pot_id: first.potId, amount: first.amount })
      .eq("id", id);
    if (updErr) return { error: updErr.message };

    // Delen 2..n: nieuwe rijen met trace naar het origineel
    if (parts.length > 1) {
      const rows = parts.slice(1).map((p) => ({
        organisation_id: original.organisation_id,
        pot_id: p.potId,
        amount: p.amount,
        direction: original.direction,
        occurred_on: original.occurred_on,
        memo: original.memo,
        counterparty: original.counterparty,
        split_from: id,
      }));
      const { error: insErr } = await supabase
        .from("transactions")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(rows as any);
      if (insErr) {
        await fetchTransactions();
        return {
          error: `Deel 1 is toegewezen, maar de rest faalde: ${insErr.message}`,
        };
      }
    }

    await fetchTransactions();
    return { error: null };
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    importTransactions,
    deleteTransaction,
    assignTransaction,
    refresh: fetchTransactions,
  };
}

// =============================================================================
// usePotGroups , platte groepen (takken, ploegen) binnen een org
// =============================================================================

export function usePotGroups(orgId: string | null) {
  const [groups, setGroups] = useState<PotGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGroups = useCallback(async () => {
    if (!orgId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("pot_groups")
      .select("*")
      .eq("organisation_id", orgId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (!error && data) setGroups(data as PotGroup[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);
  useRealtimeRefresh("pot_groups", orgId, fetchGroups);

  /** Maak een groep aan en geef het nieuwe id terug. */
  async function addGroup(
    name: string,
  ): Promise<{ error: string | null; groupId?: string }> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const trimmed = name.trim();
    if (!trimmed) return { error: "Geef de groep een naam." };
    const { data, error } = await (
      supabase.from("pot_groups") as unknown as {
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
      .insert({ organisation_id: orgId, name: trimmed })
      .select()
      .single();
    if (error) return { error: error.message };
    await fetchGroups();
    return { error: null, groupId: data?.id };
  }

  async function renameGroup(
    id: string,
    name: string,
  ): Promise<{ error: string | null }> {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Geef de groep een naam." };
    const { error } = await (
      supabase.from("pot_groups") as unknown as {
        update: (v: Record<string, unknown>) => {
          eq: (k: string, v: string) => Promise<{ error: Error | null }>;
        };
      }
    )
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return { error: error.message };
    await fetchGroups();
    return { error: null };
  }

  async function deleteGroup(id: string): Promise<{ error: string | null }> {
    // Potjes in de groep worden groepsloos (FK on delete set null)
    const { error } = await supabase.from("pot_groups").delete().eq("id", id);
    if (error) return { error: error.message };
    await fetchGroups();
    return { error: null };
  }

  return {
    groups,
    loading,
    addGroup,
    renameGroup,
    deleteGroup,
    refresh: fetchGroups,
  };
}

// =============================================================================
// Abonnementen / licenties
// =============================================================================

/** Limieten per tier. Moeten matchen met de triggers in supabase/subscriptions.sql. */
export const TIER_LIMITS: Record<SubTier, { pots: number; members: number }> = {
  free: { pots: 5, members: 3 },
  pro: { pots: Infinity, members: Infinity },
  team: { pots: Infinity, members: Infinity },
};

export const TIER_LABELS: Record<SubTier, string> = {
  free: "Gratis",
  pro: "Pro",
  team: "Team",
};

/** Grafieken zijn een Pro+ feature (zoals op de landing). */
export function chartsEnabled(tier: SubTier): boolean {
  return tier !== "free";
}

/** Potgroepen (takken/ploegen) zijn een Team-feature. */
export function groupsEnabled(tier: SubTier): boolean {
  return tier === "team";
}

/** CSV-import van transacties is een Pro+ feature (zoals op de landing). */
export function importEnabled(tier: SubTier): boolean {
  return tier !== "free";
}

/** Financiële rapporten (PDF) zijn Pro+ ("Grafieken & rapportage"). */
export function reportsEnabled(tier: SubTier): boolean {
  return tier !== "free";
}

/** Bijlagen (bonnetjes/facturen) bij transacties zijn een Team-feature. */
export function attachmentsEnabled(tier: SubTier): boolean {
  return tier === "team";
}

// =============================================================================
// useAttachments , bijlagen bij één transactie (Team-feature)
// =============================================================================
// Bestanden in de private Storage-bucket 'attachments', metadata in
// public.transaction_attachments. Pad: {orgId}/{transactionId}/{ts}-{naam}.
// Team-gating gebeurt server-side (trigger) en in de UI (attachmentsEnabled).

export type Attachment = {
  id: string;
  transaction_id: string;
  organisation_id: string;
  path: string;
  name: string;
  size: number | null;
  created_at: string;
};

const ATTACH_BUCKET = "attachments";
const MAX_ATTACH_BYTES = 10 * 1024 * 1024; // 10 MB

export function useAttachments(
  orgId: string | null,
  transactionId: string | null,
) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId || !transactionId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("transaction_attachments")
      .select("id, transaction_id, organisation_id, path, name, size, created_at")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });
    if (error) console.error("useAttachments:", error.message);
    setAttachments((data as Attachment[]) ?? []);
    setLoading(false);
  }, [orgId, transactionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upload = useCallback(
    async (file: File) => {
      if (!orgId || !transactionId) throw new Error("Geen transactie geselecteerd");
      if (file.size > MAX_ATTACH_BYTES) {
        throw new Error("Bestand te groot (max 10 MB).");
      }
      // Pad-veilige naam; org-map is het eerste segment (storage-RLS leunt erop).
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${orgId}/${transactionId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(ATTACH_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await supabase
        .from("transaction_attachments")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert({
          transaction_id: transactionId,
          organisation_id: orgId,
          path,
          name: file.name,
          size: file.size,
        } as never);
      if (insErr) {
        // Rollback het verweesde object als de metadata-insert faalt (bv. Team-gate).
        await supabase.storage.from(ATTACH_BUCKET).remove([path]);
        throw new Error(insErr.message);
      }
      await refresh();
    },
    [orgId, transactionId, refresh],
  );

  const remove = useCallback(
    async (att: Attachment) => {
      await supabase.storage.from(ATTACH_BUCKET).remove([att.path]);
      const { error } = await supabase
        .from("transaction_attachments")
        .delete()
        .eq("id", att.id);
      if (error) throw new Error(error.message);
      await refresh();
    },
    [refresh],
  );

  // Tijdelijke download-URL (private bucket). 1 uur geldig.
  const getUrl = useCallback(async (att: Attachment): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(ATTACH_BUCKET)
      .createSignedUrl(att.path, 3600);
    if (error) {
      console.error("getUrl:", error.message);
      return null;
    }
    return data?.signedUrl ?? null;
  }, []);

  return { attachments, loading, upload, remove, getUrl, refresh };
}

export function useSubscription(orgId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!orgId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("organisation_id", orgId)
      .maybeSingle();
    setSubscription((data as unknown as Subscription | null) ?? null);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchSub();
  }, [fetchSub]);
  useRealtimeRefresh("subscriptions", orgId, fetchSub);

  const tier: SubTier = subscription?.tier ?? "free";
  return { subscription, tier, limits: TIER_LIMITS[tier], loading, refresh: fetchSub };
}

/**
 * Start een Stripe Checkout-sessie voor een upgrade. Roept de Edge Function
 * aan en redirect naar de betaalpagina. Faalt netjes als Stripe nog niet
 * geconfigureerd is.
 */
export async function startCheckout(
  orgId: string,
  tier: "pro" | "team",
  interval: "month" | "year",
): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session",
      { body: { orgId, tier, interval } },
    );
    if (error) return { error: error.message };
    const url = (data as { url?: string } | null)?.url;
    if (!url) return { error: "Geen checkout-URL ontvangen." };
    window.location.href = url;
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Betaling niet beschikbaar.",
    };
  }
}

/**
 * Open de Stripe Billing Portal zodat een admin zijn abonnement kan beheren
 * (betaalmethode, facturen, opzeggen). Redirect naar de portal-URL.
 */
export async function startPortal(
  orgId: string,
): Promise<{ error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "create-portal-session",
      { body: { orgId } },
    );
    if (error) return { error: error.message };
    const url = (data as { url?: string } | null)?.url;
    if (!url) return { error: "Geen portal-URL ontvangen." };
    window.location.href = url;
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Portal niet beschikbaar.",
    };
  }
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
  /** Org-specifieke invite-token (basis van de deelbare link). */
  token: string | null;
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
  /** Voor de uitnodigingsmail (optioneel, alleen voor weergave in de mail). */
  orgName?: string;
  inviterName?: string;
};

export type InviteResult = {
  error: string | null;
  /** Org-specifieke invite-link die de admin doorstuurt aan de uitgenodigde. */
  inviteLink?: string;
  /** True als de uitnodigingsmail automatisch verstuurd is via de Edge Function. */
  emailSent?: boolean;
};

/** Resultaat van lookup_org_invite: validatie + prefill voor het signup-scherm. */
export type OrgInviteLookup = {
  status: "ok" | "not_found" | "expired" | "accepted";
  email?: string;
  role?: MemberRole;
  orgId?: string;
  orgName?: string;
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
  useRealtimeRefresh("org_invites", orgId, fetchInvites);

  async function sendInvite(input: InviteInput): Promise<InviteResult> {
    if (!orgId) return { error: "Geen organisatie geselecteerd." };
    const email = input.email.trim().toLowerCase();

    // 1. Maak de org-invite met een unieke token (rol + pot-toewijzing).
    //    De token IS de uitnodiging: hij koppelt aan precies deze org en
    //    vervangt de aparte beta-code.
    const { data: tokenData, error: orgInviteError } = await supabase.rpc(
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
    await fetchInvites();
    if (orgInviteError) return { error: orgInviteError.message };

    const token = tokenData as string;
    const inviteLink = `${window.location.origin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // 2. Probeer de uitnodigingsmail te versturen via de Edge Function.
    //    Best-effort: faalt dit (Resend/functie nog niet live), dan deelt de
    //    admin de link gewoon zelf , die werkt sowieso.
    let emailSent = false;
    try {
      const { data: mailData, error: mailError } = await supabase.functions.invoke(
        "send-invite-email",
        {
          body: {
            email,
            inviteLink,
            role: input.role,
            orgName: input.orgName ?? "",
            inviterName: input.inviterName ?? "",
          },
        },
      );
      if (mailError) {

        console.warn("[Kaspio] Uitnodigingsmail niet verstuurd:", mailError.message);
      } else if ((mailData as { ok?: boolean } | null)?.ok) {
        emailSent = true;
      }
    } catch (err) {

      console.warn("[Kaspio] send-invite-email niet bereikbaar:", err);
    }

    return { error: null, inviteLink, emailSent };
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
// Transactie-melding , best-effort e-mail naar potverantwoordelijke + admins
// =============================================================================

/** Stuurt (best-effort) een e-mailmelding bij een nieuwe transactie. Faalt
 *  stil als de Edge Function/Resend niet bereikbaar is of de org gratis is. */
export async function notifyTransactionAdded(payload: {
  orgId: string;
  potId: string | null;
  amount: number;
  direction: "in" | "out";
  occurredOn: string;
  counterparty: string | null;
}): Promise<void> {
  try {
    await supabase.functions.invoke("send-transaction-email", { body: payload });
  } catch (err) {

    console.warn("[Kaspio] send-transaction-email niet bereikbaar:", err);
  }
}

// =============================================================================
// Goedkeuringsflows (Team)
// =============================================================================

async function callVoidRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await (
    supabase.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<{ error: Error | null }>
  )(fn, args);
  return { error: error ? error.message : null };
}

export function approveTransaction(txnId: string) {
  return callVoidRpc("approve_transaction", { p_txn_id: txnId });
}
export function rejectTransaction(txnId: string) {
  return callVoidRpc("reject_transaction", { p_txn_id: txnId });
}
export function setApprovalSettings(
  orgId: string,
  require: boolean,
  threshold: number,
) {
  return callVoidRpc("set_approval_settings", {
    p_org: orgId,
    p_require: require,
    p_threshold: threshold,
  });
}

/** Best-effort melding voor org-gebeurtenissen (nieuw potje / nieuw lid). */
export async function notifyOrgEvent(
  orgId: string,
  event: "pot_created" | "member_added",
  potName?: string,
): Promise<void> {
  try {
    await supabase.functions.invoke("send-org-event-email", {
      body: { orgId, event, potName },
    });
  } catch (err) {

    console.warn("[Kaspio] send-org-event-email niet bereikbaar:", err);
  }
}

// =============================================================================
// useNotificationSettings , per-gebruiker voorkeuren in de DB
// =============================================================================

export function useNotificationSettings(userId: string | null) {
  const [settings, setSettings] = useState<NotificationSettings>(
    defaultNotificationSettings,
  );

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = data as any;
      setSettings({
        emailOnTransaction: d.email_on_transaction ?? true,
        emailOnPotCreated: d.email_on_pot_created ?? false,
        emailOnMemberAdded: d.email_on_member_added ?? true,
        digestFrequency: d.digest_frequency ?? "never",
      });
    }
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const update = useCallback(
    async (patch: Partial<NotificationSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (userId) {
          void supabase
            .from("notification_settings")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .upsert({
              user_id: userId,
              email_on_transaction: next.emailOnTransaction,
              email_on_pot_created: next.emailOnPotCreated,
              email_on_member_added: next.emailOnMemberAdded,
              digest_frequency: next.digestFrequency,
            } as any);
        }
        return next;
      });
    },
    [userId],
  );

  return { settings, update };
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
     
    console.warn("[Kaspio] accept_pending_invites failed:", error.message);
    return 0;
  }
  return (data as number) ?? 0;
}

// =============================================================================
// Token-gebaseerde org-invites (nieuwe flow)
// =============================================================================

/** Valideer een org-invite-token (anon-safe) + haal prefill-info op. */
export async function lookupOrgInvite(token: string): Promise<OrgInviteLookup> {
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "lookup_org_invite" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { p_token: token } as any,
  );
  if (error || !data) return { status: "not_found" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return {
    status: d.status,
    email: d.email ?? undefined,
    role: d.role ?? undefined,
    orgId: d.org_id ?? undefined,
    orgName: d.org_name ?? undefined,
  };
}

/** Verzilver een org-invite-token: koppelt de ingelogde user aan die org.
 *  Returnt de status + het org-ID (bij 'ok'/'accepted') zodat de app je direct
 *  in de juiste org plaatst. */
export async function redeemOrgInvite(
  token: string,
): Promise<{ status: string; orgId?: string; message?: string }> {
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "redeem_org_invite" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { p_token: token } as any,
  );
  if (error) {

    console.warn("[Kaspio] redeem_org_invite failed:", error.message);
    return { status: "error", message: error.message };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  // Oude functie gaf text terug ('ok'); nieuwe geeft jsonb {status, org_id}.
  if (typeof d === "string") return { status: d };
  return { status: d?.status ?? "error", orgId: d?.org_id ?? undefined };
}

// =============================================================================
// Comp-codes , gratis Pro/Team voor testers (enkel de app-eigenaar maakt ze)
// =============================================================================

/** Is de ingelogde gebruiker platform-admin (app-eigenaar)? */
export function useIsPlatformAdmin(userId: string | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.rpc("is_platform_admin" as any).then(({ data }) => {
      setIsAdmin(data === true);
    });
  }, [userId]);
  return isAdmin;
}

/** Maak een comp-code (platform-admin). Returnt de code of een fout. */
export async function createCompCode(
  tier: "pro" | "team",
  max: number,
  note: string | null,
): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "create_comp_code" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { p_tier: tier, p_max: max, p_note: note } as any,
  );
  if (error) return { code: null, error: error.message };
  return { code: (data as string) ?? null, error: null };
}

/** Wissel een comp-code in voor een org (caller moet admin zijn). */
export async function redeemCompCode(
  code: string,
  orgId: string,
): Promise<{ status: string; tier?: string }> {
  const { data, error } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "redeem_comp_code" as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { p_code: code, p_org_id: orgId } as any,
  );
  if (error) {
    console.warn("[Kaspio] redeem_comp_code failed:", error.message);
    return { status: "error" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { status: d?.status ?? "error", tier: d?.tier };
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
    // profiles wordt via twee FK's gerefereerd (user_id én invited_by), dus de
    // embed MOET gedisambigueerd worden (!user_id), anders is de query ambigu
    // en komt er een error -> lege ledenlijst.
    const { data, error } = await supabase
      .from("memberships")
      .select("id, user_id, organisation_id, role, pot_id, created_at, profile:profiles!user_id(full_name, email)")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[Kaspio] useOrgMembers fetch failed:", error.message);
    }
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
  useRealtimeRefresh("memberships", orgId, fetchMembers);

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
  useRealtimeRefresh("audit_log", orgId, fetchLog);

  return { entries, loading, refresh: fetchLog };
}
