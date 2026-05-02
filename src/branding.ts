export type AccentKey = "mint" | "teal" | "blue" | "violet" | "fuchsia" | "amber";

export type AccentPalette = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const ACCENT_PALETTES: Record<AccentKey, AccentPalette> = {
  mint: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#4ad591",
    500: "#2fbf71",
    600: "#25a05f",
    700: "#1f7c4a",
    800: "#185f39",
    900: "#134c2f",
  },
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
  },
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
  },
  violet: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
  },
  fuchsia: {
    50: "#fdf4ff",
    100: "#fae8ff",
    200: "#f5d0fe",
    300: "#f0abfc",
    400: "#e879f9",
    500: "#d946ef",
    600: "#c026d3",
    700: "#a21caf",
    800: "#86198f",
    900: "#701a75",
  },
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
  },
};

export const ACCENT_LABELS: Record<AccentKey, string> = {
  mint: "Mint",
  teal: "Teal",
  blue: "Blauw",
  violet: "Paars",
  fuchsia: "Fuchsia",
  amber: "Amber",
};

export type Branding = {
  brandName: string | null;
  accent: AccentKey;
  logoDataUrl: string | null;
};

export const defaultBranding: Branding = {
  brandName: null,
  accent: "mint",
  logoDataUrl: null,
};

export function paletteToCssVars(accent: AccentKey): Record<string, string> {
  const p = ACCENT_PALETTES[accent];
  return {
    "--color-mint-50": p[50],
    "--color-mint-100": p[100],
    "--color-mint-200": p[200],
    "--color-mint-300": p[300],
    "--color-mint-400": p[400],
    "--color-mint-500": p[500],
    "--color-mint-600": p[600],
    "--color-mint-700": p[700],
    "--color-mint-800": p[800],
    "--color-mint-900": p[900],
  };
}
