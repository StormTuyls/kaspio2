import { useState } from "react";
import type { FormEvent } from "react";
import type { MemberRole, Pot } from "../supabase";
import type { InviteInput, OrgInvite } from "../data";

type Props = {
  orgId: string;
  pots: Pot[];
  pendingInvites: OrgInvite[];
  onInvite: (input: InviteInput) => Promise<{ error: string | null }>;
  onRevoke: (id: string) => Promise<{ error: string | null }>;
  onClose: () => void;
};

export function InviteMemberForm({
  pots,
  pendingInvites,
  onInvite,
  onRevoke,
  onClose,
}: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("pot_owner");
  const [potId, setPotId] = useState<string>(pots[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (role === "pot_owner" && !potId) {
      setError("Kies een potje voor deze pot-verantwoordelijke.");
      return;
    }
    setBusy(true);
    const res = await onInvite({
      email: email.trim(),
      role,
      potId: role === "pot_owner" ? potId : null,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess(
      `Uitnodiging klaar voor ${email}. Stuur hen nu een mail om hun account aan te maken of in te loggen.`,
    );
    setEmail("");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
          Iemand uitnodigen
        </h2>
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Vul email + rol in. Stuur de persoon daarna manueel een mailtje met de
          link naar kaspio.be. Bij hun eerste login wordt automatisch lid
          gemaakt.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            E-mailadres
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="jan@example.be"
            className="input"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
            Rol
          </span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="input"
          >
            <option value="admin">Admin (ziet en beheert alles)</option>
            <option value="pot_owner">Pot owner (één specifiek potje)</option>
            <option value="reader">Lezer (alleen-meelezen)</option>
          </select>
        </label>

        {role === "pot_owner" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
              Welk potje
            </span>
            <select
              value={potId}
              onChange={(e) => setPotId(e.target.value)}
              required
              className="input"
            >
              <option value="">Kies een potje</option>
              {pots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-mint-200 bg-mint-50 px-3 py-2 text-sm text-mint-800">
            {success}
          </div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-accent flex-1">
            {busy ? "Bezig…" : "Uitnodiging aanmaken"}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Sluiten
          </button>
        </div>
      </form>

      {pendingInvites.length > 0 && (
        <div className="border-t border-navy-100 pt-4 dark:border-navy-700">
          <h3 className="mb-3 text-sm font-bold text-navy-900 dark:text-white">
            Openstaande uitnodigingen ({pendingInvites.filter((i) => !i.accepted_at).length})
          </h3>
          <ul className="space-y-2">
            {pendingInvites.map((inv) => {
              const accepted = !!inv.accepted_at;
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-navy-100 bg-canvas px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-800"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy-900 dark:text-white">
                      {inv.email}
                    </div>
                    <div className="text-xs text-navy-400">
                      {roleLabel(inv.role)}
                      {accepted ? " · ✓ geaccepteerd" : " · wacht op login"}
                    </div>
                  </div>
                  {!accepted && (
                    <button
                      type="button"
                      onClick={() => onRevoke(inv.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Intrekken
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
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
