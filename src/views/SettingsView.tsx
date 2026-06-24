import { useState } from "react";
import type { DigestFrequency, NotificationSettings } from "../types";
import type { Branding } from "../branding";
import type { SubTier } from "../supabase";
import { BrandingSection } from "../components/BrandingSection";
import { SubscriptionCard } from "../components/SubscriptionCard";
import { OwnerCompCodes } from "../components/OwnerCompCodes";
import { UpgradeHint } from "../components/UpgradeHint";

type Account = {
  id: string;
  email: string;
  fullName: string;
  organizationName: string;
  createdAt: string;
};

type Props = {
  account: Account;
  orgId: string;
  orgName: string;
  tier: SubTier;
  /** Heeft deze org een echt Stripe-abonnement (klant)? Stuurt "Abonnement beheren". */
  hasStripeBilling?: boolean;
  potCount: number;
  memberCount: number;
  isAdmin: boolean;
  isOwner: boolean;
  /** App-eigenaar: toont het test-/promocode-paneel. */
  isPlatformAdmin?: boolean;
  notifications: NotificationSettings;
  branding: Branding;
  onChange: (patch: Partial<NotificationSettings>) => void;
  onBrandingChange: (patch: Partial<Branding>) => void;
  onBrandingReset: () => void;
  onDeleteOrg: () => Promise<{ error: string | null }>;
  /** Goedkeuringsflows (Team). */
  approvalAvailable: boolean;
  requireApproval: boolean;
  approvalThreshold: number;
  onSetApproval: (require: boolean, threshold: number) => Promise<{ error: string | null }>;
};

export function SettingsView({
  account,
  orgId,
  orgName,
  tier,
  hasStripeBilling,
  potCount,
  memberCount,
  isAdmin,
  isOwner,
  isPlatformAdmin,
  notifications,
  branding,
  onChange,
  onBrandingChange,
  onBrandingReset,
  onDeleteOrg,
  approvalAvailable,
  requireApproval,
  approvalThreshold,
  onSetApproval,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
          Account
        </p>
        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Instellingen</h1>
        <p className="mt-1 text-sm text-navy-500 dark:text-navy-300">
          Beheer je organisatie en hoe je op de hoogte gehouden wordt.
        </p>
      </div>

      <SubscriptionCard
        orgId={orgId}
        tier={tier}
        hasStripeBilling={!!hasStripeBilling}
        potCount={potCount}
        memberCount={memberCount}
        isAdmin={isAdmin}
      />

      {isPlatformAdmin && <OwnerCompCodes />}

      <ApprovalSection
        available={approvalAvailable}
        requireApproval={requireApproval}
        threshold={approvalThreshold}
        onSave={onSetApproval}
      />

      <BrandingSection
        branding={branding}
        defaultBrandName="Kaspio"
        onChange={onBrandingChange}
        onReset={onBrandingReset}
      />

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
          Organisatie
        </h2>
        <p className="mb-4 text-sm text-navy-500 dark:text-navy-300">
          Profielgegevens van je account.
        </p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Organisatie" value={account.organizationName} />
          <Field label="Beheerder" value={account.fullName} />
          <Field label="E-mail" value={account.email} mono />
          <Field
            label="Aangemaakt op"
            value={new Intl.DateTimeFormat("nl-BE", { dateStyle: "long" }).format(
              new Date(account.createdAt),
            )}
          />
        </dl>
      </div>

      <div className="card p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-navy-900 dark:text-navy-50">
              E-mailmeldingen
            </h2>
            <p className="text-sm text-navy-500 dark:text-navy-300">
              Krijg een mail wanneer er iets belangrijks gebeurt. Beschikbaar
              vanaf Pro.
            </p>
          </div>
          <span className="badge-amber">Pro</span>
        </div>

        <div className="space-y-1 divide-y divide-navy-100 dark:divide-navy-700/60">
          <Toggle
            label="Bij nieuwe transactie"
            description="Potverantwoordelijke en beheerders krijgen een mail bij een nieuwe transactie."
            value={notifications.emailOnTransaction}
            onChange={(v) => onChange({ emailOnTransaction: v })}
          />
          <Toggle
            label="Wanneer een potje wordt aangemaakt"
            description="Beheerders krijgen een mail als er een nieuw potje bijkomt."
            value={notifications.emailOnPotCreated}
            onChange={(v) => onChange({ emailOnPotCreated: v })}
          />
          <Toggle
            label="Wanneer een lid zich aansluit"
            description="Beheerders krijgen een mail als iemand via een uitnodiging lid wordt."
            value={notifications.emailOnMemberAdded}
            onChange={(v) => onChange({ emailOnMemberAdded: v })}
          />
        </div>

        <div className="mt-6 border-t border-navy-100 pt-5 dark:border-navy-700/60">
          <p className="mb-2 text-sm font-semibold text-navy-900 dark:text-navy-50">Digest</p>
          <p className="mb-3 text-xs text-navy-500 dark:text-navy-300">
            Ontvang periodiek een samenvatting in plaats van losse meldingen.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["never", "daily", "weekly"] as const).map((f) => (
              <button
                key={f}
                onClick={() => onChange({ digestFrequency: f })}
                className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                  notifications.digestFrequency === f
                    ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
                }`}
              >
                {labelForDigest(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isOwner && <DangerZone orgName={orgName} onDeleteOrg={onDeleteOrg} />}
    </div>
  );
}

function ApprovalSection({
  available,
  requireApproval,
  threshold,
  onSave,
}: {
  available: boolean;
  requireApproval: boolean;
  threshold: number;
  onSave: (require: boolean, threshold: number) => Promise<{ error: string | null }>;
}) {
  const [enabled, setEnabled] = useState(requireApproval);
  const [amount, setAmount] = useState(String(threshold || 0));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <UpgradeHint
        badge="Team"
        title="Goedkeuringsflows"
        description="Laat uitgaven van potbeheerders boven een bedrag eerst goedkeuren. Beschikbaar in het Team-plan."
      />
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await onSave(
      enabled,
      Math.max(0, Number(amount.replace(",", ".")) || 0),
    );
    setBusy(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
        Goedkeuring van uitgaven
      </h2>
      <p className="mb-4 text-sm text-navy-500 dark:text-navy-300">
        Uitgaven van potbeheerders boven de drempel komen eerst in een
        goedkeuringswachtrij op het dashboard. Beheerders boeken meteen.
      </p>
      <Toggle
        label="Goedkeuring vereisen voor uitgaven"
        value={enabled}
        onChange={setEnabled}
      />
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Drempelbedrag (€)
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!enabled}
          className="input max-w-[160px] disabled:opacity-50"
        />
        <span className="mt-1 block text-xs text-navy-400 dark:text-navy-300">
          Uitgaven vanaf dit bedrag vereisen goedkeuring. 0 = alle uitgaven.
        </span>
      </label>
      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <button onClick={save} disabled={busy} className="btn-accent mt-4 text-sm">
        {busy ? "Bezig…" : saved ? "✓ Opgeslagen" : "Opslaan"}
      </button>
    </div>
  );
}

function DangerZone({
  orgName,
  onDeleteOrg,
}: {
  orgName: string;
  onDeleteOrg: () => Promise<{ error: string | null }>;
}) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = confirm.trim() === orgName.trim() && orgName.trim() !== "";

  async function handleDelete() {
    if (!armed || busy) return;
    setBusy(true);
    setError(null);
    const res = await onDeleteOrg();
    if (res.error) {
      setError(res.error);
      setBusy(false);
    }
    // Bij succes verdwijnt de org en navigeert de app vanzelf weg
    // (andere org of onboarding), dus geen verdere state nodig.
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-6 dark:border-rose-900/40 dark:bg-navy-900">
      <h2 className="mb-1 text-base font-semibold text-rose-700 dark:text-rose-400">
        Gevarenzone
      </h2>
      <p className="mb-4 text-sm text-navy-500 dark:text-navy-300">
        Verwijder deze organisatie en <strong>alle</strong> bijhorende data:
        potjes, transacties, leden, uitnodigingen en abonnement. Dit kan niet
        ongedaan gemaakt worden.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-navy-700 dark:text-navy-200">
          Typ <strong>{orgName}</strong> om te bevestigen
        </span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={orgName}
          className="input"
          autoComplete="off"
        />
      </label>
      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      <button
        onClick={handleDelete}
        disabled={!armed || busy}
        className="btn-danger mt-4"
      >
        {busy ? "Bezig met verwijderen…" : "Organisatie definitief verwijderen"}
      </button>
    </div>
  );
}

function labelForDigest(f: DigestFrequency): string {
  if (f === "never") return "Geen";
  if (f === "daily") return "Dagelijks";
  return "Wekelijks";
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-navy-400 dark:text-navy-300">
        {label}
      </dt>
      <dd
        className={`text-sm font-medium text-navy-900 dark:text-navy-50 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <div>
        <div className="text-sm font-medium text-navy-900 dark:text-navy-50">{label}</div>
        {description && (
          <div className="text-xs text-navy-500 dark:text-navy-300">{description}</div>
        )}
      </div>
      <span
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition ${
          value ? "bg-teal-500" : "bg-navy-200 dark:bg-navy-700"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
