import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
// Self-hosted fonts (GDPR: geen requests meer naar Google Fonts / gstatic).
// Alleen de gewichtsas en alleen latin: Instrument Sans levert geen andere
// subsets, en de mono krijgt zijn @font-face met de hand in App.css zodat
// Cyrillisch, Grieks en Vietnamees niet meekomen in een lang="nl" app.
import "@fontsource-variable/instrument-sans/wght.css";
import App from "./App.tsx";
import { DialogProvider } from "./components/ConfirmDialog";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);
