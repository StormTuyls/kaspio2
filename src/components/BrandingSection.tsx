import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { AccentKey, Branding } from "../branding";
import { ACCENT_LABELS, ACCENT_PALETTES } from "../branding";

const MAX_LOGO_BYTES = 200 * 1024;

type Props = {
  branding: Branding;
  defaultBrandName: string;
  onChange: (patch: Partial<Branding>) => void;
  onReset: () => void;
};

export function BrandingSection({ branding, defaultBrandName, onChange, onReset }: Props) {
  const [name, setName] = useState(branding.brandName ?? "");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const accentKeys: AccentKey[] = ["mint", "teal", "blue", "violet", "fuchsia", "amber"];

  function handleNameBlur() {
    const trimmed = name.trim();
    onChange({ brandName: trimmed.length > 0 ? trimmed : null });
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Alleen afbeeldingen zijn toegestaan.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError(`Logo mag maximaal ${Math.round(MAX_LOGO_BYTES / 1024)} KB zijn.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onChange({ logoDataUrl: result });
      }
    };
    reader.onerror = () => setError("Kon bestand niet lezen.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
            Whitelabel
          </h2>
          <p className="text-sm text-ink-700 dark:text-ink-500">
            Maak deze workspace de jouwe met een eigen merknaam, kleur en logo.
          </p>
        </div>
        <button onClick={onReset} className="btn-secondary text-xs">
          Reset
        </button>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-800 dark:text-ink-300">
            Merknaam
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={defaultBrandName}
            className="input"
          />
          <span className="mt-1 block text-xs text-ink-600 dark:text-ink-500">
            Vervangt "Kaspio" in de zijbalk en topbar. Leeg = standaard.
          </span>
        </label>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-300">
            Accentkleur
          </span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {accentKeys.map((k) => {
              const palette = ACCENT_PALETTES[k];
              const active = branding.accent === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange({ accent: k })}
                  className={`group relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition ${
                    active
                      ? "border-ink-900 dark:border-white"
                      : "border-ink-200 hover:border-ink-300 dark:border-ink-800 dark:hover:border-ink-600"
                  }`}
                  aria-label={ACCENT_LABELS[k]}
                >
                  <span
                    className="h-8 w-8 rounded-full shadow-sm ring-1 ring-black/5"
                    style={{ backgroundColor: palette[500] }}
                  />
                  <span className="text-[11px] font-semibold text-ink-800 dark:text-ink-300">
                    {ACCENT_LABELS[k]}
                  </span>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink-950 text-white dark:bg-white dark:text-ink-900">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink-800 dark:text-ink-300">
            Logo
          </span>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-200 bg-ink-50 dark:border-ink-800 dark:bg-ink-900"
            >
              {branding.logoDataUrl ? (
                <img src={branding.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-ink-600 dark:text-ink-700">Geen logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-sm"
                >
                  {branding.logoDataUrl ? "Vervangen" : "Logo uploaden"}
                </button>
                {branding.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => onChange({ logoDataUrl: null })}
                    className="btn-danger text-sm"
                  >
                    Verwijderen
                  </button>
                )}
              </div>
              <span className="text-xs text-ink-600 dark:text-ink-500">
                PNG of SVG, max {Math.round(MAX_LOGO_BYTES / 1024)} KB.
              </span>
            </div>
          </div>
          {error && (
            <div className="mt-2 rounded-lg border border-fout-100 bg-fout-100 px-3 py-2 text-sm text-fout-600 dark:border-fout-100/40 dark:bg-fout-600/20 dark:text-fout-400">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
