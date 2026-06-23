import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import type { Pot, Transaction } from "../types";
import { exportOrgReport } from "../csv";

type Props = {
  open: boolean;
  orgName: string;
  pots: Pot[];
  transactions: Transaction[];
  onClose: () => void;
};

type Preset = "this_year" | "last_year" | "this_quarter" | "this_month" | "all" | "custom";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

type Range = { start: string | null; end: string | null; label: string };

function rangeFor(preset: Preset, now: Date, custom: { start: string; end: string }): Range {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const lastDay = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();
  switch (preset) {
    case "this_year":
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}` };
    case "last_year":
      return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31`, label: `${y - 1}` };
    case "this_quarter": {
      const q = Math.floor(m / 3); // 0..3
      const sm = q * 3;
      const em = sm + 2;
      return {
        start: `${y}-${pad(sm + 1)}-01`,
        end: `${y}-${pad(em + 1)}-${pad(lastDay(y, em))}`,
        label: `Q${q + 1} ${y}`,
      };
    }
    case "this_month":
      return {
        start: `${y}-${pad(m + 1)}-01`,
        end: `${y}-${pad(m + 1)}-${pad(lastDay(y, m))}`,
        label: `${MONTHS[m]} ${y}`,
      };
    case "all":
      return { start: null, end: null, label: "alle transacties" };
    case "custom":
      return {
        start: custom.start || null,
        end: custom.end || null,
        label:
          custom.start || custom.end
            ? `${custom.start || "begin"} , ${custom.end || "nu"}`
            : "aangepaste periode",
      };
  }
}

export function ReportModal({ open, orgName, pots, transactions, onClose }: Props) {
  const [preset, setPreset] = useState<Preset>("this_year");
  const [custom, setCustom] = useState({ start: "", end: "" });
  const [details, setDetails] = useState(true);

  // new Date() is in app-context prima (niet in workflow-scripts).
  const range = useMemo(
    () => rangeFor(preset, new Date(), custom),
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
            onChange={(e) => setPreset(e.target.value as Preset)}
            className="w-full rounded-lg border border-navy-200 bg-white px-2.5 py-2 text-sm dark:border-navy-700 dark:bg-navy-800 dark:text-navy-50"
          >
            <option value="this_year">Dit jaar</option>
            <option value="last_year">Vorig jaar</option>
            <option value="this_quarter">Dit kwartaal</option>
            <option value="this_month">Deze maand</option>
            <option value="all">Alle transacties</option>
            <option value="custom">Aangepast…</option>
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

        <label className="flex items-center gap-2 text-sm text-navy-700 dark:text-navy-200">
          <input
            type="checkbox"
            checked={details}
            onChange={(e) => setDetails(e.target.checked)}
            className="h-4 w-4 rounded border-navy-300 text-teal-600 focus:ring-teal-500"
          />
          Transactiedetails per potje toevoegen
        </label>

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
