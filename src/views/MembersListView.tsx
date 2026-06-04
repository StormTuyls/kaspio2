import { useMemo, useState } from "react";
import type { GroupedMember, OrgInvite, OrgMember } from "../data";
import { groupMembersByUser } from "../data";
import type { MemberRole, Pot } from "../supabase";
import { Modal } from "../components/Modal";
import { ManageMemberModal } from "../components/ManageMemberModal";

type Props = {
  orgId: string;
  currentUserId: string;
  members: OrgMember[];
  invites: OrgInvite[];
  pots: Pot[];
  onInviteClick: () => void;
  onSavePermissions: (
    userId: string,
    orgId: string,
    role: MemberRole,
    potIds: string[],
  ) => Promise<{ error: string | null }>;
  onRemoveMember: (
    userId: string,
    orgId: string,
  ) => Promise<{ error: string | null }>;
  onRevokeInvite: (id: string) => Promise<{ error: string | null }>;
};

export function MembersListView({
  orgId,
  currentUserId,
  members,
  invites,
  pots,
  onInviteClick,
  onSavePermissions,
  onRemoveMember,
  onRevokeInvite,
}: Props) {
  const grouped = useMemo(() => groupMembersByUser(members), [members]);
  const pendingInvites = invites.filter((i) => !i.accepted_at);
  const adminCount = grouped.filter((m) => m.effectiveRole === "admin").length;
  const [managing, setManaging] = useState<GroupedMember | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-navy-100 bg-white p-4 dark:border-navy-700 dark:bg-navy-900">
        <div>
          <h3 className="font-bold text-navy-900 dark:text-white">
            Iemand uitnodigen
          </h3>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            Admin, pot-owner of lezer. Krijg een KASP-code om door te sturen.
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
            {pendingInvites.map((inv) => {
              const invitePots = (inv.pot_ids ?? [])
                .map((id) => pots.find((p) => p.id === id)?.name)
                .filter(Boolean) as string[];
              if (inv.pot_id && invitePots.length === 0) {
                const legacyName = pots.find((p) => p.id === inv.pot_id)?.name;
                if (legacyName) invitePots.push(legacyName);
              }
              return (
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
                      {invitePots.length > 0 &&
                        ` · ${invitePots.join(", ")}`}
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
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-navy-100 bg-white p-5 dark:border-navy-700 dark:bg-navy-900">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-navy-500 dark:text-navy-300">
          Actieve leden ({grouped.length})
        </h3>
        {grouped.length === 0 ? (
          <p className="text-sm text-navy-400">
            Nog geen actieve leden. Nodig iemand uit met de knop hierboven.
          </p>
        ) : (
          <ul className="divide-y divide-navy-100 dark:divide-navy-700">
            {grouped.map((m) => (
              <MemberRow
                key={m.user_id}
                member={m}
                pots={pots}
                isCurrentUser={m.user_id === currentUserId}
                isOnlyAdmin={
                  m.effectiveRole === "admin" && adminCount === 1
                }
                onManage={() => setManaging(m)}
              />
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={!!managing}
        title="Lid beheren"
        onClose={() => setManaging(null)}
      >
        {managing && (
          <ManageMemberModal
            orgId={orgId}
            member={managing}
            pots={pots}
            isOnlyAdmin={
              managing.effectiveRole === "admin" && adminCount === 1
            }
            isSelf={managing.user_id === currentUserId}
            onSave={onSavePermissions}
            onRemove={onRemoveMember}
            onClose={() => setManaging(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function MemberRow({
  member,
  pots,
  isCurrentUser,
  isOnlyAdmin,
  onManage,
}: {
  member: GroupedMember;
  pots: Pot[];
  isCurrentUser: boolean;
  isOnlyAdmin: boolean;
  onManage: () => void;
}) {
  const potNames = member.potIds
    .map((id) => pots.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-navy-900 dark:text-white">
            {member.full_name}
          </span>
          {isCurrentUser && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
              jij
            </span>
          )}
          {isOnlyAdmin && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              enige admin
            </span>
          )}
        </div>
        <div className="text-xs text-navy-400">{member.email}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-navy-500">
          <span className="font-semibold">{roleLabel(member.effectiveRole)}</span>
          {member.effectiveRole === "pot_owner" && potNames.length > 0 && (
            <>
              <span>·</span>
              <span className="flex flex-wrap gap-1">
                {member.potIds.map((id) => {
                  const pot = pots.find((p) => p.id === id);
                  if (!pot) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 dark:bg-navy-800"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: pot.color }}
                      />
                      {pot.name}
                    </span>
                  );
                })}
              </span>
            </>
          )}
        </div>
      </div>

      <button onClick={onManage} className="btn-secondary text-sm">
        Beheer
      </button>
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
