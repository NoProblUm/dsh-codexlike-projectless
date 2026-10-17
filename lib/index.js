// src/index.ts
import { homedir } from "node:os";
import { realpath as realpath3 } from "node:fs/promises";
import { join as join4 } from "node:path";

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
var PROJECTLESS_RPC_PREFIX = "dsh-codexlike-projectless";
var PROJECTLESS_ENDPOINTS = ["create-directory", "get-root", "remove-directory", "log-event", "prepare-title", "bind-title", "save-root", "runtime-status"];
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

// src/host/runtime.ts
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join as join3 } from "node:path";

// src/shared/runtime.ts
var ADAPTER_ID = "desktop-0.2.1-rc.2-332895e0-runtime-2";
var RUNTIME_PACKAGE_VERSION = "1.0.1";
var TARGET_BUILD = "332895e0f7c9d4dbfb29729f5eb367fa263ff986";
var RUNTIME_WRAPPER = Symbol.for("dsh-codexlike-projectless.runtime-wrapper");
var wrapperGeneration = 0;
function originalInstance(value) {
  return value?.[Symbol.for("cordis.original")] ?? value;
}
function wrapRuntimeMethod(target, key, replacement) {
  target = originalInstance(target);
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  const original = target[key];
  if (typeof original !== "function") throw new Error(`Missing runtime method: ${key}`);
  const installed = function(...args) {
    return replacement(original, this, args);
  };
  Object.defineProperty(installed, RUNTIME_WRAPPER, { value: { target, key, original, installed, generation: ++wrapperGeneration } });
  target[key] = installed;
  if (target[key] !== installed) throw new Error(`Runtime method is not writable: ${key}`);
  return () => {
    if (target[key] !== installed) return;
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else delete target[key];
  };
}

// src/host/runtime.ts
var installations = /* @__PURE__ */ new WeakMap();
function activateHostRuntime(ctx) {
  const key = originalInstance(ctx.sessionTitle);
  const existing = key && installations.get(key);
  if (existing) return existing;
  const status = { state: "checking", reason: "\u6B63\u5728\u68C0\u67E5\u5BBF\u4E3B\u517C\u5BB9\u6027", adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION, build: TARGET_BUILD, missingCapabilities: [] };
  const disposers = [];
  let active = true;
  try {
    const archive = process.argv.map((arg) => /^(.*?\.asar)(?:[/\\]|$)/i.exec(arg)?.[1]).find(Boolean);
    if (process.platform !== "win32" || !archive) throw new Error("\u4EC5\u652F\u6301\u5DF2\u9A8C\u8BC1\u7684 Windows Desktop 0.2.1-rc.2 \u6784\u5EFA");
    const manifest = JSON.parse(readFileSync(join3(archive, "package.json"), "utf8"));
    status.build = manifest.dshBuildCommit ?? "unknown";
    if (manifest.version !== "0.2.1-rc.2" || manifest.dshBuildCommit !== TARGET_BUILD || manifest.dshBuildDirty !== false) throw new Error("\u5BBF\u4E3B\u6784\u5EFA\u4E0D\u5728\u652F\u6301\u8303\u56F4\u5185");
    for (const [path, expected] of Object.entries(TARGET_MODULES)) {
      const bytes = readFileSync(join3(archive, "dsh/node_modules/@deepseek-ai", path));
      if (createHash("sha256").update(bytes).digest("hex") !== expected) throw new Error("\u5BBF\u4E3B\u6A21\u5757\u4E0D\u5339\u914D\u6216\u4ECD\u5B89\u88C5\u65E7\u5F52\u6863\u8865\u4E01\uFF1A" + path);
    }
    const service = originalInstance(ctx.sessionTitle);
    for (const key2 of ["onUserMessage", "assertServiceActive", "track", "validateResult"]) {
      if (typeof service[key2] !== "function") throw new Error("\u6807\u9898\u670D\u52A1\u7F3A\u5C11\u5FC5\u8981\u80FD\u529B\uFF1A" + key2);
    }
    const prepared = /* @__PURE__ */ new Map();
    const bound = /* @__PURE__ */ new Map();
    disposers.push(wrapRuntimeMethod(service, "onUserMessage", (original, receiver, args) => {
      const [session, event] = args;
      const item = bound.get(session.id);
      if (!item) return original.apply(receiver, args);
      bound.delete(session.id);
      Promise.resolve().then(() => {
        if (!active || !receiver.serviceActive() || receiver.ctx.sessions.get(session.id) !== session) return;
        for (const [type, data] of item.events) session.append(type, { ...data, messageSeqs: [event.seq] });
        session.append("session/title", { title: item.title, messageSeqs: [event.seq], source: item.source });
      });
    }));
    const title = {
      async prepareProjectlessTitle(text, route, sessionId, signal) {
        if (!active) throw new Error("Runtime adapter disposed");
        service.assertServiceActive();
        const events = [];
        const messages = [{ seq: 0, text }];
        let result;
        let source = { kind: "fallback" };
        const registration = service.registration;
        if (registration && !registration.closing) {
          try {
            result = await service.track(registration.provider.generate({ session: { id: sessionId, append: (type, data) => events.push([type, data]) }, messages, route, signal: AbortSignal.any([signal, service.lifetime.signal]) }), registration);
            result = service.validateResult(result, messages);
            source = { kind: "provider", provider: registration.provider.id, ...result.model ? { model: result.model } : {} };
          } catch (error) {
            signal.throwIfAborted();
            service.lifetime.signal.throwIfAborted();
            service.ctx.logger.warn("projectless title provider failed; using native fallback: " + String(error));
          }
        }
        signal.throwIfAborted();
        if (!active) throw new Error("Runtime adapter disposed");
        const { fallbackSessionTitle } = await import("@deepseek-ai/dsh-session-title");
        const textTitle = result?.title ?? (fallbackSessionTitle(text, service.config.fallbackMaxWords, service.config.fallbackMaxBytes) || "Untitled");
        const token = crypto.randomUUID();
        for (const [key2, item] of prepared) if (item.expires < Date.now()) prepared.delete(key2);
        if (prepared.size >= 64) throw new Error("Too many pending projectless titles");
        prepared.set(token, { sessionId, title: textTitle, source, events, expires: Date.now() + 3e5 });
        return { token, title: textTitle, sessionId, source: source.kind };
      },
      bindProjectlessTitle(sessionId, token) {
        const item = prepared.get(token);
        if (!active || !item || item.sessionId !== sessionId || item.expires < Date.now()) throw new Error("Prepared title expired or belongs to another Session");
        if (!service.ctx.sessions.get(sessionId)) throw new Error("Final Session does not exist");
        prepared.delete(token);
        bound.set(sessionId, item);
      }
    };
    ctx.effect(() => () => {
      active = false;
      prepared.clear();
      bound.clear();
      for (const dispose of disposers.reverse()) dispose();
      installations.delete(key);
    });
    status.state = "ready";
    status.reason = "\u5BBF\u4E3B\u8FD0\u884C\u65F6\u9002\u914D\u5DF2\u5C31\u7EEA";
    const runtime = { status, title };
    installations.set(key, runtime);
    return runtime;
  } catch (error) {
    active = false;
    for (const dispose of disposers.reverse()) dispose();
    status.state = "unsupported";
    status.reason = error instanceof Error ? error.message : String(error);
    status.missingCapabilities = [status.reason];
    return { status };
  }
}
var TARGET_MODULES = {
  "dsh-client-file-upload/lib/client.js": "4c09378ab7cb3dbe58253bd1fad8c4a00ebf5a93b462d96623edb7bd4e566305",
  "dsh-api-gateway/lib/client.browser.js": "3043de82334846a3a5654b7317830c5403f90e9aeca692d3c15e30e01d16505d",
  "dsh-api-session-controller/lib/client.js": "82f2301c18f0e51340c1eedf8ecdfb939e873b3770a80632e438b86e82887d0e",
  "dsh-api-gateway/lib/index.js": "4fbe460fec585ebc2cf2887261f6c33f024081a539d9fb5d6557a9002324b23f",
  "dsh-client-ui-conversation/lib/client.js": "843dbcd884e05d77e525bf84b9e6dce180fd49ac8486a3c75591c291f09c9afa",
  "dsh-client-ui-workspace/lib/client.js": "4dd7f3c580f2316af8172ee4dc542b10e19b030e81f9242f4696e8139260dc17",
  "dsh-session-title/lib/index.js": "eb814490ca3d0aaabf8f6ddc705a031f99a98709c484c1502c5f28f101cf0eeb"
};

// src/index.ts
var name = "dsh-codexlike-projectless";
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
async function dispatchProjectlessEndpoint(root, endpoint, payload, runtime = createProjectlessRuntime(), signal = AbortSignal.timeout(6e4)) {
  try {
    if (endpoint === "runtime-status") return { ok: true, value: runtime.status ?? { state: "unsupported", reason: "\u8FD0\u884C\u65F6\u9002\u914D\u672A\u5B89\u88C5" } };
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
      }, input.sessionId, signal) };
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
    const result = await dispatchProjectlessEndpoint(root, endpoint, message.payload, runtime, AbortSignal.any([request.signal, AbortSignal.timeout(6e4)]));
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
  const root = config.root ?? join4(homedir(), "Documents", "DSH");
  const logger = createDiagnosticLogger(join4(root, ".dsh-codexlike-projectless.log"), config.debug === true, (error) => {
    console.warn(`${name}: diagnostic logging disabled (${diagnosticErrorCode(error)})`);
  });
  const runtime = createProjectlessRuntime(logger.emit, config.debug === true);
  runtime.settings = createRootSettings(root, join4(process.env.DSH_HOME ?? join4(homedir(), ".dsh"), "storages", "dsh-codexlike-projectless-settings.json"));
  const adapter = activateHostRuntime(ctx);
  runtime.status = adapter.status;
  if (adapter.title) runtime.nativeTitle = adapter.title;
  logger.emit("diagnostics.enabled");
  ctx.effect(() => () => logger.flush(), "dsh-codexlike-projectless: flush diagnostics");
  for (const endpoint of PROJECTLESS_ENDPOINTS) {
    const path = `${PROJECTLESS_RPC_CHANNEL}/${projectlessEndpoint(endpoint)}`;
    ctx.effect(() => ctx.connection.fetch.register({
      path,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: createProjectlessFetch(root, endpoint, runtime)
    }), `dsh-codexlike-projectless: ${path}`);
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
