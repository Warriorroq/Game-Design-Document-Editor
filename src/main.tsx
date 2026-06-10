import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { applyStoredTheme } from "@/shared/lib/appTheme";
import { isDesktopApp } from "@/shared/lib/desktop";
import { applyStoredLanguage } from "@/shared/i18n";
import "@/shared/styles/global.css";
import "@/shared/styles/themes.css";

applyStoredTheme();
applyStoredLanguage();

if (isDesktopApp) {
  document.documentElement.classList.add("desktop-app");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
