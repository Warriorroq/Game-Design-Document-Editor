import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyStoredTheme } from "./lib/appTheme";
import { isDesktopApp } from "./lib/desktop";
import { applyStoredLanguage } from "./lib/i18n";
import "./styles/global.css";
import "./styles/themes.css";

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
