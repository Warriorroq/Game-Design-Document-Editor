const fs = require("fs");
const path = require("path");

const MANIFEST_FILE = "gdd.json";
const SECTIONS_DIR = "sections";
const ASSETS_DIR = "assets";
const LEGACY_FILE = "project.gde";

function manifestPath(dir) {
  return path.join(dir, MANIFEST_FILE);
}

function hasProjectFile(dir) {
  return (
    fs.existsSync(manifestPath(dir)) || fs.existsSync(path.join(dir, LEGACY_FILE))
  );
}

function readBinaryFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

function readLegacyProject(dir) {
  const filePath = path.join(dir, LEGACY_FILE);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "project_not_found" };
  }
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return { ok: true, legacy: true, content };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "read_failed",
    };
  }
}

function readProjectFolder(dir) {
  if (!fs.existsSync(manifestPath(dir))) {
    return readLegacyProject(dir);
  }

  try {
    const manifest = fs.readFileSync(manifestPath(dir), "utf8");
    const sections = [];
    const assets = [];

    const sectionsDir = path.join(dir, SECTIONS_DIR);
    if (fs.existsSync(sectionsDir)) {
      for (const name of fs.readdirSync(sectionsDir)) {
        if (!name.endsWith(".json")) continue;
        const filePath = path.join(sectionsDir, name);
        const content = fs.readFileSync(filePath, "utf8");
        const id = name.replace(/\.json$/, "");
        sections.push({
          id,
          path: `${SECTIONS_DIR}/${name}`,
          content,
        });
      }
    }

    const assetsDir = path.join(dir, ASSETS_DIR);
    if (fs.existsSync(assetsDir)) {
      for (const name of fs.readdirSync(assetsDir)) {
        const filePath = path.join(assetsDir, name);
        if (!fs.statSync(filePath).isFile()) continue;
        assets.push({
          path: `${ASSETS_DIR}/${name}`,
          mime: mimeFromPath(filePath),
          dataBase64: readBinaryFile(filePath),
        });
      }
    }

    return {
      ok: true,
      legacy: false,
      payload: { manifest, sections, assets },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "read_failed",
    };
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeBinaryFile(filePath, dataBase64) {
  const buffer = Buffer.from(dataBase64, "base64");
  fs.writeFileSync(filePath, buffer);
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs
    .readdirSync(dirPath)
    .filter((name) => fs.statSync(path.join(dirPath, name)).isFile());
}

function cleanupDir(dirPath, keepNames) {
  if (!fs.existsSync(dirPath)) return;
  const keep = new Set(keepNames);
  for (const name of fs.readdirSync(dirPath)) {
    const filePath = path.join(dirPath, name);
    if (!fs.statSync(filePath).isFile()) continue;
    if (!keep.has(name)) {
      fs.unlinkSync(filePath);
    }
  }
}

function writeProjectFolder(dir, payload) {
  if (!payload || typeof payload.manifest !== "string") {
    return { ok: false, error: "invalid_payload" };
  }

  try {
    ensureDir(dir);
    ensureDir(path.join(dir, SECTIONS_DIR));
    ensureDir(path.join(dir, ASSETS_DIR));

    fs.writeFileSync(manifestPath(dir), payload.manifest, "utf8");

    const sectionNames = [];
    for (const section of payload.sections ?? []) {
      const rel = section.path.replace(/\\/g, "/");
      const name = path.basename(rel);
      sectionNames.push(name);
      fs.writeFileSync(
        path.join(dir, SECTIONS_DIR, name),
        section.content,
        "utf8"
      );
    }

    const assetNames = [];
    for (const asset of payload.assets ?? []) {
      const rel = asset.path.replace(/\\/g, "/");
      const name = path.basename(rel);
      assetNames.push(name);
      writeBinaryFile(path.join(dir, ASSETS_DIR, name), asset.dataBase64);
    }

    cleanupDir(path.join(dir, SECTIONS_DIR), sectionNames);
    cleanupDir(path.join(dir, ASSETS_DIR), assetNames);

    const legacyPath = path.join(dir, LEGACY_FILE);
    if (fs.existsSync(legacyPath)) {
      fs.unlinkSync(legacyPath);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "write_failed",
    };
  }
}

module.exports = {
  MANIFEST_FILE,
  hasProjectFile,
  readProjectFolder,
  writeProjectFolder,
};
