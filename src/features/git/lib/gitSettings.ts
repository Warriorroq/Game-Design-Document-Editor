const STORAGE_KEY = "gdd-editor-git-settings";

export interface GitSettings {
  userName: string;
  userEmail: string;
}

const DEFAULTS: GitSettings = {
  userName: "",
  userEmail: "",
};

export function loadGitSettings(): GitSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GitSettings>;
    return {
      userName: typeof parsed.userName === "string" ? parsed.userName : "",
      userEmail: typeof parsed.userEmail === "string" ? parsed.userEmail : "",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveGitSettings(settings: GitSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
