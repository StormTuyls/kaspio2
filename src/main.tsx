import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
// Self-hosted fonts (GDPR: geen requests meer naar Google Fonts / gstatic).
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
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
