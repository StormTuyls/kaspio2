import { useState } from "react";
import { TIER_LABELS, TIER_LIMITS, startCheckout, startPortal } from "../data";
import type { SubTier } from "../supabase";

type Props = {
  orgId: string;
  tier: SubTier;
  /** Huidig verbruik om naast de limieten te tonen. */
  potCount: number;
  memberCount: number;
  /** Alleen admins kunnen upgraden. */
  isAdmin: boolean;
};

function fmtLimit(n: number): string {
  return n === Infinity ? "onbeperkt" : String(n);
}

export function SubscriptionCard({
  orgId,
  tier,
  potCount,
  memberCount,
  isAdmin,
}: Props) {
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limits = TIER_LIMITS[tier];

  async function upgrade(target: "pro" | "team") {
    setError(null);
    setBusy(target);
    const res = await startCheckout(orgId, target, yearly ? "year" : "month");
    if (res.error) {
      setError(res.error);
      setBusy(null);
    }
    // bij succes redirect startCheckout naar Stripe (geen reset nodig)
  }

  async function manage() {
    setError(null);
    setBusy("portal");
    const res = await startPortal(orgId);
    if (res.error) {
      setError(res.error);
      setBusy(null);
    }
    // bij succes redirect startPortal naar de Stripe-portal
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-navy-900 dark:text-navy-50">
            Abonnement
          </h2>
          <p className="text-sm text-navy-500 dark:text-navy-300">
            Huidig plan:{" "}
            <span className="badge-teal">{TIER_LABELS[tier]}</span>
          </p>
        </div>
        {tier !== "free" && isAdmin && (
          <button
            onClick={manage}
            disabled={busy !== null}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {busy === "portal" ? "Bezig…" : "Abonnement beheren"}
          </button>
        )}
      </div>

      {/* Verbruik t.o.v. limieten */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <UsageBar label="Potjes" used={potCount} max={limits.pots} />
        <UsageBar label="Leden" used={memberCount} max={limits.members} />
      </div>

      {tier === "free" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-navy-500 dark:text-navy-300">
            <span>Maandelijks</span>
            <button
              onClick={() => setYearly((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition ${
                yearly ? "bg-teal-500" : "bg-navy-200 dark:bg-navy-700"
              }`}
              aria-pressed={yearly}
              aria-label="Wissel maandelijks/jaarlijks"
            >
              <span
                className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${
                  yearly ? "left-[23px]" : "left-[3px]"
                }`}
              />
            </button>
            <span>Jaarlijks</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              Bespaar 20%
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PlanOption
              name="Pro"
              price={yearly ? "€3,20" : "€4"}
              suffix="/maand"
              features={["Onbeperkt potjes", "Onbeperkt leden", "Grafieken & bankkoppeling"]}
              cta="Upgrade naar Pro"
              ctaStyle="fill"
              disabled={!isAdmin || busy !== null}
              busy={busy === "pro"}
              onClick={() => upgrade("pro")}
            />
            <PlanOption
              name="Team"
              price={yearly ? "€8" : "€10"}
              suffix="/maand"
              features={[
                "Alles uit Pro",
                "Potgroepen",
                "Goedkeuringsflows",
                "Bijlagen (bonnetjes & facturen)",
                "Meerdere beheerders",
              ]}
              cta="Upgrade naar Team"
              ctaStyle="amber"
              disabled={!isAdmin || busy !== null}
              busy={busy === "team"}
              onClick={() => upgrade("team")}
            />
          </div>
          {!isAdmin && (
            <p className="mt-3 text-xs text-navy-400">
              Alleen een beheerder kan het abonnement wijzigen.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Je zit op het {TIER_LABELS[tier]}-plan. Bedankt voor je steun aan Kaspio.
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max === Infinity ? 0 : Math.min(100, (used / max) * 100);
  const full = max !== Infinity && used >= max;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-navy-600 dark:text-navy-300">{label}</span>
        <span
          className={`tabular-nums ${full ? "font-semibold text-amber-700 dark:text-amber-400" : "text-navy-400"}`}
        >
          {used} / {fmtLimit(max)}
        </span>
      </div>
      {max !== Infinity && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-100 dark:bg-navy-700">
          <div
            className={`h-full rounded-full transition-all ${full ? "bg-amber-500" : "bg-teal-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function PlanOption({
  name,
  price,
  suffix,
  features,
  cta,
  ctaStyle,
  disabled,
  busy,
  onClick,
}: {
  name: string;
  price: string;
  suffix: string;
  features: string[];
  cta: string;
  ctaStyle: "fill" | "amber";
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-navy-100 p-4 dark:border-navy-700">
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-sm font-bold text-navy-900 dark:text-white">{name}</span>
        <span className="text-lg font-extrabold text-navy-900 dark:text-white">{price}</span>
        <span className="text-xs text-navy-400">{suffix}</span>
      </div>
      <ul className="mb-3 space-y-1 text-xs text-navy-500 dark:text-navy-300">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span className="text-teal-500">✓</span> {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50 ${
          ctaStyle === "amber"
            ? "bg-amber-500 text-ink hover:bg-amber-400"
            : "bg-teal-500 text-white hover:bg-teal-600"
        }`}
      >
        {busy ? "Bezig…" : cta}
      </button>
    </div>
  );
}
