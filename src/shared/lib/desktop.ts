export const isDesktopApp =
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { gddDesktop?: { isDesktop?: boolean } }).gddDesktop
      ?.isDesktop
  );

export const isWindowsDesktopApp =
  isDesktopApp && window.gddDesktop?.platform === "win32";

/** Ask the main process to take OS-level window focus (needed on Windows). */
export function ensureDesktopWindowActive() {
  if (!isDesktopApp) return;
  void window.gddDesktop?.window?.focus?.();
}

function wakeRendererFocus() {
  window.blur();
  window.focus();
}

function focusPrimaryField() {
  if (document.querySelector(".link-dialog-backdrop")) return;

  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active !== document.body &&
    !active.closest(
      ".markdown-preview--editable, .global-search-input, .section-title-input, .section-desc-input"
    )
  ) {
    active.blur();
  }

  document
    .querySelector<HTMLElement>(
      ".markdown-preview--editable, .editor-empty .btn, .global-search-input"
    )
    ?.focus();
}

/** Restore renderer focus after a native Electron dialog (or similar) stole it. */
export function restoreAppFocus() {
  const run = () => {
    ensureDesktopWindowActive();
    wakeRendererFocus();
    focusPrimaryField();
  };

  run();
  requestAnimationFrame(run);
}

/** Ensure keyboard input works in the desktop shell (especially on Windows). */
export function initDesktopFocus() {
  if (!isDesktopApp) return;

  const activate = () => {
    ensureDesktopWindowActive();
  };

  // On Windows, document.hasFocus() can lie — always sync native focus on interaction.
  document.addEventListener("pointerdown", activate, true);
  document.addEventListener("keydown", activate, true);

  const onReady = window.gddDesktop?.window?.onReady;
  if (onReady) {
    onReady(() => {
      for (const delay of [0, 100, 300]) {
        window.setTimeout(() => {
          ensureDesktopWindowActive();
          wakeRendererFocus();
        }, delay);
      }
    });
  }

  for (const delay of [50, 200, 500]) {
    window.setTimeout(() => {
      ensureDesktopWindowActive();
      wakeRendererFocus();
    }, delay);
  }
}
