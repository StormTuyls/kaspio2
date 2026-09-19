import { useState } from "react";
import type { FormEvent } from "react";
import type { MemberRole, Pot } from "../supabase";
import type { InviteInput, InviteResult, OrgInvite } from "../data";

import { Foutmelding } from "./Foutmelding";
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
    inviteLink?: string;
    emailSent?: boolean;
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
    setSuccess({
      email: email.trim(),
      inviteLink: res.inviteLink,
      emailSent: res.emailSent,
    });
    setEmail("");
    setPotIds([]);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">
          Iemand uitnodigen
        </h2>
        <p className="text-sm text-basis">
          Vul email + rol in. Je krijgt een persoonlijke uitnodigingslink om
          door te sturen, wie hem opent wordt meteen lid met de juiste toegang.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
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
          <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
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
            <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
              Welke potjes
            </span>
            {pots.length === 0 ? (
              <p className="text-sm text-zacht">
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
              <p className="mt-2 text-xs text-zacht">
                {potIds.length} potje{potIds.length === 1 ? "" : "s"} geselecteerd
              </p>
            )}
          </div>
        )}

        {error && (
          <Foutmelding>
            {error}
          </Foutmelding>
        )}

        {success && (
          <SuccessBox
            email={success.email}
            inviteLink={success.inviteLink}
            emailSent={success.emailSent}
          />
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
        <div className="border-t border-ink-200 pt-4 dark:border-ink-800">
          <h3 className="mb-3 text-sm font-bold text-ink-900 dark:text-white">
            Openstaande uitnodigingen
          </h3>
          <ul className="space-y-2">
            {pendingInvites.map((inv) => {
              const accepted = !!inv.accepted_at;
              return (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-ink-800 dark:bg-ink-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="break-all font-medium text-ink-900 sm:truncate dark:text-white">
                      {inv.email}
                    </div>
                    <div className="text-xs text-zacht">
                      {roleLabel(inv.role)}
                      {accepted ? " · ✓ geaccepteerd" : " · wacht op login"}
                    </div>
                  </div>
                  {!accepted && (
                    <div className="flex flex-shrink-0 items-center gap-3 self-start sm:self-auto">
                      {inv.token && <CopyLinkButton token={inv.token} email={inv.email} />}
                      <button
                        type="button"
                        onClick={() => onRevoke(inv.id)}
                        className="text-xs font-semibold text-fout-600 hover:underline"
                      >
                        Intrekken
                      </button>
                    </div>
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

function SuccessBox({
  email,
  inviteLink,
  emailSent,
}: {
  email: string;
  inviteLink?: string;
  emailSent?: boolean;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  async function copy(text: string, which: "link" | "template") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedTemplate(true);
        setTimeout(() => setCopiedTemplate(false), 2000);
      }
    } catch {
      // clipboard blocked
    }
  }

  const template = inviteLink
    ? [
        `Hoi,`,
        ``,
        `Ik heb je uitgenodigd voor onze Kaspio-organisatie.`,
        ``,
        `Klik op deze link om je account aan te maken en meteen lid te worden:`,
        inviteLink,
        ``,
        `Tot binnenkort!`,
      ].join("\n")
    : "";

  return (
    <div className="rounded-lg border border-in-300 bg-in-100 px-4 py-4 text-sm text-in-700 dark:border-in-600 dark:bg-in-700/20 dark:text-in-300">
      <div className="mb-2 font-semibold">
        {emailSent
          ? `✓ Uitnodigingsmail verstuurd naar ${email}`
          : `✓ Uitnodiging klaar voor ${email}`}
      </div>
      {inviteLink ? (
        <>
          <p className="mb-3">
            {emailSent
              ? "De link staat al in de mail. Hieronder als backup, voor het geval je 'm zelf wil doorsturen."
              : "Stuur deze persoonlijke link door. Wie hem opent maakt een account aan en wordt meteen lid van deze organisatie. Geen aparte code nodig."}
          </p>
          <div className="mb-3 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-in-700 dark:bg-ink-950 dark:text-in-400">
            {inviteLink}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(inviteLink, "link")}
              className="btn-secondary text-xs"
            >
              {copiedLink ? "✓ Gekopieerd" : "Kopieer link"}
            </button>
            <button
              type="button"
              onClick={() => copy(template, "template")}
              className="btn-secondary text-xs"
            >
              {copiedTemplate ? "✓ Gekopieerd" : "Kopieer mail-template"}
            </button>
          </div>
        </>
      ) : (
        <p>
          Uitnodiging aangemaakt. Herlaad even om de link op te halen, of stuur
          hen handmatig naar{" "}
          <code className="rounded bg-in-100 px-1 dark:bg-in-700/40">kaspio.be</code>.
        </p>
      )}
    </div>
  );
}

function CopyLinkButton({ token, email }: { token: string; email?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    const link =
      `${window.location.origin}/?invite=${encodeURIComponent(token)}` +
      (email ? `&email=${encodeURIComponent(email)}` : "");
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs font-semibold text-in-700 hover:underline dark:text-in-400"
    >
      {copied ? "✓ Gekopieerd" : "Kopieer link"}
    </button>
  );
}

function roleLabel(r: MemberRole): string {
  switch (r) {
    case "admin":
      return "Admin";
    case "pot_owner":
      return "Pot owner";
    case "group_owner":
      return "Groepsbeheerder";
    case "reader":
      return "Lezer";
  }
}
