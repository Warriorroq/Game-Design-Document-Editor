export const isDesktopApp =
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { gddDesktop?: { isDesktop?: boolean } }).gddDesktop
      ?.isDesktop
  );

export const isWindowsDesktopApp =
  isDesktopApp && window.gddDesktop?.platform === "win32";

/** Restore renderer focus after a native Electron dialog (or similar) stole it. */
export function restoreAppFocus() {
  requestAnimationFrame(() => {
    if (document.querySelector(".link-dialog-backdrop")) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      active.blur();
    }
    void window.gddDesktop?.window?.focus?.();
    window.focus();
    document
      .querySelector<HTMLElement>(
        ".markdown-preview--editable, .editor-empty .btn"
      )
      ?.focus();
  });
}
