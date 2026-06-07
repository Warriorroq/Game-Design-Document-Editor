import { isDesktopApp } from "./desktop";
import type { MessageKey } from "./i18n/messages";
import { loadGitSettings, type GitSettings } from "./gitSettings";

export interface GitFileStatus {
  path: string;
  status: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  tracking?: string | null;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  files?: GitFileStatus[];
  error?: string;
}

export interface GitProgressEvent {
  phase: "push" | "pull";
  line: string;
}

function requireGitApi() {
  if (!isDesktopApp || !window.gddDesktop?.git) {
    throw new Error("Git is only available in the desktop app.");
  }
  return window.gddDesktop.git;
}

export async function isGitAvailable(): Promise<boolean> {
  if (!isDesktopApp || !window.gddDesktop?.git) return false;
  return window.gddDesktop.git.isAvailable();
}

export async function getGitStatus(folderPath: string): Promise<GitStatus> {
  const api = requireGitApi();
  return api.status(folderPath);
}

export async function initGitRepo(
  folderPath: string
): Promise<{ ok: boolean; alreadyInitialized?: boolean; error?: string }> {
  const api = requireGitApi();
  return api.init(folderPath);
}

export function gitIdentityForCommit(
  settings: GitSettings = loadGitSettings()
): { name: string; email: string } | null {
  const name = settings.userName.trim();
  const email = settings.userEmail.trim();
  if (!name || !email) return null;
  return { name, email };
}

export async function getGitIdentity(
  folderPath: string
): Promise<{ name: string; email: string }> {
  const api = requireGitApi();
  const result = await api.getIdentity(folderPath);
  return {
    name: result.name ?? "",
    email: result.email ?? "",
  };
}

export async function setGitIdentity(
  folderPath: string,
  name: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return api.setIdentity(folderPath, name, email);
}

export async function applyGitIdentity(
  folderPath: string,
  settings: GitSettings = loadGitSettings()
): Promise<{ ok: boolean; error?: string }> {
  const identity = gitIdentityForCommit(settings);
  if (!identity) return { ok: false, error: "missing_identity" };
  return setGitIdentity(folderPath, identity.name, identity.email);
}

export async function commitGitChanges(
  folderPath: string,
  message: string,
  settings: GitSettings = loadGitSettings()
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  const identity = gitIdentityForCommit(settings);
  return api.commit(folderPath, message, identity ?? undefined);
}

async function withGitProgress<T>(
  operation: () => Promise<T>,
  onProgress?: (event: GitProgressEvent) => void
): Promise<T> {
  const api = window.gddDesktop?.git;
  const unsubscribe =
    onProgress && api?.onProgress
      ? api.onProgress((payload) => {
          if (payload?.line) {
            onProgress(payload as GitProgressEvent);
          }
        })
      : undefined;

  try {
    return await operation();
  } finally {
    unsubscribe?.();
  }
}

export async function pushGitChanges(
  folderPath: string,
  onProgress?: (event: GitProgressEvent) => void
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return withGitProgress(() => api.push(folderPath), onProgress);
}

export async function pullGitChanges(
  folderPath: string,
  onProgress?: (event: GitProgressEvent) => void
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return withGitProgress(() => api.pull(folderPath), onProgress);
}

export async function stashGitChanges(
  folderPath: string
): Promise<{ ok: boolean; stashed?: boolean; error?: string }> {
  const api = requireGitApi();
  return api.stash(folderPath);
}

export async function discardGitProjectChanges(
  folderPath: string
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return api.discardProject(folderPath);
}

export async function getGitRemote(
  folderPath: string
): Promise<string | null> {
  const api = requireGitApi();
  const result = await api.getRemote(folderPath);
  return result.ok ? result.url ?? null : null;
}

export async function setGitRemote(
  folderPath: string,
  url: string
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return api.setRemote(folderPath, url);
}

export async function authenticateGitRemote(
  folderPath: string
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return api.authenticate(folderPath);
}

export async function storeGitAccessToken(
  folderPath: string,
  token: string
): Promise<{ ok: boolean; error?: string }> {
  const api = requireGitApi();
  return api.storeToken(folderPath, token);
}

const GIT_ERROR_KEYS: Record<string, MessageKey> = {
  nothing_to_commit: "git.nothingToCommit",
  missing_identity: "git.missingIdentity",
  no_remote: "git.noRemote",
  auth_failed: "git.authFailed",
  missing_token: "git.missingToken",
  token_https_only: "git.tokenHttpsOnly",
  network_failed: "git.networkFailed",
  ff_only_failed: "git.ffOnlyFailed",
  push_rejected_pull_first: "git.pushRejectedPullFirst",
  no_initial_commit: "git.noInitialCommit",
  not_a_repo: "git.notARepo",
  remote_branch_not_found: "git.remoteBranchNotFound",
};

export function formatGitError(
  code: string | undefined,
  t: (key: MessageKey) => string
): string {
  if (!code) return t("git.errorGeneric");
  const key = GIT_ERROR_KEYS[code];
  if (key) return t(key);
  return code;
}
