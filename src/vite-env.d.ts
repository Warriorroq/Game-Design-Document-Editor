/// <reference types="vite/client" />

interface GitStatusResult {
  isRepo: boolean;
  branch?: string;
  tracking?: string | null;
  ahead?: number;
  behind?: number;
  dirty?: boolean;
  files?: { path: string; status: string }[];
  error?: string;
}

interface Window {
  gddDesktop?: {
    isDesktop: boolean;
    platform?: string;
    window?: {
      minimize: () => Promise<void>;
      toggleMaximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      focus: () => Promise<void>;
      onMaximizedChanged: (listener: (maximized: boolean) => void) => () => void;
    };
    project?: {
      pickFolder: () => Promise<{
        ok: boolean;
        canceled?: boolean;
        folderPath?: string;
        hasProject?: boolean;
      }>;
      readFolder: (folderPath: string) => Promise<{
        ok: boolean;
        legacy?: boolean;
        content?: string;
        payload?: {
          manifest: string;
          sections: { id: string; path: string; content: string }[];
          assets: { path: string; mime: string; dataBase64: string }[];
        };
        error?: string;
      }>;
      writeFolder: (
        folderPath: string,
        payload: {
          manifest: string;
          sections: { id: string; path: string; content: string }[];
          assets: { path: string; mime: string; dataBase64: string }[];
        }
      ) => Promise<{ ok: boolean; error?: string }>;
    };
    git?: {
      isAvailable: () => Promise<boolean>;
      status: (folderPath: string) => Promise<GitStatusResult>;
      init: (
        folderPath: string
      ) => Promise<{ ok: boolean; alreadyInitialized?: boolean; error?: string }>;
      commit: (
        folderPath: string,
        message: string,
        identity?: { name: string; email: string }
      ) => Promise<{ ok: boolean; error?: string }>;
      getIdentity: (
        folderPath: string
      ) => Promise<{ ok: boolean; name?: string; email?: string; error?: string }>;
      setIdentity: (
        folderPath: string,
        name: string,
        email: string
      ) => Promise<{ ok: boolean; error?: string }>;
      push: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
      pull: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
      onProgress: (
        listener: (payload: { phase: string; line: string }) => void
      ) => () => void;
      getRemote: (
        folderPath: string
      ) => Promise<{ ok: boolean; url?: string | null }>;
      setRemote: (
        folderPath: string,
        url: string
      ) => Promise<{ ok: boolean; error?: string }>;
      authenticate: (
        folderPath: string
      ) => Promise<{ ok: boolean; error?: string }>;
      storeToken: (
        folderPath: string,
        token: string
      ) => Promise<{ ok: boolean; error?: string }>;
    };
  };
}
