const { execFile } = require("child_process");

function hwndNumber(win) {
  const handle = win.getNativeWindowHandle();
  if (handle.length >= 8) {
    return handle.readBigInt64LE(0).toString();
  }
  return handle.readUInt32LE(0).toString();
}

function focusBrowserWindow(win) {
  if (win.isDestroyed()) return;
  if (!win.isVisible()) win.show();
  win.moveTop();
  win.focus();
  win.webContents.focus();
}

/**
 * Windows blocks SetForegroundWindow unless the process already owns foreground.
 * Use the ALT-key unlock trick, then refocus the BrowserWindow.
 */
function forceForegroundWindow(win) {
  if (win.isDestroyed()) return;
  focusBrowserWindow(win);

  if (process.platform !== "win32") return;

  const hwnd = hwndNumber(win);
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class GddWinFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
$h = [IntPtr]${hwnd}
[void][GddWinFocus]::BringWindowToTop($h)
[void][GddWinFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[void][GddWinFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
[void][GddWinFocus]::SetForegroundWindow($h)
`;

  execFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true },
    () => {
      focusBrowserWindow(win);
    }
  );
}

module.exports = { focusBrowserWindow, forceForegroundWindow };
