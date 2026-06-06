import { useCallback, useEffect, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import { isDesktopApp } from "../lib/desktop";
import {
  applyGitIdentity,
  authenticateGitRemote,
  formatGitError,
  getGitIdentity,
  getGitRemote,
  setGitRemote,
  storeGitAccessToken,
} from "../lib/git";
import { loadGitSettings, saveGitSettings } from "../lib/gitSettings";
import type { GitStatus } from "../lib/git";

interface GitSettingsPanelProps {
  folderPath: string | null;
  gitAvailable: boolean;
  gitStatus: GitStatus | null;
  onRefreshGitStatus?: () => void;
}

export function GitSettingsPanel({
  folderPath,
  gitAvailable,
  gitStatus,
  onRefreshGitStatus,
}: GitSettingsPanelProps) {
  const { t } = useLocale();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async () => {
    const stored = loadGitSettings();
    let name = stored.userName;
    let email = stored.userEmail;
    let remote = "";

    if (folderPath && isDesktopApp) {
      try {
        const repoIdentity = await getGitIdentity(folderPath);
        if (repoIdentity.name) name = repoIdentity.name;
        if (repoIdentity.email) email = repoIdentity.email;
        remote = (await getGitRemote(folderPath)) ?? "";
      } catch {
        // use stored values
      }
    }

    setUserName(name);
    setUserEmail(email);
    setRemoteUrl(remote);
    setSaved(false);
    setError(null);
  }, [folderPath]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const trimmedName = userName.trim();
    const trimmedEmail = userEmail.trim();
    const trimmedRemote = remoteUrl.trim();

    if (!trimmedName || !trimmedEmail) {
      setError(t("git.missingIdentity"));
      setSaving(false);
      return;
    }

    saveGitSettings({
      userName: trimmedName,
      userEmail: trimmedEmail,
    });

    if (folderPath && isDesktopApp) {
      try {
        const identityResult = await applyGitIdentity(folderPath, {
          userName: trimmedName,
          userEmail: trimmedEmail,
        });
        if (!identityResult.ok) {
          setError(formatGitError(identityResult.error, t));
          setSaving(false);
          return;
        }

        if (gitStatus?.isRepo && trimmedRemote) {
          const remoteResult = await setGitRemote(folderPath, trimmedRemote);
          if (!remoteResult.ok) {
            setError(formatGitError(remoteResult.error, t));
            setSaving(false);
            return;
          }
        }

        if (gitStatus?.isRepo && accessToken.trim()) {
          const tokenResult = await storeGitAccessToken(
            folderPath,
            accessToken.trim()
          );
          if (!tokenResult.ok) {
            setError(formatGitError(tokenResult.error, t));
            setSaving(false);
            return;
          }
          setAccessToken("");
          setConnected(true);
        }

        onRefreshGitStatus?.();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("git.errorGeneric")
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
  };

  const handleConnect = async () => {
    if (!folderPath || !gitStatus?.isRepo) return;

    const trimmedRemote = remoteUrl.trim();
    if (!trimmedRemote) {
      setError(t("git.settingsAuthNeedRemote"));
      return;
    }

    setConnecting(true);
    setConnected(false);
    setError(null);

    try {
      const remoteResult = await setGitRemote(folderPath, trimmedRemote);
      if (!remoteResult.ok) {
        setError(formatGitError(remoteResult.error, t));
        setConnecting(false);
        return;
      }

      const authResult = await authenticateGitRemote(folderPath);
      if (!authResult.ok) {
        setError(formatGitError(authResult.error, t));
        setConnecting(false);
        return;
      }

      setConnected(true);
      onRefreshGitStatus?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("git.errorGeneric"));
    }

    setConnecting(false);
  };

  if (!isDesktopApp) {
    return <p className="settings-hint">{t("git.settingsDesktopOnly")}</p>;
  }

  if (!gitAvailable) {
    return <p className="settings-hint">{t("git.notAvailable")}</p>;
  }

  return (
    <div className="settings-git">
      <section className="settings-git-block">
        <h3 className="settings-git-block-title">{t("git.settingsAccount")}</h3>
        <p className="settings-hint">{t("git.settingsAccountHint")}</p>
        <label className="settings-field">
          <span>{t("git.settingsUserName")}</span>
          <input
            type="text"
            value={userName}
            onChange={(e) => {
              setUserName(e.target.value);
              setSaved(false);
            }}
            placeholder={t("git.settingsUserNamePlaceholder")}
            autoComplete="name"
          />
        </label>
        <label className="settings-field">
          <span>{t("git.settingsUserEmail")}</span>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => {
              setUserEmail(e.target.value);
              setSaved(false);
            }}
            placeholder={t("git.settingsUserEmailPlaceholder")}
            autoComplete="email"
          />
        </label>
      </section>

      <section className="settings-git-block">
        <h3 className="settings-git-block-title">{t("git.settingsRepo")}</h3>
        {!folderPath && (
          <p className="settings-hint">{t("git.needFolder")}</p>
        )}
        {folderPath && !gitStatus?.isRepo && (
          <p className="settings-hint">{t("git.notARepo")}</p>
        )}
        {folderPath && gitStatus?.isRepo && (
          <>
            <label className="settings-field">
              <span>{t("git.settingsRemoteUrl")}</span>
              <input
                type="url"
                value={remoteUrl}
                onChange={(e) => {
                  setRemoteUrl(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://github.com/user/repo.git"
                spellCheck={false}
              />
            </label>
            {gitStatus.branch && (
              <p className="settings-git-meta">
                {t("git.settingsBranch", { branch: gitStatus.branch })}
              </p>
            )}
          </>
        )}
      </section>

      <section className="settings-git-block">
        <h3 className="settings-git-block-title">{t("git.settingsAuth")}</h3>
        <p className="settings-hint">{t("git.settingsAuthHint")}</p>
        {folderPath && gitStatus?.isRepo && (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={connecting || !remoteUrl.trim()}
              onClick={() => void handleConnect()}
            >
              {connecting
                ? t("git.settingsConnecting")
                : t("git.settingsConnect")}
            </button>
            <label className="settings-field settings-field--token">
              <span>{t("git.settingsToken")}</span>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => {
                  setAccessToken(e.target.value);
                  setSaved(false);
                  setConnected(false);
                }}
                placeholder={t("git.settingsTokenPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <p className="settings-hint settings-hint--compact">
              {t("git.settingsTokenHint")}
            </p>
          </>
        )}
      </section>

      {error && <p className="settings-git-error">{error}</p>}
      {saved && <p className="settings-git-saved">{t("git.settingsSaved")}</p>}
      {connected && (
        <p className="settings-git-saved">{t("git.settingsConnected")}</p>
      )}

      <button
        type="button"
        className="btn"
        disabled={saving}
        onClick={() => void handleSave()}
      >
        {saving ? t("git.settingsSaving") : t("git.settingsSave")}
      </button>
    </div>
  );
}
