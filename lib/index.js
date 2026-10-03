// src/index.ts
import { homedir } from "node:os";
import { realpath as realpath3 } from "node:fs/promises";
import { join as join3 } from "node:path";

// src/host/directories.ts
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, realpath, rmdir, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

// src/shared/paths.ts
var DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;
var SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/;
var IGNORABLE_DIRECTORY_ENTRIES = /* @__PURE__ */ new Set([
  ".DS_Store",
  ".localized",
  "Thumbs.db",
  "desktop.ini"
]);
function isIgnorableDirectoryEntry(name2) {
  return IGNORABLE_DIRECTORY_ENTRIES.has(name2) || name2.startsWith("._");
}
function normalizeFsPath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function relativeParts(target, root) {
  const path = normalizeFsPath(target);
  const base = normalizeFsPath(root);
  if (base === "" || path === base || !path.startsWith(`${base}/`)) return void 0;
  return path.slice(base.length + 1).split("/");
}
function isManagedDateDirectoryPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 1 && DATE_DIRECTORY.test(parts[0] ?? "");
}
function isManagedSessionPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 2 && DATE_DIRECTORY.test(parts[0] ?? "") && SESSION_DIRECTORY.test(parts[1] ?? "");
}

// src/host/directories.ts
function topicDirectoryName(title, untitled = "Untitled", suffix = "") {
  const clean = (value) => value.replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, "_").trim().replace(/[. ]+$/, "");
  let name2 = clean(title) || clean(untitled) || "Untitled";
  if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name2)) name2 = "_" + name2;
  let truncated = "";
  let bytes = 0;
  const budget = 240 - Buffer.byteLength(suffix, "utf8");
  for (const character of name2) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > budget) break;
    truncated += character;
    bytes += size;
  }
  return (truncated.replace(/[. ]+$/, "") || "Untitled") + suffix;
}
async function createTopicDirectory(root, title, untitled = "Untitled", now = /* @__PURE__ */ new Date()) {
  if (!isAbsolute(root)) throw new Error("projectless session root must be an absolute path");
  const dateDirectory = join(root, localDateName(now));
  await mkdir(dateDirectory, { recursive: true, mode: 448 });
  const canonicalRoot = await realpath(root);
  if (await realpath(dateDirectory) !== join(canonicalRoot, localDateName(now))) {
    throw new Error("date directory is not a projectless session directory");
  }
  for (let number = 1; ; number++) {
    const candidate = join(dateDirectory, topicDirectoryName(title, untitled, number === 1 ? "" : `_${number}`));
    try {
      await mkdir(candidate, { mode: 448 });
      return candidate;
    } catch (error) {
      if (!isErrno(error, "EEXIST")) throw error;
    }
  }
}
function localDateName(now) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function sessionDirectoryName(now, suffix) {
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `session-${hour}-${minute}-${second}-${suffix}`;
}
function randomSuffix() {
  return randomBytes(4).toString("hex");
}
async function createProjectlessDirectory(root, now = /* @__PURE__ */ new Date(), suffix = randomSuffix()) {
  if (!isAbsolute(root)) throw new Error("projectless session root must be an absolute path");
  const dateDirectory = join(root, localDateName(now));
  await mkdir(dateDirectory, { recursive: true, mode: 448 });
  const sessionDirectory = join(dateDirectory, sessionDirectoryName(now, suffix));
  await mkdir(sessionDirectory, { mode: 448 });
  return sessionDirectory;
}
function isErrno(reason, code) {
  return typeof reason === "object" && reason !== null && "code" in reason && reason.code === code;
}
async function resolveProjectlessRoot(root) {
  if (!isAbsolute(root)) throw new Error("projectless session root must be an absolute path");
  try {
    return await realpath(root);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return root;
    throw reason;
  }
}
function isOwnedSessionPath(target, root, resolvedRoot, owned) {
  if (isManagedSessionPath(target, root) || isManagedSessionPath(target, resolvedRoot)) return true;
  return owned.has(target) && (isManagedDateDirectoryPath(dirname(target), root) || isManagedDateDirectoryPath(dirname(target), resolvedRoot));
}
function isOwnedDatePath(target, root, resolvedRoot) {
  return isManagedDateDirectoryPath(target, root) || isManagedDateDirectoryPath(target, resolvedRoot);
}
async function unlinkIgnorableFiles(directory, names) {
  for (const name2 of names) {
    const target = join(directory, name2);
    try {
      const info = await lstat(target);
      if (!info.isFile()) return false;
      await unlink(target);
    } catch (reason) {
      if (isErrno(reason, "ENOENT")) continue;
      return false;
    }
  }
  return true;
}
async function removeEmptyDirectory(path) {
  let entries;
  try {
    entries = await readdir(path);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    throw reason;
  }
  const junk = entries.filter(isIgnorableDirectoryEntry);
  if (junk.length !== entries.length) return "retained";
  if (junk.length > 0 && !await unlinkIgnorableFiles(path, junk)) return "retained";
  try {
    await rmdir(path);
    return "removed";
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    if (isErrno(reason, "ENOTEMPTY") || isErrno(reason, "EEXIST")) return "retained";
    throw reason;
  }
}
async function removeUnusedProjectlessDirectory(root, requestedPath, owned = /* @__PURE__ */ new Map()) {
  if (!isAbsolute(root) || !isAbsolute(requestedPath)) {
    throw new Error("projectless session path must be an absolute path");
  }
  const resolvedRoot = await resolveProjectlessRoot(root);
  if (!isOwnedSessionPath(requestedPath, root, resolvedRoot, owned)) {
    throw new Error("path is not a projectless session directory");
  }
  let canonical;
  try {
    canonical = await realpath(requestedPath);
  } catch (reason) {
    if (isErrno(reason, "ENOENT")) return "absent";
    throw reason;
  }
  if (!isOwnedSessionPath(canonical, root, resolvedRoot, owned)) {
    throw new Error("path is not a projectless session directory");
  }
  const recorded = owned.get(requestedPath);
  if (recorded !== void 0 && recorded !== canonical) {
    throw new Error("path is not a projectless session directory");
  }
  if (recorded === void 0 && !isManagedSessionPath(canonical, root) && !isManagedSessionPath(canonical, resolvedRoot)) {
    throw new Error("path is not a projectless session directory");
  }
  const result = await removeEmptyDirectory(canonical);
  if (result !== "removed") return result;
  const parent = dirname(canonical);
  if (isOwnedDatePath(parent, root, resolvedRoot)) {
    await removeEmptyDirectory(parent);
  }
  return "removed";
}

// src/shared/rpc.ts
var PROJECTLESS_RPC_CHANNEL = "/api";
var PROJECTLESS_RPC_PREFIX = "projectless-session";
var PROJECTLESS_ENDPOINTS = ["create-directory", "get-root", "remove-directory", "log-event", "prepare-title", "bind-title", "save-root"];
function projectlessEndpoint(endpoint) {
  return `${PROJECTLESS_RPC_PREFIX}/${endpoint}`;
}

// src/host/diagnostics.ts
import { appendFile, mkdir as mkdir2 } from "node:fs/promises";
import { dirname as dirname2 } from "node:path";
function createDiagnosticLogger(file, enabled, onError = () => {
}) {
  let writes = Promise.resolve();
  let failed = false;
  let sequence = 0;
  const emit = (event, fields = {}) => {
    if (!enabled || failed) return;
    const line = JSON.stringify({ time: (/* @__PURE__ */ new Date()).toISOString(), sequence: ++sequence, event, ...fields }) + "\n";
    writes = writes.then(async () => {
      if (failed) return;
      await mkdir2(dirname2(file), { recursive: true });
      await appendFile(file, line, { encoding: "utf8", mode: 384 });
    }).catch((error) => {
      failed = true;
      try {
        onError(error);
      } catch {
      }
    });
  };
  return { emit, flush: () => writes };
}

// src/shared/diagnostics.ts
var DIAGNOSTIC_EVENTS = [
  "rpc.started",
  "rpc.finished",
  "rpc.failed",
  "directory.created",
  "directory.removed",
  "directory.retained",
  "session.creation.started",
  "workspace.registered",
  "session.created",
  "session.opened",
  "session.creation.failed",
  "session.rollback.failed",
  "title.preparation.started",
  "title.preparation.finished",
  "prompt.accepted",
  "prompt.rejected",
  "prompt.unknown",
  "workspace.detached",
  "workspace.detach.failed",
  "session.abandoned",
  "diagnostics.enabled",
  "client.failed"
];
var noDiagnostics = () => {
};
function diagnosticPayload(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const payload = value;
  if (!DIAGNOSTIC_EVENTS.includes(payload.event)) return void 0;
  if (typeof payload.fields !== "object" || payload.fields === null) return void 0;
  const input = payload.fields;
  const fields = {};
  for (const key of ["rpcId", "sessionId", "workspaceId", "path", "endpoint", "code"]) {
    if (input[key] === void 0) continue;
    if (typeof input[key] !== "string" || input[key].length > 4096) return void 0;
    fields[key] = input[key];
  }
  return { event: payload.event, fields };
}
function diagnosticErrorCode(error) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 80);
  }
  return error instanceof Error ? error.name : "UnknownError";
}

// src/host/settings.ts
import { mkdir as mkdir3, readFile, realpath as realpath2, rename, unlink as unlink2, writeFile } from "node:fs/promises";
import { dirname as dirname3, isAbsolute as isAbsolute2, join as join2, resolve } from "node:path";
import { randomUUID } from "node:crypto";
function createRootSettings(initialRoot, file) {
  let root = initialRoot;
  const roots = /* @__PURE__ */ new Set([initialRoot]);
  const ready = readFile(file, "utf8").then((text) => {
    const saved = JSON.parse(text);
    if (typeof saved.root !== "string" || !isAbsolute2(saved.root)) throw new Error("Invalid saved projectless root");
    root = saved.root;
    roots.add(root);
  }).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  let saving = Promise.resolve();
  return {
    async get() {
      await ready;
      return root;
    },
    async accepts(candidate) {
      await ready;
      if (!isAbsolute2(candidate)) return false;
      const canonical = await realpath2(candidate).catch(() => resolve(candidate));
      for (const known of roots) {
        if (canonical === await realpath2(known).catch(() => resolve(known))) return true;
      }
      return false;
    },
    save(candidate) {
      const operation = saving.then(async () => {
        await ready;
        if (!isAbsolute2(candidate)) throw new Error("projectless session root must be an absolute path");
        await mkdir3(candidate, { recursive: true });
        const canonical = await realpath2(candidate);
        const probe = join2(canonical, `.projectless-write-${randomUUID()}`);
        try {
          await writeFile(probe, "", { flag: "wx" });
        } finally {
          await unlink2(probe).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
        await mkdir3(dirname3(file), { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify({ root: canonical }) + "\n", { flag: "wx" });
          await rename(temporary, file);
        } finally {
          await unlink2(temporary).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
        root = canonical;
        roots.add(root);
        return root;
      });
      saving = operation.then(() => {
      }, () => {
      });
      return operation;
    }
  };
}

// src/index.ts
var name = "dsh-projectless-session";
var inject = ["connection", "sessionTitle"];
function createProjectlessRuntime(diagnostics = noDiagnostics, enabled = false) {
  return { ownedDirectories: /* @__PURE__ */ new Map(), directoryRoots: /* @__PURE__ */ new Map(), diagnostics, diagnosticsEnabled: enabled };
}
function pathPayload(payload) {
  if (typeof payload !== "object" || payload === null) return void 0;
  const path = payload.path;
  return typeof path === "string" ? path : void 0;
}
function badRequest(message) {
  return {
    ok: false,
    error: {
      code: "bad-request",
      message,
      details: { issues: [] }
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "internal",
      message,
      details: {}
    }
  };
}
async function dispatchProjectlessEndpoint(root, endpoint, payload, runtime = createProjectlessRuntime()) {
  try {
    const configuredRoot = root;
    root = await runtime.settings?.get() ?? root;
    if (endpoint === "save-root") {
      const candidate = pathPayload(payload);
      if (candidate === void 0) return badRequest("save-root requires { path }");
      if (runtime.settings === void 0) return internalError("Root settings are unavailable");
      return { ok: true, value: { root: await runtime.settings.save(candidate) } };
    }
    if (endpoint === "prepare-title" || endpoint === "bind-title") {
      if (runtime.nativeTitle === void 0) return internalError("Install the DSH 0.2.0-rc.2 native projectless bridge before using this build");
      const input = typeof payload === "object" && payload !== null ? payload : {};
      if (typeof input.sessionId !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(input.sessionId)) return badRequest("Invalid final Session identity");
      if (endpoint === "bind-title") {
        if (typeof input.token !== "string" || input.token.length > 100) return badRequest("Invalid prepared title token");
        runtime.nativeTitle.bindProjectlessTitle(input.sessionId, input.token);
        return { ok: true, value: { bound: true } };
      }
      if (typeof input.text !== "string" || input.text.length > 1e6) return badRequest("Invalid title input");
      const route = input.route;
      if (route === void 0 || typeof route.provider !== "string" || typeof route.model !== "string") return badRequest("A selected native model is required");
      return { ok: true, value: await runtime.nativeTitle.prepareProjectlessTitle(input.text, {
        provider: route.provider,
        model: route.model
      }, input.sessionId, AbortSignal.timeout(6e4)) };
    }
    if (endpoint === "create-directory") {
      const input = typeof payload === "object" && payload !== null ? payload : {};
      if (input.root !== void 0) {
        if (typeof input.root !== "string" || !(runtime.settings === void 0 ? input.root === configuredRoot || input.root === await resolveProjectlessRoot(configuredRoot) : await runtime.settings.accepts(input.root))) {
          return badRequest("Unknown projectless root");
        }
        root = input.root;
      }
      if (input.title !== void 0 && (typeof input.title !== "string" || input.title.length > 4096)) {
        return badRequest("create-directory title must be a string of at most 4096 characters");
      }
      if (input.untitled !== void 0 && (typeof input.untitled !== "string" || input.untitled.length > 256)) {
        return badRequest("create-directory untitled must be a string of at most 256 characters");
      }
      const path2 = typeof input.title === "string" ? await createTopicDirectory(root, input.title, input.untitled) : await createProjectlessDirectory(root);
      const canonical2 = await realpath3(path2);
      runtime.ownedDirectories.set(path2, canonical2);
      runtime.ownedDirectories.set(canonical2, canonical2);
      runtime.directoryRoots.set(canonical2, root);
      runtime.diagnostics("directory.created", { path: path2 });
      return { ok: true, value: { path: path2 } };
    }
    if (endpoint === "get-root") {
      return { ok: true, value: { root: await resolveProjectlessRoot(root), diagnosticsEnabled: runtime.diagnosticsEnabled, nativeReady: runtime.nativeTitle !== void 0 } };
    }
    if (endpoint === "log-event") {
      const record = diagnosticPayload(payload);
      if (record === void 0) return badRequest("log-event requires a supported event and metadata fields");
      runtime.diagnostics(record.event, record.fields);
      return { ok: true, value: { accepted: runtime.diagnosticsEnabled } };
    }
    const path = pathPayload(payload);
    if (path === void 0) return badRequest("remove-directory requires { path }");
    const canonical = await realpath3(path).catch(() => path);
    const result = await removeUnusedProjectlessDirectory(runtime.directoryRoots.get(canonical) ?? root, path, runtime.ownedDirectories);
    runtime.diagnostics(result === "retained" ? "directory.retained" : "directory.removed", { path });
    if (result !== "retained") {
      runtime.ownedDirectories.delete(path);
      runtime.ownedDirectories.delete(canonical);
      runtime.directoryRoots.delete(canonical);
    }
    return { ok: true, value: { result } };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    if (message.includes("absolute path") || message.includes("not a projectless")) {
      return badRequest(message);
    }
    return internalError(message);
  }
}
function envelope(rpcId, result) {
  return Response.json({ type: "server-response", rpcId, result });
}
function createProjectlessFetch(root, endpoint, runtime = createProjectlessRuntime()) {
  const method = projectlessEndpoint(endpoint);
  return async (request) => {
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      return new Response("content type must be application/json", { status: 415 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("body is not JSON", { status: 400 });
    }
    const message = body;
    if (typeof message !== "object" || message === null || message.type !== "client-request" || typeof message.rpcId !== "string") {
      return new Response("invalid client-request envelope", { status: 400 });
    }
    if (message.method !== method) {
      return envelope(message.rpcId, badRequest(`method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(method)}`));
    }
    const fields = { rpcId: message.rpcId, endpoint };
    if (endpoint !== "log-event") runtime.diagnostics("rpc.started", fields);
    const result = await dispatchProjectlessEndpoint(root, endpoint, message.payload, runtime);
    if (endpoint !== "log-event") {
      runtime.diagnostics(result.ok ? "rpc.finished" : "rpc.failed", {
        ...fields,
        ...result.ok ? {} : { code: result.error.code }
      });
    }
    return envelope(message.rpcId, result);
  };
}
function apply(ctx, config = {}) {
  const root = config.root ?? join3(homedir(), "Documents", "DSH");
  const logger = createDiagnosticLogger(join3(root, ".projectless-session.log"), config.debug === true, (error) => {
    console.warn(`${name}: diagnostic logging disabled (${diagnosticErrorCode(error)})`);
  });
  const runtime = createProjectlessRuntime(logger.emit, config.debug === true);
  runtime.settings = createRootSettings(root, join3(process.env.DSH_HOME ?? join3(homedir(), ".dsh"), "storages", "projectless-session-settings.json"));
  const title = ctx.sessionTitle;
  if (typeof title?.prepareProjectlessTitle === "function") runtime.nativeTitle = title;
  logger.emit("diagnostics.enabled");
  ctx.effect(() => () => logger.flush(), "dsh-projectless-session: flush diagnostics");
  for (const endpoint of PROJECTLESS_ENDPOINTS) {
    const path = `${PROJECTLESS_RPC_CHANNEL}/${projectlessEndpoint(endpoint)}`;
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: createProjectlessFetch(root, endpoint, runtime)
    }), `dsh-projectless-session: ${path}`);
  }
}
export {
  apply,
  createProjectlessFetch,
  createProjectlessRuntime,
  dispatchProjectlessEndpoint,
  inject,
  name
};
//# sourceMappingURL=index.js.map
