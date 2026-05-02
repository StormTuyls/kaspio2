import type { DigestFrequency, NotificationSettings } from "../types";
import type { UserAccount } from "../auth";
import type { Branding } from "../branding";
import { BrandingSection } from "../components/BrandingSection";

type Props = {
  account: UserAccount;
  notifications: NotificationSettings;
  branding: Branding;
  onChange: (patch: Partial<NotificationSettings>) => void;
  onBrandingChange: (patch: Partial<Branding>) => void;
  onBrandingReset: () => void;
};

export function SettingsView({
  account,
  notifications,
  branding,
  onChange,
  onBrandingChange,
  onBrandingReset,
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

      <BrandingSection
        branding={branding}
        defaultBrandName="Potly"
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
              Krijg een mail wanneer er iets belangrijks gebeurt.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Demo · geen echte e-mails
          </span>
        </div>

        <div className="space-y-1 divide-y divide-navy-100 dark:divide-navy-700/60">
          <Toggle
            label="Bij nieuwe transactie"
            description="Mail wanneer een transactie wordt toegevoegd of verwijderd."
            value={notifications.emailOnTransaction}
            onChange={(v) => onChange({ emailOnTransaction: v })}
          />
          <Toggle
            label="Wanneer een potje wordt aangemaakt"
            description="Handig als meerdere admins potjes opzetten."
            value={notifications.emailOnPotCreated}
            onChange={(v) => onChange({ emailOnPotCreated: v })}
          />
          <Toggle
            label="Wanneer een lid wordt toegevoegd"
            description="Krijg een melding bij nieuwe potjesbeheerders."
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
                    ? "border-mint-500 bg-mint-50 text-mint-700 dark:bg-mint-900/20 dark:text-mint-300"
                    : "border-navy-100 text-navy-500 hover:border-navy-200 dark:border-navy-700 dark:text-navy-300 dark:hover:border-navy-600"
                }`}
              >
                {labelForDigest(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-1 text-base font-semibold text-navy-900 dark:text-navy-50">
          Gegevens
        </h2>
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Tijdens de bèta worden je gegevens lokaal in je browser bewaard. Wachtwoorden zijn
          gehasht (SHA-256). Voor productie verschijnt later een gekoppelde Postgres-backend
          (zie <code className="rounded bg-canvas px-1 dark:bg-navy-800">docker-compose.yml</code>).
        </p>
      </div>
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
          value ? "bg-mint-500" : "bg-navy-200 dark:bg-navy-700"
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
