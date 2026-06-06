const { execFile, execFileSync, spawn } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execFileAsync = promisify(execFile);

const GITIGNORE = [
  "# GDD Editor project",
  ".DS_Store",
  "Thumbs.db",
  "",
].join("\n");

let cachedGitPath = null;

function gitPathCandidates() {
  const candidates = [];
  if (process.env.GDD_GIT_PATH) {
    candidates.push(process.env.GDD_GIT_PATH);
  }
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const localAppData = process.env.LOCALAPPDATA || "";
    candidates.push(
      path.join(programFiles, "Git", "cmd", "git.exe"),
      path.join(programFiles, "Git", "bin", "git.exe"),
      path.join(localAppData, "Programs", "Git", "cmd", "git.exe")
    );
  }
  candidates.push("git");
  return candidates;
}

function resolveGitPath() {
  if (cachedGitPath) return cachedGitPath;

  for (const candidate of gitPathCandidates()) {
    if (candidate !== "git") {
      if (fs.existsSync(candidate)) {
        cachedGitPath = candidate;
        return cachedGitPath;
      }
      continue;
    }
    try {
      execFileSync("git", ["--version"], {
        env: gitEnv(),
        windowsHide: true,
        stdio: "ignore",
      });
      cachedGitPath = "git";
      return cachedGitPath;
    } catch {
      // try next candidate
    }
  }

  cachedGitPath = "git";
  return cachedGitPath;
}

function gitInstallDirs() {
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const localAppData = process.env.LOCALAPPDATA || "";
  return [
    path.join(programFiles, "Git", "cmd"),
    path.join(programFiles, "Git", "bin"),
    path.join(programFiles, "Git", "mingw64", "bin"),
    path.join(localAppData, "Programs", "Git", "cmd"),
    path.join(localAppData, "Programs", "Git", "mingw64", "bin"),
  ];
}

function gitEnv(network = false) {
  const env = { ...process.env };
  if (network) {
    // Prefer Git Credential Manager UI over terminal prompts in Electron.
    env.GIT_TERMINAL_PROMPT = "0";
    env.GCM_INTERACTIVE = "Always";
    env.GIT_PROGRESS_DELAY = "0";
  }
  if (process.platform !== "win32") return env;

  const extra = gitInstallDirs().filter((dir) => fs.existsSync(dir));
  if (extra.length) {
    env.PATH = `${extra.join(path.delimiter)}${path.delimiter}${env.PATH || ""}`;
  }
  return env;
}

function networkProcessOptions(extra = {}) {
  return {
    env: gitEnv(true),
    // GCM login dialogs fail when the Git child process is hidden on Windows.
    windowsHide: process.platform !== "win32",
    ...extra,
  };
}

function normalizeGitError(message) {
  const text = message || "";
  if (
    /authentication failed|could not read Username|invalid credentials|Permission denied \(publickey\)|HTTP 401|HTTP 403|access denied|repository not found/i.test(
      text
    )
  ) {
    return "auth_failed";
  }
  if (
    /could not resolve host|unable to access|Connection timed out|Failed to connect|network is unreachable/i.test(
      text
    )
  ) {
    return "network_failed";
  }
  if (/Not possible to fast-forward|Cannot fast-forward/i.test(text)) {
    return "ff_only_failed";
  }
  if (/no upstream|set-upstream|has no upstream|no tracking/i.test(text)) {
    return "no_upstream";
  }
  return text;
}

function emitProgress(onProgress, phase, line) {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (!onProgress || !trimmed) return;
  onProgress({ phase, line: trimmed });
}

function isUntrackedOverwriteError(error) {
  return /untracked working tree files would be overwritten/i.test(String(error));
}

function isUnrelatedHistoriesError(error) {
  return /refusing to merge unrelated histories/i.test(String(error));
}

function isFfOnlyError(error) {
  return /Not possible to fast-forward|Cannot fast-forward|ff-only/i.test(
    String(error)
  );
}

function isMergeConflictError(error) {
  return /CONFLICT|Automatic merge failed/i.test(String(error));
}

function pullArgs(branchName, hasTracking, options = {}) {
  const {
    ffOnly = true,
    allowUnrelated = false,
    preferRemote = false,
  } = options;
  const args = ["pull", "--progress"];
  if (ffOnly) args.push("--ff-only");
  if (allowUnrelated) args.push("--allow-unrelated-histories");
  if (preferRemote) args.push("-X", "theirs");
  if (!hasTracking) {
    args.push("origin", branchName);
  }
  return args;
}

async function resolveMergeConflictsPreferRemote(dir, onProgress) {
  emitProgress(onProgress, "pull", "Resolving conflicts (keeping remote files)…");

  const status = await runGit(dir, ["status", "--porcelain"]);
  if (!status.ok) return { ok: false, error: status.error };

  const conflictFiles = status.stdout
    .split("\n")
    .filter((line) => /^(AA|UU|DU|UD|AU|UA)/.test(line))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  for (const file of conflictFiles) {
    const checkout = await runGit(dir, ["checkout", "--theirs", "--", file]);
    if (!checkout.ok) {
      return { ok: false, error: checkout.error };
    }
  }

  const add = await runGit(dir, ["add", "-A"]);
  if (!add.ok) return { ok: false, error: add.error };

  await ensureGitIdentity(dir);
  const commitResult = await runGit(dir, [
    "commit",
    "-m",
    "GDD Editor: merge remote project",
  ]);
  if (!commitResult.ok) {
    return { ok: false, error: commitResult.error };
  }

  return { ok: true };
}

async function stageAndCommitLocal(dir, message, onProgress) {
  emitProgress(onProgress, "pull", "Staging local project files…");
  const add = await runGit(dir, ["add", "-A"]);
  if (!add.ok) return { ok: false, error: add.error };

  await ensureGitIdentity(dir);

  const status = await runGit(dir, ["status", "--porcelain"]);
  if (!status.ok) return { ok: false, error: status.error };
  if (!status.stdout.trim()) {
    return { ok: true, committed: false };
  }

  const commitResult = await runGit(dir, ["commit", "-m", message]);
  if (!commitResult.ok) {
    if (/nothing to commit/i.test(commitResult.error)) {
      return { ok: true, committed: false };
    }
    return { ok: false, error: commitResult.error };
  }

  return { ok: true, committed: true };
}

async function runGit(cwd, args, network = false) {
  const gitPath = resolveGitPath();
  const options = network
    ? networkProcessOptions({ cwd, maxBuffer: 10 * 1024 * 1024 })
    : { cwd, env: gitEnv(false), maxBuffer: 10 * 1024 * 1024, windowsHide: true };

  try {
    const { stdout, stderr } = await execFileAsync(gitPath, args, options);
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const message =
      (typeof err.stderr === "string" && err.stderr.trim()) ||
      (typeof err.message === "string" && err.message) ||
      "Git command failed";
    return { ok: false, error: normalizeGitError(message) };
  }
}

function gcmExecutableCandidates() {
  const names = ["git-credential-manager.exe", "git-credential-manager-core.exe"];
  const paths = [];
  for (const dir of gitInstallDirs()) {
    for (const name of names) {
      paths.push(path.join(dir, name));
    }
  }
  return paths;
}

function credentialHostFromUrl(url) {
  const text = String(url || "");
  if (/github\.com/i.test(text)) return "github";
  if (/gitlab\.com/i.test(text)) return "gitlab";
  if (/bitbucket\.org/i.test(text)) return "bitbucket";
  return null;
}

function hostFromRemoteUrl(url) {
  const text = String(url || "").trim();
  const sshMatch = text.match(/^git@([^:]+):/i);
  if (sshMatch) return sshMatch[1];
  try {
    return new URL(text).hostname || null;
  } catch {
    return null;
  }
}

async function runGcmLogin(host) {
  if (!host) return { ok: false, error: "unknown_host" };

  for (const gcmPath of gcmExecutableCandidates()) {
    if (!fs.existsSync(gcmPath)) continue;
    try {
      await execFileAsync(gcmPath, [host, "login"], {
        ...networkProcessOptions({ timeout: 300000 }),
      });
      return { ok: true };
    } catch {
      // try next binary
    }
  }

  const gitPath = resolveGitPath();
  try {
    await execFileAsync(
      gitPath,
      ["credential-manager", host, "login"],
      networkProcessOptions({ timeout: 300000 })
    );
    return { ok: true };
  } catch (err) {
    const message =
      (typeof err.stderr === "string" && err.stderr.trim()) ||
      (typeof err.message === "string" && err.message) ||
      "Git Credential Manager login failed";
    return { ok: false, error: normalizeGitError(message) };
  }
}

function approveHttpsCredential(host, token) {
  const trimmed = String(token || "").trim();
  if (!host || !trimmed) {
    return Promise.resolve({ ok: false, error: "missing_token" });
  }

  const input = `protocol=https\nhost=${host}\nusername=oauth2\npassword=${trimmed}\n\n`;

  return new Promise((resolve) => {
    const gitPath = resolveGitPath();
    const child = spawn(gitPath, ["credential", "approve"], {
      ...networkProcessOptions({ stdio: ["pipe", "ignore", "pipe"] }),
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      resolve({
        ok: false,
        error: normalizeGitError(err.message || "credential approve failed"),
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({
        ok: false,
        error: normalizeGitError(stderr.trim() || "credential approve failed"),
      });
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

async function storeAccessToken(dir, token) {
  const remote = await getRemoteUrl(dir);
  if (!remote.ok || !remote.url) {
    return { ok: false, error: "no_remote" };
  }

  const host = hostFromRemoteUrl(remote.url);
  if (!host) {
    return { ok: false, error: "invalid_url" };
  }

  if (/^git@/i.test(remote.url) || /^ssh:/i.test(remote.url)) {
    return { ok: false, error: "token_https_only" };
  }

  const stored = await approveHttpsCredential(host, token);
  if (!stored.ok) return stored;

  const probe = await runGit(dir, ["ls-remote", "--heads", remote.url], true);
  if (probe.ok) return { ok: true };
  return { ok: false, error: probe.error || "auth_failed" };
}

async function authenticateRemote(dir) {
  if (!isGitRepo(dir)) {
    return { ok: false, error: "not_a_repo" };
  }

  const remote = await getRemoteUrl(dir);
  if (!remote.ok || !remote.url) {
    return { ok: false, error: "no_remote" };
  }

  const url = remote.url;
  if (/^git@/i.test(url) || /^ssh:/i.test(url)) {
    const probe = await runGit(dir, ["ls-remote", "--heads", url], true);
    if (probe.ok) return { ok: true };
    return { ok: false, error: probe.error };
  }

  const host = credentialHostFromUrl(url);
  if (host) {
    const login = await runGcmLogin(host);
    if (login.ok) {
      const probe = await runGit(dir, ["ls-remote", "--heads", url], true);
      if (probe.ok) return { ok: true };
      return { ok: false, error: probe.error };
    }
  }

  const probe = await runGit(dir, ["ls-remote", "--heads", url], true);
  if (probe.ok) return { ok: true };
  return { ok: false, error: probe.error };
}

function runGitStream(cwd, args, onProgress, phase) {
  return new Promise((resolve) => {
    const gitPath = resolveGitPath();
    const child = spawn(gitPath, args, {
      cwd,
      ...networkProcessOptions(),
    });

    let stdout = "";
    let stderr = "";

    const handleChunk = (stream, chunk) => {
      const text = chunk.toString();
      if (stream === "stdout") stdout += text;
      else stderr += text;

      for (const line of text.split(/\r|\n/)) {
        emitProgress(onProgress, phase, line);
      }
    };

    child.stdout.on("data", (chunk) => handleChunk("stdout", chunk));
    child.stderr.on("data", (chunk) => handleChunk("stderr", chunk));

    child.on("error", (err) => {
      resolve({
        ok: false,
        error: normalizeGitError(err.message || "Git process failed"),
      });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      const message = stderr.trim() || stdout.trim() || `Git exited with code ${code}`;
      resolve({ ok: false, error: normalizeGitError(message) });
    });
  });
}

async function isGitAvailable() {
  const result = await runGit(os.homedir(), ["--version"]);
  return result.ok;
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

async function getIdentity(dir) {
  const name = await runGit(dir, ["config", "--get", "user.name"]);
  const email = await runGit(dir, ["config", "--get", "user.email"]);
  return {
    ok: true,
    name: name.ok && name.stdout ? name.stdout : "",
    email: email.ok && email.stdout ? email.stdout : "",
  };
}

async function setIdentity(dir, name, email) {
  if (!isGitRepo(dir)) {
    return { ok: false, error: "not_a_repo" };
  }

  const trimmedName = (name || "").trim();
  const trimmedEmail = (email || "").trim();
  if (!trimmedName || !trimmedEmail) {
    return { ok: false, error: "missing_identity" };
  }

  const nameResult = await runGit(dir, ["config", "user.name", trimmedName]);
  if (!nameResult.ok) return { ok: false, error: nameResult.error };

  const emailResult = await runGit(dir, ["config", "user.email", trimmedEmail]);
  if (!emailResult.ok) return { ok: false, error: emailResult.error };

  return { ok: true };
}

async function ensureGitIdentity(dir, identity) {
  if (identity?.name && identity?.email) {
    return setIdentity(dir, identity.name, identity.email);
  }

  const current = await getIdentity(dir);
  if (current.name && current.email) {
    return { ok: true };
  }

  return { ok: false, error: "missing_identity" };
}

async function getStatus(dir) {
  if (!isGitRepo(dir)) {
    return { isRepo: false };
  }

  const result = await runGit(dir, ["status", "--porcelain=v1", "-b"]);
  if (!result.ok) {
    return { isRepo: true, error: result.error };
  }

  const lines = result.stdout.split("\n").filter(Boolean);
  let branch = "HEAD";
  let ahead = 0;
  let behind = 0;
  let tracking = null;
  const files = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const header = line.slice(3);
      const branchPart = header.split("...")[0];
      branch = branchPart || branch;

      const trackingMatch = header.match(/\.\.\.([^ \[]+)/);
      if (trackingMatch) tracking = trackingMatch[1];

      const aheadMatch = header.match(/ahead (\d+)/);
      const behindMatch = header.match(/behind (\d+)/);
      if (aheadMatch) ahead = Number(aheadMatch[1]);
      if (behindMatch) behind = Number(behindMatch[1]);
      continue;
    }
    files.push({
      path: line.slice(3),
      status: line.slice(0, 2).trim(),
    });
  }

  return {
    isRepo: true,
    branch,
    tracking,
    ahead,
    behind,
    dirty: files.length > 0,
    files,
  };
}

async function initRepo(dir) {
  if (isGitRepo(dir)) {
    return { ok: true, alreadyInitialized: true };
  }

  let init = await runGit(dir, ["init", "-b", "main"]);
  if (!init.ok) {
    init = await runGit(dir, ["init"]);
  }
  if (!init.ok) return { ok: false, error: init.error };

  const gitignorePath = path.join(dir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE, "utf8");
  }

  return { ok: true, alreadyInitialized: false };
}

async function commit(dir, message, identity) {
  const add = await runGit(dir, ["add", "-A"]);
  if (!add.ok) return { ok: false, error: add.error };

  const identityResult = await ensureGitIdentity(dir, identity);
  if (!identityResult.ok) return identityResult;

  const commitResult = await runGit(dir, ["commit", "-m", message]);
  if (!commitResult.ok) {
    if (/nothing to commit/i.test(commitResult.error)) {
      return { ok: false, error: "nothing_to_commit" };
    }
    return { ok: false, error: commitResult.error };
  }

  return { ok: true };
}

async function currentBranch(dir) {
  const result = await runGit(dir, ["branch", "--show-current"]);
  if (result.ok && result.stdout) return result.stdout;
  return "main";
}

async function hasRemote(dir) {
  const result = await runGit(dir, ["remote"]);
  return result.ok && Boolean(result.stdout.trim());
}

const PROJECT_PATHS = ["gdd.json", ".gitignore", "sections", "assets"];

async function syncProjectFromRemote(dir, branchName, onProgress) {
  const remoteRef = `origin/${branchName}`;

  const fetch = await runGit(dir, ["fetch", "origin"], true);
  if (!fetch.ok) return fetch;

  const verify = await runGit(dir, ["rev-parse", "--verify", remoteRef]);
  if (!verify.ok) {
    return { ok: false, error: "remote_branch_not_found" };
  }

  emitProgress(onProgress, "pull", "Restoring project files from remote…");

  const list = await runGit(dir, [
    "ls-tree",
    "-r",
    "--name-only",
    remoteRef,
    "--",
    ...PROJECT_PATHS,
  ]);
  if (!list.ok) return list;

  const remoteFiles = list.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (remoteFiles.length > 0) {
    let restore = await runGit(dir, [
      "restore",
      "--source",
      remoteRef,
      "--worktree",
      "--staged",
      "--",
      ...remoteFiles,
    ]);

    if (!restore.ok) {
      restore = await runGit(dir, ["checkout", remoteRef, "--", ...remoteFiles]);
    }
    if (!restore.ok) return restore;
  }

  const remoteSet = new Set(remoteFiles);
  for (const sub of ["sections", "assets"]) {
    const localDir = path.join(dir, sub);
    if (!fs.existsSync(localDir)) continue;

    for (const name of fs.readdirSync(localDir)) {
      const rel = `${sub}/${name}`;
      if (remoteSet.has(rel)) continue;
      const filePath = path.join(localDir, name);
      if (!fs.statSync(filePath).isFile()) continue;
      try {
        fs.unlinkSync(filePath);
        emitProgress(onProgress, "pull", `Removed local-only file: ${rel}`);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  return { ok: true };
}

async function push(dir, onProgress) {
  if (!(await hasRemote(dir))) {
    return { ok: false, error: "no_remote" };
  }

  const branchName = await currentBranch(dir);
  const status = await getStatus(dir);
  const hasTracking = Boolean(status.tracking);

  emitProgress(onProgress, "push", "Connecting to remote…");

  const args = hasTracking
    ? ["push", "--progress"]
    : ["push", "--progress", "-u", "origin", branchName];

  if (!hasTracking) {
    emitProgress(
      onProgress,
      "push",
      `Publishing branch ${branchName} to origin…`
    );
  }

  const result = await runGitStream(dir, args, onProgress, "push");

  if (result.ok) {
    emitProgress(onProgress, "push", "Push completed.");
  }

  return result;
}

async function pull(dir, onProgress) {
  if (!(await hasRemote(dir))) {
    return { ok: false, error: "no_remote" };
  }

  const branchName = await currentBranch(dir);
  const status = await getStatus(dir);
  const hasTracking = Boolean(status.tracking);

  emitProgress(onProgress, "pull", "Fetching from remote…");

  if (!hasTracking) {
    emitProgress(onProgress, "pull", `Pulling origin/${branchName}…`);
  }

  let result = await runGitStream(
    dir,
    pullArgs(branchName, hasTracking, { ffOnly: true }),
    onProgress,
    "pull"
  );

  if (!result.ok && isUntrackedOverwriteError(result.error)) {
    emitProgress(
      onProgress,
      "pull",
      "Local files conflict with remote — saving local snapshot…"
    );
    const saved = await stageAndCommitLocal(
      dir,
      "GDD Editor: local snapshot before pull",
      onProgress
    );
    if (!saved.ok) return saved;

    emitProgress(onProgress, "pull", "Retrying pull with merge…");
    result = await runGitStream(
      dir,
      pullArgs(branchName, hasTracking, { ffOnly: false, preferRemote: true }),
      onProgress,
      "pull"
    );
  }

  if (!result.ok && isUnrelatedHistoriesError(result.error)) {
    emitProgress(onProgress, "pull", "Merging unrelated histories…");
    result = await runGitStream(
      dir,
      pullArgs(branchName, hasTracking, {
        ffOnly: false,
        allowUnrelated: true,
        preferRemote: true,
      }),
      onProgress,
      "pull"
    );
  }

  if (!result.ok && isFfOnlyError(result.error)) {
    emitProgress(onProgress, "pull", "Fast-forward not possible, merging…");
    result = await runGitStream(
      dir,
      pullArgs(branchName, hasTracking, { ffOnly: false, preferRemote: true }),
      onProgress,
      "pull"
    );
  }

  if (!result.ok && isMergeConflictError(result.error)) {
    const resolved = await resolveMergeConflictsPreferRemote(dir, onProgress);
    if (resolved.ok) {
      result = { ok: true };
    }
  }

  if (result.ok && !hasTracking) {
    await runGit(dir, ["branch", "--set-upstream-to", `origin/${branchName}`]);
  }

  if (result.ok) {
    const sync = await syncProjectFromRemote(dir, branchName, onProgress);
    if (!sync.ok) return sync;
    emitProgress(onProgress, "pull", "Pull completed.");
  }

  return result;
}

async function getRemoteUrl(dir) {
  const result = await runGit(dir, ["remote", "get-url", "origin"]);
  if (!result.ok) return { ok: false, url: null };
  return { ok: true, url: result.stdout || null };
}

async function setRemoteUrl(dir, url) {
  if (!isGitRepo(dir)) {
    return { ok: false, error: "not_a_repo" };
  }

  const existing = await runGit(dir, ["remote", "get-url", "origin"]);
  const args = existing.ok
    ? ["remote", "set-url", "origin", url]
    : ["remote", "add", "origin", url];

  const result = await runGit(dir, args);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

module.exports = {
  isGitAvailable,
  isGitRepo,
  getStatus,
  getIdentity,
  setIdentity,
  initRepo,
  commit,
  push,
  pull,
  getRemoteUrl,
  setRemoteUrl,
  authenticateRemote,
  storeAccessToken,
};
