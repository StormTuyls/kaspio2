import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Modal } from "./Modal";

// =============================================================================
// In-app bevestigings-/melddialoog , vervangt window.confirm/alert
// =============================================================================
// Native confirm()/alert() worden op sommige mobiele browsers (in-app browsers,
// of nadat de gebruiker "niet meer tonen" aantikte) onderdrukt. Dan lijkt bv.
// een delete-knop niets te doen. Deze provider rendert een gewone Modal en geeft
// een Promise-gebaseerde API, zodat bevestigingen overal en op elk toestel werken.

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Rode "gevaar"-knop (verwijderen e.d.). */
  danger?: boolean;
};

type AlertOpts = {
  title: string;
  message?: string;
  okLabel?: string;
};

type DialogState =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "alert"; opts: AlertOpts; resolve: () => void }
  | null;

const ConfirmContext = createContext<
  ((opts: ConfirmOpts) => Promise<boolean>) | null
>(null);
const AlertContext = createContext<((opts: AlertOpts) => Promise<void>) | null>(
  null,
);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setState({ kind: "confirm", opts, resolve });
      }),
    [],
  );

  const alert = useCallback(
    (opts: AlertOpts) =>
      new Promise<void>((resolve) => {
        setState({ kind: "alert", opts, resolve });
      }),
    [],
  );

  // Resolve vanuit de render-closure (niet in de setState-updater): zo blijft de
  // updater puur en kan de promise nooit dubbel resolven onder StrictMode.
  function settle(result: boolean) {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(result);
    else state.resolve();
    setState(null);
  }

  const opts = state?.opts;
  const isConfirm = state?.kind === "confirm";

  return (
    <ConfirmContext.Provider value={confirm}>
      <AlertContext.Provider value={alert}>
        {children}
        <Modal
          open={state !== null}
          title={opts?.title ?? ""}
          onClose={() => settle(false)}
        >
          <div className="space-y-5">
            {opts?.message && (
              <p className="text-sm text-ink-muted dark:text-ink-400">
                {opts.message}
              </p>
            )}
            {/* Op mobiel onder elkaar, met de bevestig-knop onderaan binnen
                duimbereik. Vanaf sm de klassieke rij rechts. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {isConfirm && (
                <button
                  type="button"
                  onClick={() => settle(false)}
                  className="btn-secondary w-full sm:w-auto"
                >
                  {(state?.opts as ConfirmOpts).cancelLabel ?? "Annuleren"}
                </button>
              )}
              <button
                type="button"
                onClick={() => settle(true)}
                className={`w-full sm:w-auto ${
                  isConfirm && (state.opts as ConfirmOpts).danger
                    ? "btn-danger"
                    : "btn-accent"
                }`}
              >
                {isConfirm
                  ? (state.opts as ConfirmOpts).confirmLabel ?? "Bevestigen"
                  : (state?.opts as AlertOpts)?.okLabel ?? "Oké"}
              </button>
            </div>
          </div>
        </Modal>
      </AlertContext.Provider>
    </ConfirmContext.Provider>
  );
}

/** Vraag een ja/nee-bevestiging. Returnt true bij bevestigen. */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm moet binnen <DialogProvider> gebruikt worden.");
  return ctx;
}

/** Toon een melding met één "Oké"-knop. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert moet binnen <DialogProvider> gebruikt worden.");
  return ctx;
}
