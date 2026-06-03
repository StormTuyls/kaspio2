import { useState } from "react";
import type { FormEvent } from "react";
import type { MemberRole, Pot } from "../supabase";
import type { InviteInput, InviteResult, OrgInvite } from "../data";

type Props = {
  orgId: string;
  pots: Pot[];
  pendingInvites: OrgInvite[];
  onInvite: (input: InviteInput) => Promise<InviteResult>;
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
  const [potIds, setPotIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    email: string;
    code?: string;
  } | null>(null);

  function togglePot(id: string) {
    setPotIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (role === "pot_owner" && potIds.length === 0) {
      setError("Kies minstens één potje voor een pot-verantwoordelijke.");
      return;
    }
    setBusy(true);
    const res = await onInvite({ email: email.trim(), role, potIds });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSuccess({ email: email.trim(), code: res.betaCode });
    setEmail("");
    setPotIds([]);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
          Iemand uitnodigen
        </h2>
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Vul email + rol in. Bij hun eerste login wordt automatisch lid
          gemaakt met de juiste toegang.
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
            onChange={(e) => {
              setRole(e.target.value as MemberRole);
              setPotIds([]);
            }}
            className="input"
          >
            <option value="admin">Admin (ziet en beheert alles)</option>
            <option value="pot_owner">
              Pot owner (specifieke potjes)
            </option>
            <option value="reader">Lezer (alleen meelezen)</option>
          </select>
        </label>

        {role === "pot_owner" && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
              Welke potjes
            </span>
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

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {success && (
          <SuccessBox email={success.email} code={success.code} />
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
            Openstaande uitnodigingen
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

function SuccessBox({ email, code }: { email: string; code?: string }) {
  const [copied, setCopied] = useState(false);

  async function copyTemplate() {
    const text = code
      ? [
          `Hoi,`,
          ``,
          `Ik heb je uitgenodigd voor onze Kaspio-organisatie.`,
          ``,
          `Maak je account aan op https://kaspio.be met dit emailadres (${email}).`,
          ``,
          `Je beta-toegangscode: ${code}`,
          ``,
          `Tot binnenkort!`,
        ].join("\n")
      : `Ik heb je uitgenodigd op Kaspio. Maak je account aan op https://kaspio.be met ${email}.`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="rounded-lg border border-mint-200 bg-mint-50 px-4 py-4 text-sm text-mint-800">
      <div className="mb-2 font-semibold">✓ Uitnodiging klaar voor {email}</div>
      {code ? (
        <>
          <p className="mb-3">
            Stuur deze beta-code mee in je mail. Zonder code kunnen ze geen
            account aanmaken.
          </p>
          <div className="mb-3 rounded-md bg-white px-3 py-2 font-mono text-base font-bold tracking-wider text-mint-700">
            {code}
          </div>
          <button
            type="button"
            onClick={copyTemplate}
            className="btn-secondary text-xs"
          >
            {copied ? "✓ Gekopieerd" : "Kopieer mail-template"}
          </button>
        </>
      ) : (
        <p>
          Stuur hen een mailtje met de uitnodiging via{" "}
          <code className="rounded bg-mint-100 px-1">kaspio.be</code>.
        </p>
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
