import { useState } from "react";
import { TIER_LABELS, TIER_LIMITS, startCheckout, startPortal } from "../data";
import type { SubTier } from "../supabase";

import { Foutmelding } from "./Foutmelding";
type Props = {
  orgId: string;
  tier: SubTier;
  /** Echt Stripe-abonnement aanwezig? Zo niet (handmatig/comped tier), geen portal. */
  hasStripeBilling?: boolean;
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
  hasStripeBilling = false,
  potCount,
  memberCount,
  isAdmin,
}: Props) {
  const [yearly, setYearly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limits = TIER_LIMITS[tier];
  // Zelfde regel als in de create-checkout-session function: een org die nog
  // nooit een Stripe-abonnement had, krijgt de proefmaand.
  const trialEligible = tier === "free" && !hasStripeBilling;

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
          <h2 className="text-base font-semibold text-sterk">
            Abonnement
          </h2>
          <p className="text-sm text-basis">
            Huidig plan:{" "}
            <span className="badge-teal">{TIER_LABELS[tier]}</span>
          </p>
        </div>
        {tier !== "free" && isAdmin && hasStripeBilling && (
          <button
            onClick={manage}
            disabled={busy !== null}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {busy === "portal" ? "Bezig…" : "Abonnement beheren"}
          </button>
        )}
        {tier !== "free" && isAdmin && !hasStripeBilling && (
          <span className="text-xs text-zacht">
            Handmatig/test-plan , geen Stripe-abonnement
          </span>
        )}
      </div>

      {/* Verbruik t.o.v. limieten */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <UsageBar label="Potjes" used={potCount} max={limits.pots} />
        <UsageBar label="Leden" used={memberCount} max={limits.members} />
      </div>

      {tier === "free" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-basis">
            <span>Maandelijks</span>
            <button
              onClick={() => setYearly((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition ${
                yearly ? "bg-in-600" : "bg-ink-200 dark:bg-ink-800"
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
            <span className="rounded-full border border-uit-300 bg-uit-100 px-2 py-0.5 text-xs font-bold text-uit-700">
              Bespaar 20%
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <PlanOption
              name="Pro"
              price={yearly ? "€3,20" : "€4"}
              suffix="/maand"
              features={["Onbeperkt potjes", "Onbeperkt leden", "Grafieken & bankkoppeling"]}
              cta={trialEligible ? "Start gratis maand" : "Upgrade naar Pro"}
              trial={trialEligible}
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
              cta={trialEligible ? "Start gratis maand" : "Upgrade naar Team"}
              trial={trialEligible}
              ctaStyle="amber"
              disabled={!isAdmin || busy !== null}
              busy={busy === "team"}
              onClick={() => upgrade("team")}
            />
          </div>
          {trialEligible && (
            <p className="mt-3 text-xs text-zacht">
              Je geeft je kaartgegevens nu al op, maar de eerste maand wordt
              niets aangerekend. Opzeggen tijdens de proefmaand kan altijd, dan
              betaal je niks.
            </p>
          )}
          {!isAdmin && (
            <p className="mt-3 text-xs text-zacht">
              Alleen een beheerder kan het abonnement wijzigen.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-basis">
          Je zit op het {TIER_LABELS[tier]}-plan. Bedankt voor je steun aan Kaspio.
        </p>
      )}

      {error && (
        <Foutmelding className="mt-3">
          {error}
        </Foutmelding>
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
        <span className="font-medium text-basis">{label}</span>
        <span
          className={`tabular-nums ${full ? "font-semibold text-uit-700 dark:text-uit-400" : "text-zacht"}`}
        >
          {used} / {fmtLimit(max)}
        </span>
      </div>
      {max !== Infinity && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
          <div
            className={`h-full rounded-full transition-all ${full ? "bg-uit-600" : "bg-in-600"}`}
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
  trial = false,
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
  /** Toon de proefmaand bij dit plan. */
  trial?: boolean;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-4 dark:border-ink-800">
      <div className="mb-1 flex items-baseline gap-1">
        <span className="text-sm font-bold text-ink-900 dark:text-white">{name}</span>
        <span className="text-lg font-extrabold text-ink-900 dark:text-white">{price}</span>
        <span className="text-xs text-zacht">{suffix}</span>
      </div>
      {trial && (
        <p className="mb-2 text-xs font-semibold text-in-600 dark:text-in-400">
          Eerste maand gratis, daarna {price}
          {suffix}
        </p>
      )}
      <ul className="mb-3 space-y-1 text-xs text-basis">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <svg
              aria-hidden
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 flex-shrink-0 text-in-600 dark:text-in-400"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50 ${
          ctaStyle === "amber"
            ? "bg-uit-600 text-white hover:bg-uit-700"
            : "bg-in-600 text-white transition-colors hover:bg-in-700"
        }`}
      >
        {busy ? "Bezig…" : cta}
      </button>
    </div>
  );
}
