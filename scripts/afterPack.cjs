const fs = require("fs");
const path = require("path");
const { rcedit } = require("rcedit");

/**
 * Embed icon + version metadata without winCodeSign (which fails on Windows
 * without Developer Mode / symlink privilege via signAndEditExecutable).
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const productName = context.packager.appInfo.productFilename;
  const version = context.packager.appInfo.version;
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");

  if (!fs.existsSync(exePath)) {
    console.warn(`[afterPack] exe not found: ${exePath}`);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn(`[afterPack] icon not found: ${iconPath}`);
    return;
  }

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": version,
    "product-version": version,
    "version-string": {
      ProductName: "GDD Editor",
      FileDescription: "GDD Editor",
      CompanyName: "GDD Editor",
      LegalCopyright: "Copyright © GDD Editor",
      OriginalFilename: `${productName}.exe`
    }
  });

  console.log(`[afterPack] embedded icon into ${exePath}`);
};
