import { useRef, useState } from "react";
import { useAttachments, type Attachment } from "../data";

type Props = {
  orgId: string;
  transactionId: string;
  isAdmin: boolean;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Bijlagen (bonnetjes/facturen) bij één transactie. Team-feature: render dit
 * alleen wanneer attachmentsEnabled(tier) waar is. Uploaden/verwijderen vereist
 * admin (komt ook overeen met de RLS-policies op de bucket).
 */
export function TransactionAttachments({ orgId, transactionId, isAdmin }: Props) {
  const { attachments, loading, upload, remove, getUrl } = useAttachments(
    orgId,
    transactionId,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await upload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload mislukt");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openAttachment(att: Attachment) {
    const url = await getUrl(att);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRemove(att: Attachment) {
    if (!confirm(`Bijlage "${att.name}" verwijderen?`)) return;
    setBusy(true);
    setError(null);
    try {
      await remove(att);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {loading && attachments.length === 0 ? (
        <p className="text-xs text-navy-400 dark:text-navy-500">Bijlagen laden…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-navy-400 dark:text-navy-500">Nog geen bijlagen.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white px-2.5 py-1.5 text-xs dark:border-navy-700/60 dark:bg-navy-800/60"
            >
              <button
                type="button"
                onClick={() => openAttachment(att)}
                className="flex items-center gap-1.5 font-medium text-teal-700 hover:underline dark:text-teal-300"
                title="Openen"
              >
                <span aria-hidden>📎</span>
                <span className="max-w-[12rem] truncate">{att.name}</span>
              </button>
              {att.size ? (
                <span className="tabular-nums text-navy-400 dark:text-navy-500">
                  {formatSize(att.size)}
                </span>
              ) : null}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleRemove(att)}
                  disabled={busy}
                  className="text-navy-300 hover:text-rose-600 disabled:opacity-50 dark:text-navy-500 dark:hover:text-rose-400"
                  aria-label="Bijlage verwijderen"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-navy-200 px-2.5 py-1.5 text-xs font-medium text-navy-600 hover:border-teal-400 hover:text-teal-700 dark:border-navy-600 dark:text-navy-300 dark:hover:border-teal-500 dark:hover:text-teal-300">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFile}
              disabled={busy}
            />
            {busy ? "Bezig…" : "+ Bijlage toevoegen"}
          </label>
          <span className="text-[11px] text-navy-400 dark:text-navy-500">
            Afbeelding of PDF, max 10 MB
          </span>
        </div>
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
