import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Pot, Transaction } from "../types";
import { exportOrgReport } from "../csv";
import { PERIOD_OPTIONS, resolvePeriod, type PeriodPreset } from "../period";

type Props = {
  open: boolean;
  orgName: string;
  pots: Pot[];
  transactions: Transaction[];
  onClose: () => void;
};

export function ReportModal({ open, orgName, pots, transactions, onClose }: Props) {
  const [preset, setPreset] = useState<PeriodPreset>("this_year");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [details, setDetails] = useState(true);
  const [history, setHistory] = useState(false);

  // new Date() is in app-context prima (niet in workflow-scripts).
  const range = useMemo(
    () => resolvePeriod(preset, new Date(), custom),
    [preset, custom],
  );

  function generate() {
    exportOrgReport({
      orgName,
      periodLabel: range.label,
      start: range.start,
      end: range.end,
      pots,
      transactions,
      includeDetails: details,
      includeHistory: history,
    });
    onClose();
  }

  return (
    <Modal open={open} title="Financieel rapport" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-navy-500 dark:text-navy-300">
          Genereer een overzicht met de totalen en het resultaat per potje. Handig
          voor de penningmeester of de algemene vergadering. Opent als PDF (kies
          "Bewaar als PDF" in het printvenster).
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
            Periode
          </span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as PeriodPreset)}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                Van
              </span>
              <input
                type="date"
                value={custom.start}
                onChange={(e) => setCustom({ ...custom, start: e.target.value })}
                className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-navy-500 dark:text-navy-300">
                Tot en met
              </span>
              <input
                type="date"
                value={custom.end}
                onChange={(e) => setCustom({ ...custom, end: e.target.value })}
                className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
              />
            </label>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
            <input
              type="checkbox"
              checked={details}
              onChange={(e) => setDetails(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-500"
            />
            Transactiedetails per potje toevoegen
          </label>

          <label className="flex items-start gap-2 text-sm text-navy-700 dark:text-navy-200">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => setHistory(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-500"
            />
            <span>
              Chronologisch transactieoverzicht (hele organisatie)
              <span className="block text-xs text-navy-400 dark:text-navy-400">
                Eén lijst op datum, over alle potjes heen, met het potje als kolom.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-ghost">
            Annuleren
          </button>
          <button onClick={generate} className="btn-accent">
            Rapport genereren
          </button>
        </div>
      </div>
    </Modal>
  );
}
