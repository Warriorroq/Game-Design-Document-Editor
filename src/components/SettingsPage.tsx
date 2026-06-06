import { useMemo, useState } from "react";
import { ShortcutBindingInput } from "./ShortcutBindingInput";
import { BoardSettingsPanel } from "./BoardSettingsPanel";
import { GitSettingsPanel } from "./GitSettingsPanel";
import { useLocale } from "../context/LocaleContext";
import { useShortcuts } from "../context/ShortcutsContext";
import { APP_LANGUAGES } from "../lib/i18n";
import { shortcutDescKey, shortcutLabelKey } from "../lib/i18n/shortcutMessages";
import { APP_THEME_IDS, themePreview } from "../lib/appTheme";
import { themeDescKey, themeNameKey } from "../lib/i18n";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutGroup,
} from "../lib/shortcuts";
import { useAppTheme } from "../hooks/useAppTheme";
import { isDesktopApp } from "../lib/desktop";
import type { GitStatus } from "../lib/git";

type SettingsTab = "general" | "styles" | "board" | "languages" | "shortcuts" | "git";

interface SettingsPageProps {
  projectFolderPath?: string | null;
  gitAvailable?: boolean;
  gitStatus?: GitStatus | null;
  onRefreshGitStatus?: () => void;
}

export function SettingsPage({
  projectFolderPath = null,
  gitAvailable = false,
  gitStatus = null,
  onRefreshGitStatus,
}: SettingsPageProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const { themeId, setTheme } = useAppTheme();
  const { language, setLanguage, t } = useLocale();
  const { resetAll } = useShortcuts();

  const tabs = useMemo(() => {
    const order: SettingsTab[] = isDesktopApp
      ? ["general", "board", "git", "styles", "shortcuts", "languages"]
      : ["general", "board", "styles", "shortcuts", "languages"];
    const labelKeys: Record<SettingsTab, Parameters<typeof t>[0]> = {
      general: "settings.tab.general",
      board: "settings.tab.board",
      git: "settings.tab.git",
      styles: "settings.tab.styles",
      shortcuts: "settings.tab.shortcuts",
      languages: "settings.tab.languages",
    };
    return order.map((id) => ({ id, labelKey: labelKeys[id] }));
  }, []);

  const shortcutGroups: ShortcutGroup[] = ["editor", "desk"];
  const groupTitleKey = (group: ShortcutGroup) =>
    group === "editor"
      ? "settings.shortcutsGroupEditor"
      : "settings.shortcutsGroupDesk";

  return (
    <div className="settings-page">
      <div className="settings-layout">
        <header className="settings-header">
          <h1 className="settings-title">{t("settings.title")}</h1>
        </header>

        <div
          className="settings-tabs"
          role="tablist"
          aria-label={t("settings.tabsAria")}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`settings-tab ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="settings-panel" role="tabpanel">
          {tab === "general" && (
            <section className="settings-section">
              <h2 className="settings-section-title">
                {t("settings.generalTitle")}
              </h2>
            </section>
          )}

          {tab === "styles" && (
            <section className="settings-section">
              <h2 className="settings-section-title">
                {t("settings.stylesTitle")}
              </h2>
              <div className="theme-grid">
                {APP_THEME_IDS.map((id) => {
                  const active = themeId === id;
                  const preview = themePreview(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`theme-card ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setTheme(id)}
                    >
                      <div className="theme-card-preview">
                        <span
                          className="theme-swatch theme-swatch--bg"
                          style={{ background: preview[0] }}
                        />
                        <span
                          className="theme-swatch theme-swatch--accent"
                          style={{ background: preview[1] }}
                        />
                        <span
                          className="theme-swatch theme-swatch--text"
                          style={{ background: preview[2] }}
                        />
                      </div>
                      <span className="theme-card-label">
                        {t(themeNameKey(id))}
                      </span>
                      <span className="theme-card-desc">
                        {t(themeDescKey(id))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "board" && (
            <section className="settings-section">
              <h2 className="settings-section-title">
                {t("settings.boardTitle")}
              </h2>
              <BoardSettingsPanel />
            </section>
          )}

          {tab === "languages" && (
            <section className="settings-section">
              <h2 className="settings-section-title">
                {t("settings.languagesTitle")}
              </h2>
              <div className="language-grid">
                {APP_LANGUAGES.map((lang) => {
                  const active = language === lang;
                  return (
                    <button
                      key={lang}
                      type="button"
                      className={`language-card ${active ? "active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setLanguage(lang)}
                    >
                      <span className="language-card-label">
                        {t(`language.${lang}` as "language.en")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {tab === "git" && (
            <section className="settings-section">
              <h2 className="settings-section-title">
                {t("settings.gitTitle")}
              </h2>
              <GitSettingsPanel
                folderPath={projectFolderPath}
                gitAvailable={gitAvailable}
                gitStatus={gitStatus}
                onRefreshGitStatus={onRefreshGitStatus}
              />
            </section>
          )}

          {tab === "shortcuts" && (
            <section className="settings-section settings-section--shortcuts">
              <h2 className="settings-section-title">
                {t("settings.shortcutsTitle")}
              </h2>
              <p className="settings-shortcuts-hint">
                {t("settings.shortcutsHint")}
              </p>
              {shortcutGroups.map((group) => (
                <div key={group} className="shortcut-group">
                  <h3 className="shortcut-group-title">
                    {t(groupTitleKey(group))}
                  </h3>
                  <ul className="shortcut-list">
                    {SHORTCUT_DEFINITIONS.filter((d) => d.group === group).map(
                      (def) => (
                        <li key={def.id} className="shortcut-row">
                          <div className="shortcut-row-text">
                            <span className="shortcut-row-label">
                              {t(shortcutLabelKey(def.id))}
                            </span>
                            <span className="shortcut-row-desc">
                              {t(shortcutDescKey(def.id))}
                            </span>
                          </div>
                          <ShortcutBindingInput actionId={def.id} />
                        </li>
                      )
                    )}
                  </ul>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost settings-shortcuts-reset"
                onClick={resetAll}
              >
                {t("settings.shortcutsResetAll")}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
