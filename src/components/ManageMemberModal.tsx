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
        <div className="text-base font-bold text-navy-900 dark:text-white">
          {member.full_name}
        </div>
        <div className="text-sm text-navy-500 dark:text-navy-300">
          {member.email}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-navy-700 dark:text-navy-200">
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
          <p className="mb-2 text-sm font-medium text-navy-700 dark:text-navy-200">
            Toegang tot potjes
          </p>
          {pots.length === 0 ? (
            <p className="text-sm text-navy-400">
              Geen potjes beschikbaar. Maak eerst een potje aan.
            </p>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-navy-100 p-2 dark:border-navy-700">
              {pots.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-canvas dark:hover:bg-navy-800"
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
                  <span className="text-sm text-navy-900 dark:text-white">
                    {p.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          {potIds.length > 0 && (
            <p className="mt-2 text-xs text-navy-400">
              {potIds.length} potje{potIds.length === 1 ? "" : "s"} geselecteerd
            </p>
          )}
        </div>
      )}

      {role === "group_owner" && (
        <div>
          <p className="mb-2 text-sm font-medium text-navy-700 dark:text-navy-200">
            Beheert deze groepen
          </p>
          {groups.length === 0 ? (
            <p className="text-sm text-navy-400">
              Er zijn nog geen groepen. Maak er eerst één aan bij Groepen.
            </p>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-navy-100 p-2 dark:border-navy-700">
              {groups.map((g) => {
                const aantal = pots.filter((p) => p.group_id === g.id).length;
                return (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-canvas dark:hover:bg-navy-800"
                  >
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-navy-900 dark:text-white">
                      {g.name}
                    </span>
                    <span className="ml-auto text-xs text-navy-400">
                      {aantal} potje{aantal === 1 ? "" : "s"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <p className="mt-2 text-xs text-navy-400">
            Nieuwe potjes in deze groepen komen er vanzelf bij.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
          ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
          : "border-navy-100 dark:border-navy-700"
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
        <div className="text-sm font-semibold text-navy-900 dark:text-white">
          {label}
        </div>
        <div className="text-xs text-navy-500 dark:text-navy-300">
          {description}
        </div>
      </div>
    </label>
  );
}
