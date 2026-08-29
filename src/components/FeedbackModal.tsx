import { useState } from "react";
import { Modal } from "./Modal";
import { submitFeedback } from "../data";
import type { FeedbackKind } from "../data";

type Props = {
  open: boolean;
  onClose: () => void;
  orgId: string | null;
  tier: string;
};

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idee" },
  { value: "other", label: "Andere" },
];

const PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: "Wat ging er mis? Wat verwachtte je dat er zou gebeuren?",
  idea: "Welke functie mis je, of wat zou je anders willen?",
  other: "Vertel het ons.",
};

export function FeedbackModal({ open, onClose, orgId, tier }: Props) {
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function close() {
    onClose();
    // Reset na de sluit-animatie, zodat heropenen vers begint.
    setTimeout(() => {
      setKind("idea");
      setMessage("");
      setStatus("idle");
      setError("");
    }, 150);
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    setError("");
    const context = {
      route: window.location.pathname,
      tier,
      mode: import.meta.env.MODE,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      userAgent: navigator.userAgent,
    };
    const res = await submitFeedback({ kind, message: trimmed, orgId, context });
    if (res.ok) {
      setStatus("done");
    } else {
      setStatus("error");
      setError(res.error ?? "Er ging iets mis. Probeer het later opnieuw.");
    }
  }

  return (
    <Modal open={open} title="Feedback" onClose={close}>
      {status === "done" ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-in-100 text-in-600 dark:bg-in-600/15 dark:text-in-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">Bedankt voor je feedback.</p>
          <p className="mt-1 text-sm text-basis">We lezen alles. Soms volgt er een antwoord.</p>
          <button onClick={close} className="btn-primary mt-5 w-full">Sluiten</button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
              Type
            </span>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => {
                const active = kind === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setKind(k.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? "border-in-600 bg-in-100 text-in-700 dark:border-in-600 dark:bg-in-600/15 dark:text-in-300"
                        : "border-ink-300 text-basis hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-900"
                    }`}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-message" className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
              Je bericht
            </label>
            <textarea
              id="feedback-message"
              className="input min-h-[120px] resize-y"
              placeholder={PLACEHOLDER[kind]}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              autoFocus
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-fout-600 dark:text-fout-400">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!message.trim() || status === "sending"}
            className="btn-primary w-full"
          >
            {status === "sending" ? "Versturen..." : "Versturen"}
          </button>
        </div>
      )}
    </Modal>
  );
}
