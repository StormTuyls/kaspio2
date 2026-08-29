import { useState } from "react";
import type { GroupedMember } from "../data";
import type { MemberRole, Pot, PotGroup } from "../supabase";
import { useConfirm } from "./ConfirmDialog";

type Props = {
  orgId: string;
  member: GroupedMember;
  pots: Pot[];
  groups: PotGroup[];
  isOnlyAdmin: boolean;
  isSelf: boolean;
  onSave: (
    userId: string,
    orgId: string,
    role: MemberRole,
    potIds: string[],
    groupIds: string[],
  ) => Promise<{ error: string | null }>;
  onRemove: (
    userId: string,
    orgId: string,
  ) => Promise<{ error: string | null }>;
  onClose: () => void;
};

export function ManageMemberModal({
  orgId,
  member,
  pots,
  groups,
  isOnlyAdmin,
  isSelf,
  onSave,
  onRemove,
  onClose,
}: Props) {
  const confirm = useConfirm();
  const [role, setRole] = useState<MemberRole>(member.effectiveRole);
  const [potIds, setPotIds] = useState<string[]>(member.potIds);
  const [groupIds, setGroupIds] = useState<string[]>(member.groupIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (role === "pot_owner" && potIds.length === 0) {
      setError("Kies minstens één potje voor een pot owner.");
      return;
    }
    if (role === "group_owner" && groupIds.length === 0) {
      setError("Kies minstens één groep voor een groepsbeheerder.");
      return;
    }
    setBusy(true);
    const res = await onSave(member.user_id, orgId, role, potIds, groupIds);
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  }

  async function remove() {
    if (
      !(await confirm({
        title: `${member.full_name} verwijderen?`,
        message: "Dit lid wordt uit de organisatie verwijderd.",
        confirmLabel: "Verwijderen",
        danger: true,
      }))
    )
      return;
    setError(null);
    setBusy(true);
    const res = await onRemove(member.user_id, orgId);
    setBusy(false);
    if (res.error) setError(res.error);
    else onClose();
  }

  function togglePot(id: string) {
    setPotIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function toggleGroup(id: string) {
    setGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-base font-bold text-ink-900 dark:text-white">
          {member.full_name}
        </div>
        <div className="text-sm text-ink-700 dark:text-ink-500">
          {member.email}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-800 dark:text-ink-300">
          Rol
        </p>
        <div className="space-y-2">
          <RoleOption
            checked={role === "admin"}
            onChange={() => setRole("admin")}
            label="Admin"
            description="Ziet alles in de organisatie, kan leden en potjes beheren."
            disabled={isOnlyAdmin && role === "admin"}
          />
          <RoleOption
            checked={role === "pot_owner"}
            onChange={() => setRole("pot_owner")}
            label="Pot owner"
            description="Ziet en bewerkt enkel toegewezen potjes."
            disabled={isSelf && member.effectiveRole === "admin" && isOnlyAdmin}
          />
          <RoleOption
            checked={role === "group_owner"}
            onChange={() => setRole("group_owner")}
            label="Groepsbeheerder"
            description="Beheert alle potjes van een groep, ook de potjes die er later bij komen."
            disabled={isSelf && member.effectiveRole === "admin" && isOnlyAdmin}
          />
          <RoleOption
            checked={role === "reader"}
            onChange={() => setRole("reader")}
            label="Lezer"
            description="Kan alle data zien, maar niets bewerken."
            disabled={isSelf && member.effectiveRole === "admin" && isOnlyAdmin}
          />
        </div>
      </div>

      {role === "pot_owner" && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-800 dark:text-ink-300">
            Toegang tot potjes
          </p>
          {pots.length === 0 ? (
            <p className="text-sm text-ink-600">
              Geen potjes beschikbaar. Maak eerst een potje aan.
            </p>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-ink-200 p-2 dark:border-ink-800">
              {pots.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-900"
                >
                  <input
                    type="checkbox"
                    checked={potIds.includes(p.id)}
                    onChange={() => togglePot(p.id)}
                    className="h-4 w-4"
                  />
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm text-ink-900 dark:text-white">
                    {p.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          {potIds.length > 0 && (
            <p className="mt-2 text-xs text-ink-600">
              {potIds.length} potje{potIds.length === 1 ? "" : "s"} geselecteerd
            </p>
          )}
        </div>
      )}

      {role === "group_owner" && (
        <div>
          <p className="mb-2 text-sm font-medium text-ink-800 dark:text-ink-300">
            Beheert deze groepen
          </p>
          {groups.length === 0 ? (
            <p className="text-sm text-ink-600">
              Er zijn nog geen groepen. Maak er eerst één aan bij Groepen.
            </p>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-ink-200 p-2 dark:border-ink-800">
              {groups
                .filter((g) => !g.parent_id)
                .map((g) => {
                  const children = groups.filter((c) => c.parent_id === g.id);
                  return (
                    <div key={g.id}>
                      <GroupCheck
                        group={g}
                        // Het aantal moet de subgroepen meetellen, precies zoals
                        // de RLS doet: wie deze hoofdgroep beheert, beheert ook
                        // wat eronder hangt. Anders staat er "0 potjes" bij een
                        // groep waarvan hij er vijftien krijgt.
                        count={
                          pots.filter(
                            (p) =>
                              p.group_id === g.id ||
                              children.some((c) => c.id === p.group_id),
                          ).length
                        }
                        checked={groupIds.includes(g.id)}
                        onToggle={() => toggleGroup(g.id)}
                      />
                      {children.map((c) => (
                        <div key={c.id} className="ml-5 border-l border-ink-200 pl-2 dark:border-ink-800">
                          <GroupCheck
                            group={c}
                            count={pots.filter((p) => p.group_id === c.id).length}
                            checked={
                              groupIds.includes(c.id) || groupIds.includes(g.id)
                            }
                            // Zit de hoofdgroep er al bij, dan is de subgroep
                            // sowieso gedekt. Apart aanvinken zou een tweede
                            // lidmaatschap maken dat niets toevoegt.
                            disabled={groupIds.includes(g.id)}
                            onToggle={() => toggleGroup(c.id)}
                          />
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-600">
            Nieuwe potjes in deze groepen komen er vanzelf bij.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {!isSelf && (
          <button
            onClick={remove}
            disabled={busy || isOnlyAdmin}
            className="btn-danger text-sm"
            title={
              isOnlyAdmin
                ? "Laatste admin kan niet worden verwijderd"
                : "Verwijder lid uit de organisatie"
            }
          >
            Verwijderen
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-secondary"
          >
            Annuleren
          </button>
          <button onClick={save} disabled={busy} className="btn-accent">
            {busy ? "Bezig…" : "Opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleOption({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition ${
        checked
          ? "border-in-600 bg-in-100 dark:bg-in-700/20"
          : "border-ink-200 dark:border-ink-800"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1">
        <div className="text-sm font-semibold text-ink-900 dark:text-white">
          {label}
        </div>
        <div className="text-xs text-ink-700 dark:text-ink-500">
          {description}
        </div>
      </div>
    </label>
  );
}

/** Eén aanvinkbare groep in de lijst hierboven. */
function GroupCheck({
  group,
  count,
  checked,
  disabled = false,
  onToggle,
}: {
  group: PotGroup;
  count: number;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 ${
        disabled
          ? "cursor-default opacity-60"
          : "cursor-pointer hover:bg-ink-50 dark:hover:bg-ink-900"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-4 w-4"
      />
      <span className="text-sm text-ink-900 dark:text-white">{group.name}</span>
      <span className="ml-auto text-xs text-ink-600">
        {count} potje{count === 1 ? "" : "s"}
      </span>
    </label>
  );
}
