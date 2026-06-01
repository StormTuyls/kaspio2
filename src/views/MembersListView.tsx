import { useState } from "react";
import type { OrgInvite, OrgMember } from "../data";
import type { MemberRole, Pot } from "../supabase";

type Props = {
  currentUserId: string;
  members: OrgMember[];
  invites: OrgInvite[];
  pots: Pot[];
  onInviteClick: () => void;
  onUpdateRole: (
    membershipId: string,
    role: MemberRole,
    potId: string | null,
  ) => Promise<{ error: string | null }>;
  onRemoveMember: (membershipId: string) => Promise<{ error: string | null }>;
  onRevokeInvite: (id: string) => Promise<{ error: string | null }>;
};

export function MembersListView({
  currentUserId,
  members,
  invites,
  pots,
  onInviteClick,
  onUpdateRole,
  onRemoveMember,
  onRevokeInvite,
}: Props) {
  const pendingInvites = invites.filter((i) => !i.accepted_at);
  const adminCount = members.filter((m) => m.role === "admin").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
        <div>
          <h3 className="font-bold text-navy-900 dark:text-white">
            Iemand uitnodigen
          </h3>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            Admin, pot-owner of lezer. Nieuwe leden komen vanzelf binnen bij hun
            eerste login.
          </p>
        </div>
        <button onClick={onInviteClick} className="btn-accent">
          + Uitnodigen
        </button>
      </div>

      {pendingInvites.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
            Openstaande uitnodigingen ({pendingInvites.length})
          </h3>
          <ul className="space-y-2">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm dark:bg-navy-900"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-navy-900 dark:text-white">
                    {inv.email}
                  </div>
                  <div className="text-xs text-navy-400">
                    {roleLabel(inv.role)}
                    {inv.pot_id &&
                      ` · ${pots.find((p) => p.id === inv.pot_id)?.name ?? "?"}`}
                    {" · wacht op eerste login"}
                  </div>
                </div>
                <button
                  onClick={() => onRevokeInvite(inv.id)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Intrekken
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-navy-100 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
          Actieve leden ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="text-sm text-navy-400">
            Nog geen actieve leden behalve jezelf.
          </p>
        ) : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-700">
            {members.map((m) => (
              <MemberRow
                key={m.membership_id}
                member={m}
                pots={pots}
                isCurrentUser={m.user_id === currentUserId}
                isOnlyAdmin={m.role === "admin" && adminCount === 1}
                onUpdateRole={onUpdateRole}
                onRemove={onRemoveMember}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MemberRow({
  member,
  pots,
  isCurrentUser,
  isOnlyAdmin,
  onUpdateRole,
  onRemove,
}: {
  member: OrgMember;
  pots: Pot[];
  isCurrentUser: boolean;
  isOnlyAdmin: boolean;
  onUpdateRole: (
    membershipId: string,
    role: MemberRole,
    potId: string | null,
  ) => Promise<{ error: string | null }>;
  onRemove: (membershipId: string) => Promise<{ error: string | null }>;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<MemberRole>(member.role);
  const [potId, setPotId] = useState<string>(member.pot_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (role === "pot_owner" && !potId) {
      setError("Kies een potje voor deze rol.");
      return;
    }
    setBusy(true);
    const res = await onUpdateRole(
      member.membership_id,
      role,
      role === "pot_owner" ? potId : null,
    );
    setBusy(false);
    if (res.error) setError(res.error);
    else setEditing(false);
  }

  async function remove() {
    if (!confirm(`Verwijder ${member.full_name} uit de organisatie?`)) return;
    setBusy(true);
    const res = await onRemove(member.membership_id);
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-navy-900 dark:text-white">
            {member.full_name}
          </span>
          {isCurrentUser && (
            <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-mint-700">
              jij
            </span>
          )}
        </div>
        <div className="text-xs text-navy-400">{member.email}</div>
        {!editing && (
          <div className="mt-1 text-xs text-navy-500">
            {roleLabel(member.role)}
            {member.role === "pot_owner" &&
              ` · ${pots.find((p) => p.id === member.pot_id)?.name ?? "?"}`}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="input min-w-[140px]"
          >
            <option value="admin">Admin</option>
            <option value="pot_owner">Pot owner</option>
            <option value="reader">Lezer</option>
          </select>
          {role === "pot_owner" && (
            <select
              value={potId}
              onChange={(e) => setPotId(e.target.value)}
              className="input min-w-[140px]"
            >
              <option value="">Kies potje</option>
              {pots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button onClick={save} disabled={busy} className="btn-accent">
            {busy ? "…" : "Opslaan"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setError(null);
              setRole(member.role);
              setPotId(member.pot_id ?? "");
            }}
            className="btn-secondary"
          >
            Annuleren
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {!isOnlyAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-navy-500 hover:text-navy-900"
            >
              Wijzig rol
            </button>
          )}
          {!isCurrentUser && (
            <button
              onClick={remove}
              disabled={busy}
              className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
            >
              Verwijderen
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </li>
  );
}

function roleLabel(r: MemberRole): string {
  switch (r) {
    case "admin":
      return "Admin";
    case "pot_owner":
      return "Pot owner";
    case "reader":
      return "Lezer";
  }
}
