window.__ModuleLoader__.load({ id: "dsh-projectless-session", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  createAndSendProjectlessSession: () => createAndSendProjectlessSession,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/shared/paths.ts
var DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;
var SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/;
function normalizeFsPath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function relativeParts(target, root) {
  const path = normalizeFsPath(target);
  const base = normalizeFsPath(root);
  if (base === "" || path === base || !path.startsWith(`${base}/`)) return void 0;
  return path.slice(base.length + 1).split("/");
}
function isManagedSessionPath(target, root) {
  const parts = relativeParts(target, root);
  return parts !== void 0 && parts.length === 2 && DATE_DIRECTORY.test(parts[0] ?? "") && SESSION_DIRECTORY.test(parts[1] ?? "");
}
function isProjectlessPath(path) {
  const segments = normalizeFsPath(path).split("/").filter((segment) => segment.length > 0);
  const dateName = segments.at(-2);
  const sessionName = segments.at(-1);
  return dateName !== void 0 && sessionName !== void 0 && DATE_DIRECTORY.test(dateName) && SESSION_DIRECTORY.test(sessionName);
}

// src/shared/rpc.ts
var PROJECTLESS_RPC_CHANNEL = "/api";
var PROJECTLESS_RPC_PREFIX = "projectless-session";
function projectlessEndpoint(endpoint) {
  return `${PROJECTLESS_RPC_PREFIX}/${endpoint}`;
}

// src/shared/diagnostics.ts
var noDiagnostics = () => {
};
function diagnosticErrorCode(error) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code.slice(0, 80);
  }
  return error instanceof Error ? error.name : "UnknownError";
}

// src/client/session.ts
var MAIN_VIEW_SOURCE = "mainView";
function isCurrentSession(sessions, sessionId) {
  return (sessions.byId[sessionId]?.retainedBy?.[MAIN_VIEW_SOURCE] ?? 0) > 0;
}
function createAbandonClaim() {
  const claimed = /* @__PURE__ */ new Set();
  return {
    tryClaim(workspaceId) {
      if (claimed.has(workspaceId)) return false;
      claimed.add(workspaceId);
      return true;
    }
  };
}
var PROJECTLESS_ENTRY_ID = "::projectless-session";
function createProjectlessRegistry() {
  const ids = /* @__PURE__ */ new Set();
  return {
    remember(workspaceId) {
      ids.add(workspaceId);
    },
    has(workspaceId) {
      return ids.has(workspaceId);
    }
  };
}
function resolvePickerSelection(items, selectedId, isProjectless) {
  const projects = [];
  let projectlessActive = false;
  for (const row of items) {
    if (isProjectless(row)) {
      if (selectedId !== void 0 && row.workspaceId === selectedId) projectlessActive = true;
      continue;
    }
    projects.push(row);
  }
  return {
    projects,
    selectedId: projectlessActive ? PROJECTLESS_ENTRY_ID : selectedId,
    projectlessActive
  };
}
function rpcValue(result, label) {
  if (!result.ok) throw new Error(result.error?.message ?? `${label} failed`);
  return result.value;
}
function expectPathObject(value, key, label) {
  if (typeof value !== "object" || value === null || typeof value[key] !== "string") {
    throw new Error(`${label} returned an invalid directory response`);
  }
  return value[key];
}
async function requestProjectlessDirectory(rpc, title, untitled, root) {
  return expectPathObject(
    rpcValue(await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("create-directory"), {
      ...title === void 0 ? {} : { title },
      ...untitled === void 0 ? {} : { untitled },
      ...root === void 0 ? {} : { root }
    }), "projectless session Host"),
    "path",
    "projectless session Host"
  );
}
async function requestProjectlessRoot(rpc) {
  return (await requestProjectlessSettings(rpc)).root;
}
async function requestProjectlessSettings(rpc) {
  const value = rpcValue(await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("get-root"), {}), "projectless session Host");
  return {
    root: expectPathObject(value, "root", "projectless session Host"),
    diagnosticsEnabled: typeof value === "object" && value !== null && "diagnosticsEnabled" in value && value.diagnosticsEnabled === true
  };
}
async function requestRemoveProjectlessDirectory(rpc, path) {
  rpcValue(await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("remove-directory"), { path }), "projectless session Host");
}
async function abandonUnusedProjectlessWorkspace(workspaces, target, removeDirectory, onError = console.error, diagnostics = noDiagnostics) {
  for (const sessionId of target.sessionIds) {
    await workspaces.archiveSession(sessionId).catch(onError);
  }
  try {
    await workspaces.delete(target.workspaceId);
  } catch (error) {
    diagnostics("session.rollback.failed", { workspaceId: target.workspaceId, code: diagnosticErrorCode(error) });
    onError(error);
    return;
  }
  await removeDirectory(target.path).catch(onError);
  diagnostics("session.abandoned", { workspaceId: target.workspaceId, path: target.path });
}
function isAbandonedProjectlessWorkspace(workspace, sessions, root, skip = /* @__PURE__ */ new Set()) {
  if (skip.has(workspace.workspaceId) || !isManagedSessionPath(workspace.path, root)) return false;
  if (workspace.sessionIds.length === 0) return false;
  for (const sessionId of workspace.sessionIds) {
    if (isCurrentSession(sessions, sessionId)) return false;
    const row = sessions.byId[sessionId];
    if (row === void 0 || row.blank !== true) return false;
  }
  return true;
}
function findAbandonedProjectlessWorkspaces(workspaces, sessions, root, skip = /* @__PURE__ */ new Set()) {
  return workspaces.filter((workspace) => isAbandonedProjectlessWorkspace(workspace, sessions, root, skip)).map((workspace) => ({
    workspaceId: workspace.workspaceId,
    path: workspace.path,
    sessionIds: workspace.sessionIds
  }));
}
function sweepAbandonedProjectlessWorkspaces(workspaces, sessions, root, removeDirectory, skip, claim, onError = console.error, diagnostics = noDiagnostics) {
  let active = true;
  const reconcile = () => {
    if (!active) return;
    const workspaceState = workspaces.list.getSnapshot();
    if (workspaceState.phase === "pending") return;
    for (const leftover of findAbandonedProjectlessWorkspaces(
      workspaceState.items,
      sessions.list.getSnapshot(),
      root,
      skip
    )) {
      if (!claim.tryClaim(leftover.workspaceId)) continue;
      void abandonUnusedProjectlessWorkspace(workspaces, leftover, removeDirectory, onError, diagnostics);
    }
  };
  const unsubscribeWorkspaces = workspaces.list.subscribe(reconcile);
  const unsubscribeSessions = sessions.list.subscribe(reconcile);
  reconcile();
  return () => {
    active = false;
    unsubscribeWorkspaces();
    unsubscribeSessions();
  };
}

// src/client/locales.ts
var PROJECTLESS_LOCALE_NS = "projectless-session";
var zh = {
  "picker.projectless": "\u65E0\u9879\u76EE",
  "entry.new": "\u5207\u6362\u81F3\u65E0\u9879\u76EE",
  "settings.title": "\u65E0\u9879\u76EE\u4F1A\u8BDD",
  "settings.root": "\u5DE5\u4F5C\u533A\u6839\u76EE\u5F55",
  "settings.browse": "\u6D4F\u89C8\u2026",
  "settings.save": "\u4FDD\u5B58",
  "settings.active": "\u5F53\u524D\u751F\u6548\u8DEF\u5F84",
  "settings.saved": "\u5DF2\u4FDD\u5B58\uFF0C\u4E4B\u540E\u9996\u6B21\u53D1\u9001\u7684\u65B0\u4F1A\u8BDD\u4F7F\u7528\u6B64\u8DEF\u5F84\u3002",
  "picker.addWorkspace": "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026",
  "modal.createFailed": "\u65E0\u6CD5\u521B\u5EFA\u65E0\u5DE5\u4F5C\u533A\u4F1A\u8BDD",
  "modal.close": "\u77E5\u9053\u4E86"
};
var en = {
  "picker.projectless": "No project",
  "entry.new": "Switch to no project",
  "settings.title": "Projectless sessions",
  "settings.root": "Workspace root directory",
  "settings.browse": "Browse\u2026",
  "settings.save": "Save",
  "settings.active": "Active directory",
  "settings.saved": "Saved. New sessions use this directory on first send.",
  "picker.addWorkspace": "Add workspace\u2026",
  "modal.createFailed": "Could not create session without workspace",
  "modal.close": "Got it"
};
var projectlessLocales = {
  zh,
  en
};

// src/client/first-prompt.ts
async function createAndSendProjectlessSession(host, sessions, input, services, registry, pending, diagnostics = noDiagnostics) {
  diagnostics("title.preparation.started");
  const title = await services.prepareTitle(input);
  diagnostics("title.preparation.finished");
  const path = await services.provisionDirectory(title.title);
  let workspace;
  try {
    workspace = await host.create({ path });
  } catch (error) {
    await services.removeDirectory(path).catch(services.onError);
    throw error;
  }
  registry.remember(workspace.workspaceId);
  pending.add(workspace.workspaceId);
  diagnostics("workspace.registered", { workspaceId: workspace.workspaceId, path });
  let receipt;
  let sending = false;
  let protectPending = false;
  try {
    const sessionId = services.createSession === void 0 ? await host.connectWorkspace(workspace.workspaceId) : await services.createSession(workspace.workspaceId, title);
    receipt = { sessionId, workspaceId: workspace.workspaceId, path };
    diagnostics("session.created", { sessionId, workspaceId: workspace.workspaceId, path });
    await services.bindPreparedTitle(sessionId, title);
    sending = true;
    const acceptance = await services.send(sessionId, input);
    diagnostics(`prompt.${acceptance}`, { sessionId, workspaceId: workspace.workspaceId });
    if (acceptance === "unknown") {
      protectPending = true;
      return { receipt, acceptance };
    }
    if (acceptance === "rejected") {
      await abandonUnusedProjectlessWorkspace(host, {
        ...receipt,
        sessionIds: [sessionId]
      }, services.removeDirectory, services.onError, diagnostics);
      return { receipt, acceptance };
    }
    try {
      await host.delete(workspace.workspaceId);
      diagnostics("workspace.detached", { sessionId, workspaceId: workspace.workspaceId });
    } catch (error) {
      diagnostics("workspace.detach.failed", { sessionId, workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) });
      services.onError(error);
    }
    try {
      if (services.isCurrentTarget()) {
        sessions.open(sessionId);
        diagnostics("session.opened", { sessionId, workspaceId: workspace.workspaceId });
      }
    } catch (error) {
      diagnostics("client.failed", { sessionId, code: diagnosticErrorCode(error) });
      services.onError(error);
    }
    return { receipt, acceptance };
  } catch (error) {
    if (sending && receipt !== void 0) {
      diagnostics("prompt.unknown", { sessionId: receipt.sessionId, workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) });
      protectPending = true;
      services.onError(error);
      return { receipt, acceptance: "unknown" };
    }
    diagnostics("session.creation.failed", { workspaceId: workspace.workspaceId, code: diagnosticErrorCode(error) });
    await abandonUnusedProjectlessWorkspace(host, {
      workspaceId: workspace.workspaceId,
      path,
      sessionIds: receipt === void 0 ? [] : [receipt.sessionId]
    }, services.removeDirectory, services.onError, diagnostics);
    throw error;
  } finally {
    if (!protectPending) pending.delete(workspace.workspaceId);
  }
}

// src/client/selection.ts
var SELECTION_KEY = "dsh-projectless-session.selected-workspace";
function decodeSelection(value) {
  if (value === null) return { kind: "unset" };
  if (value === "") return { kind: "projectless" };
  try {
    const saved = JSON.parse(value);
    if (saved.kind === "projectless") return saved;
    if (saved.kind === "project" && typeof saved.workspaceId === "string") return saved;
  } catch {
  }
  return { kind: "project", workspaceId: value };
}
function createDraftCache() {
  const latest = /* @__PURE__ */ new Map();
  return {
    remember(key, id) {
      latest.set(key, id);
    },
    find(key) {
      return latest.get(key);
    },
    remove(id) {
      for (const [key, value] of latest) if (value === id) latest.delete(key);
    }
  };
}

// src/client/draft.ts
function installProjectlessDrafts(ctx, host, pending, diagnostics, onError) {
  const sessions = ctx.sessions;
  if (typeof sessions.createProjectlessDraft !== "function") {
    throw new Error("This local build requires the DSH 0.2.0-rc.2 native bridge. Run the supplied native installer first.");
  }
  const conversation = ctx.conversation;
  const rpc = ctx.connection.rpc;
  const drafts = /* @__PURE__ */ new Map();
  const registry = createProjectlessRegistry();
  const cache = createDraftCache();
  const held = /* @__PURE__ */ new Map();
  const projectlessSessions = /* @__PURE__ */ new Set();
  let disposed = false;
  let initialized = false;
  let starting;
  let selection;
  try {
    selection = decodeSelection(localStorage.getItem(SELECTION_KEY));
  } catch {
    selection = { kind: "unset" };
  }
  const readSelection = () => {
    return selection.kind === "project" ? selection.workspaceId : void 0;
  };
  const select = (workspaceId) => {
    selection = workspaceId === void 0 ? { kind: "projectless" } : { kind: "project", workspaceId };
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(selection));
    } catch {
    }
  };
  const keyOf = (workspaceId) => workspaceId ?? "::projectless-session";
  const currentId = () => {
    const snapshot = sessions.list.getSnapshot();
    return snapshot.ids.find((id) => isCurrentSession(snapshot, id));
  };
  const workspaceOf = (id) => ctx.workspaces.list.getSnapshot().items.find((item) => item.sessionIds.includes(id))?.workspaceId;
  const isProjectlessSession = (id) => drafts.has(id) || projectlessSessions.has(id) || sessions.list.getSnapshot().byId[id] !== void 0 && ctx.workspaces.list.getSnapshot().phase === "ready" && workspaceOf(id) === void 0;
  const rememberBlank = (id, workspaceId) => {
    cache.remember(keyOf(workspaceId), id);
    if (!held.has(id)) held.set(id, sessions.retain(id, { source: "controllerOperation" }));
  };
  const nativeCall = async (namespace, method, ...args) => {
    const remote = ctx.remote;
    const action = remote[namespace]?.[method];
    if (action === void 0) throw new Error(`Native ${namespace}/${method} is unavailable`);
    const result = await action(...args);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    return result.value;
  };
  const pluginCall = async (endpoint, payload) => {
    const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint(endpoint), payload);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const start = () => {
    if (starting !== void 0) return starting;
    starting = (async () => {
      const catalog = await nativeCall("session", "modelCatalog");
      const presets = await nativeCall("agentPresets", "list");
      const permissions = await nativeCall("permissionPresets", "catalog");
      if (disposed) throw new Error("Projectless plugin unloaded");
      const preset = presets.presets.find((item) => item.isDefault)?.id;
      const draft = {
        model: catalog.default,
        permission: permissions.defaultPreset,
        ...preset === void 0 ? {} : { preset },
        plan: false,
        busy: false,
        uncertain: false
      };
      const id = sessions.createProjectlessDraft({
        modelSelection: { next: draft.model },
        permissions: { currentValue: draft.permission },
        agentPreset: preset,
        plan: { active: false },
        inbox: { "next-turn": [] }
      });
      drafts.set(id, draft);
      projectlessSessions.add(id);
      rememberBlank(id);
      select();
      ctx.uiWorkspace.openSession(id);
      return id;
    })().finally(() => {
      starting = void 0;
    });
    return starting;
  };
  const openEditor = (workspaceId, fresh = false) => {
    const previous = currentId();
    if (previous !== void 0 && sessions.list.getSnapshot().byId[previous]?.blank) {
      rememberBlank(previous, isProjectlessSession(previous) ? void 0 : workspaceOf(previous));
    }
    const target = fresh ? void 0 : cache.find(keyOf(workspaceId));
    if (target !== void 0 && sessions.list.getSnapshot().byId[target]?.blank) {
      select(workspaceId);
      ctx.uiWorkspace.openSession(target);
      return Promise.resolve(target);
    }
    if (workspaceId === void 0) return start();
    return sessions.create({ workspaceId }).then((id) => {
      if (disposed) throw new Error("Projectless plugin unloaded");
      rememberBlank(id, workspaceId);
      select(workspaceId);
      ctx.uiWorkspace.openSession(id);
      return id;
    });
  };
  const switchProjectless = () => {
    const id = currentId();
    return openEditor(void 0, id !== void 0 && sessions.list.getSnapshot().byId[id]?.blank === false);
  };
  ctx.on("projectless/select-workspace", (workspaceId) => openEditor(workspaceId).then(() => {
  }));
  ctx.on("projectless/new-session", (workspaceId, currentSessionId) => {
    const id = currentSessionId ?? currentId();
    const inherited = id === void 0 ? readSelection() : isProjectlessSession(id) ? void 0 : workspaceOf(id);
    const selected = workspaceId ?? inherited;
    const target = selected !== void 0 && ctx.workspaces.list.getSnapshot().items.some((item) => item.workspaceId === selected) ? selected : void 0;
    void openEditor(target, true).catch(onError);
    return true;
  });
  ctx.on("projectless/draft-rpc", (endpoint, args) => {
    const input = args[0];
    const id = typeof input === "string" ? input : typeof input === "object" && input !== null ? input.sessionId : void 0;
    const draft = id === void 0 ? void 0 : drafts.get(id);
    if (draft === void 0 || id === void 0) return void 0;
    const success = (value) => Promise.resolve({ ok: true, value });
    if (endpoint === "commands/list") return success([
      { name: "permission", description: "\u9009\u62E9\u6743\u9650\u6A21\u5F0F", input: { hint: "\u6743\u9650\u6A21\u5F0F" } },
      { name: "plan", description: "\u5207\u6362\u89C4\u5212\u6A21\u5F0F" }
    ]);
    if (endpoint === "session/selectModel") {
      const model = input;
      draft.model = {
        provider: model.provider,
        model: model.model,
        ...model.reasoningEffort === void 0 ? {} : { reasoningEffort: model.reasoningEffort }
      };
      sessions.updateProjectlessDraft(id, "modelSelection", { next: draft.model });
      return success({});
    }
    if (endpoint === "agentPresets/select") {
      draft.preset = String(args[1]);
      sessions.updateProjectlessDraft(id, "agentPreset", draft.preset);
      return success(draft.preset);
    }
    if (endpoint === "commands/execute") {
      const line = String(args[1]);
      const permission = /^\/permission\s+(\S+)\s*$/.exec(line)?.[1];
      if (permission !== void 0) {
        draft.permission = permission;
        sessions.updateProjectlessDraft(id, "permissions", { currentValue: permission });
        return success({ commandId: `draft-${crypto.randomUUID()}`, result: { kind: "success" } });
      }
      if (/^\/plan(?:\s+(?:on|off))?\s*$/.test(line)) {
        draft.plan = line.endsWith(" off") ? false : line.endsWith(" on") ? true : !draft.plan;
        sessions.updateProjectlessDraft(id, "plan", { active: draft.plan });
        return success({ commandId: `draft-${crypto.randomUUID()}`, result: { kind: "success" } });
      }
    }
    return Promise.resolve({ ok: false, error: {
      code: "projectless/draft-only",
      message: "\u6B64\u64CD\u4F5C\u9700\u8981\u5DF2\u521B\u5EFA\u7684\u4F1A\u8BDD\u3002\u5148\u53D1\u9001\u9996\u6761\u6D88\u606F\uFF0C\u518D\u4F7F\u7528\u8BE5\u547D\u4EE4\u3002",
      details: {}
    } });
  });
  ctx.on("projectless/first-send", (session, text, attachments, mode, signal) => {
    const draft = drafts.get(session.sessionId);
    if (draft === void 0) return void 0;
    if (draft.busy || draft.uncertain) return Promise.resolve({ kind: "error", text: "\u9996\u6B21\u53D1\u9001\u4ECD\u5728\u5904\u7406\u6216\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u52FF\u91CD\u590D\u53D1\u9001\u3002" });
    const choice = { ...draft, model: { ...draft.model } };
    draft.busy = true;
    conversation.blocks.set(session.sessionId, { reason: "\u6B63\u5728\u751F\u6210\u4E3B\u9898\u5E76\u521B\u5EFA\u4F1A\u8BDD\u2026" });
    const reference = sessions.retain(session.sessionId, { source: "controllerOperation" });
    return (async () => {
      try {
        const root = await requestProjectlessRoot(rpc);
        const result = await createAndSendProjectlessSession(host, {
          list: sessions.list,
          open: (id) => ctx.uiWorkspace.openSession(id)
        }, { text, attachments, mode, signal }, {
          prepareTitle: async (input) => {
            signal.throwIfAborted();
            return pluginCall("prepare-title", {
              text: input.text || "\u9644\u4EF6\u5206\u6790",
              route: choice.model,
              sessionId: crypto.randomUUID()
            });
          },
          provisionDirectory: (title) => requestProjectlessDirectory(rpc, title, void 0, root),
          createSession: async (workspaceId, title) => {
            projectlessSessions.add(title.sessionId);
            return sessions.create({ workspaceId, sessionId: title.sessionId });
          },
          bindPreparedTitle: async (id, title) => {
            signal.throwIfAborted();
            await pluginCall("bind-title", { sessionId: id, token: title.token });
            if (choice.preset !== void 0) await nativeCall("agentPresets", "select", id, choice.preset);
            await nativeCall("session", "selectModel", { sessionId: id, ...choice.model });
            await sessions.using(id, { source: "controllerOperation" }, async (reference2) => {
              const binding = await reference2.ready;
              const permission = await binding.session.command(`/permission ${choice.permission}`);
              if (!permission.ok) throw new Error(permission.error.message);
              if (choice.plan) {
                const plan = await binding.session.command("/plan on");
                if (!plan.ok) throw new Error(plan.error.message);
              }
            });
          },
          send: async (id, input) => sessions.using(id, { source: "controllerOperation" }, async (reference2) => {
            const binding = await reference2.ready;
            const outcome = await conversation.sendSession(binding.session, input.text, input.attachments, input.mode, input.signal);
            if (outcome.kind === "success") return "accepted";
            if (outcome.remoteError?.code.startsWith("carrier/") || outcome.remoteError?.code.includes("cancel")) return "unknown";
            return "rejected";
          }),
          removeDirectory: (path) => requestRemoveProjectlessDirectory(rpc, path).then(() => {
          }),
          isCurrentTarget: () => isCurrentSession(sessions.list.getSnapshot(), session.sessionId),
          onError
        }, registry, pending, diagnostics);
        if (result.acceptance === "unknown") {
          draft.uncertain = true;
          draft.receipt = result.receipt;
          conversation.input.for(reference.binding.ctx).notify("error", `\u53D1\u9001\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\u3002\u8BF7\u67E5\u770B\u4F1A\u8BDD ${result.receipt.sessionId}\uFF0C\u4E0D\u8981\u91CD\u590D\u53D1\u9001\u3002`);
          reconcile();
          return { kind: "success" };
        }
        if (result.acceptance === "accepted") releaseDraft(session.sessionId);
        return result.acceptance === "accepted" ? { kind: "success" } : { kind: "error" };
      } catch (error) {
        onError(error);
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      } finally {
        draft.busy = false;
        if (!draft.uncertain) conversation.blocks.set(session.sessionId, void 0);
        reference.release();
      }
    })();
  });
  const releaseDraft = (id) => {
    cache.remove(id);
    const reference = held.get(id);
    held.delete(id);
    reference?.release();
    if (drafts.delete(id)) sessions.discardProjectlessDraft(id);
  };
  const reconcile = () => {
    for (const [id, draft] of drafts) {
      const receipt = draft.receipt;
      if (!draft.uncertain || receipt === void 0 || sessions.list.getSnapshot().byId[receipt.sessionId]?.blank !== false) continue;
      delete draft.receipt;
      void host.delete(receipt.workspaceId).then(() => pending.delete(receipt.workspaceId)).catch(onError).finally(() => {
        draft.uncertain = false;
        conversation.blocks.set(id, void 0);
        if (isCurrentSession(sessions.list.getSnapshot(), id)) ctx.uiWorkspace.openSession(receipt.sessionId);
        releaseDraft(id);
      });
    }
  };
  let observing = false;
  const observe = () => {
    if (observing || disposed || !initialized || sessions.list.getSnapshot().phase !== "ready" || ctx.workspaces.list.getSnapshot().phase !== "ready") return;
    observing = true;
    try {
      reconcile();
      for (const id2 of held.keys()) {
        if (!drafts.has(id2) && sessions.list.getSnapshot().byId[id2]?.blank === false) releaseDraft(id2);
      }
      const id = currentId();
      if (id !== void 0) {
        const workspaceId = isProjectlessSession(id) ? void 0 : workspaceOf(id);
        if (workspaceId === void 0 || !pending.has(workspaceId)) select(workspaceId);
        if (sessions.list.getSnapshot().byId[id]?.blank) rememberBlank(id, workspaceId);
      } else if (readSelection() !== void 0 && !ctx.workspaces.list.getSnapshot().items.some((item) => item.workspaceId === readSelection())) select();
    } finally {
      observing = false;
    }
  };
  ctx.effect(() => {
    const offSessions = sessions.list.subscribe(observe);
    const offWorkspaces = ctx.workspaces.list.subscribe(observe);
    return () => {
      offSessions();
      offWorkspaces();
    };
  }, "projectless: follow selection and retain browser drafts");
  ctx.effect(() => {
    const initialize = () => {
      if (initialized || sessions.list.getSnapshot().phase !== "ready" || ctx.workspaces.list.getSnapshot().phase !== "ready") return;
      initialized = true;
      const current = currentId();
      if (current === void 0 || sessions.list.getSnapshot().byId[current]?.blank) {
        const selected = readSelection();
        const target = selected !== void 0 && ctx.workspaces.list.getSnapshot().items.some((item) => item.workspaceId === selected) ? selected : void 0;
        void openEditor(target, true).catch(onError);
      } else observe();
    };
    const offSessions = sessions.list.subscribe(initialize);
    const offWorkspaces = ctx.workspaces.list.subscribe(initialize);
    initialize();
    return () => {
      offSessions();
      offWorkspaces();
    };
  }, "projectless: restore the empty project choice");
  ctx.effect(() => () => {
    disposed = true;
    for (const reference of held.values()) reference.release();
    held.clear();
    for (const id of drafts.keys()) sessions.discardProjectlessDraft(id);
  }, "projectless: draft lifetime");
  return { start: switchProjectless, select, switchWorkspace: (id) => openEditor(id).then(() => {
  }), isProjectlessSession };
}

// src/client/settings.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime = require("react/jsx-runtime");
function ProjectlessSettings({ rpc, browse, t }) {
  const [path, setPath] = (0, import_react.useState)("");
  const [active, setActive] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)("");
  const [saved, setSaved] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    let mounted = true;
    void requestProjectlessRoot(rpc).then((root) => {
      if (mounted) {
        setPath(root);
        setActive(root);
      }
    }).catch((reason) => {
      if (mounted) setError(String(reason));
    }).finally(() => {
      if (mounted) setBusy(false);
    });
    return () => {
      mounted = false;
    };
  }, [rpc]);
  const run = async (operation) => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "dsh-projectless-settings", "aria-label": t("settings.title"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: t("settings.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: "projectless-root", children: t("settings.root") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-projectless-settings-controls", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { id: "projectless-root", value: path, disabled: busy, onChange: (event) => {
        setPath(event.target.value);
        setSaved(false);
      } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { disabled: busy, onClick: () => {
        void run(async () => {
          const chosen = await browse();
          if (chosen !== null) setPath(chosen);
        });
      }, children: t("settings.browse") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { disabled: busy || path.trim() === "", onClick: () => {
        void run(async () => {
          const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("save-root"), { path: path.trim() });
          if (!result.ok) throw new Error(result.error.message);
          const root = result.value.root;
          setActive(root);
          setPath(root);
          setSaved(true);
        });
      }, children: t("settings.save") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("small", { children: [
      t("settings.active"),
      "\uFF1A",
      active
    ] }),
    saved && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { role: "status", children: t("settings.saved") }),
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { role: "alert", className: "dsh-projectless-session-error", children: error })
  ] });
}

// src/client/index.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var PACKAGE_ID = "dsh-projectless-session";
var PROJECTLESS = PROJECTLESS_ENTRY_ID;
var ADD_WORKSPACE = "::add-workspace";
var DSH_DIRECTORY_FLOW = "conversation.hero.workspace.directoryFlow";
var DIRECTORY_FLOW = "dsh-projectless-session.directoryFlow";
function errorMessage(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}
function ProjectlessWorkspacePicker({
  open,
  anchorRef,
  selectedId,
  onPick,
  onClose,
  useWorkspaces,
  createWorkspace,
  createProjectlessSession,
  selectWorkspace,
  isProjectlessWorkspace,
  useDirectoryFlow,
  renderSlot,
  t
}) {
  const workspaceState = useWorkspaces((state) => state);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [flowOpen, setFlowOpen] = (0, import_react2.useState)(false);
  const [modalError, setModalError] = (0, import_react2.useState)(null);
  const getAnchorRect = (0, import_react2.useCallback)(
    () => anchorRef?.current?.getBoundingClientRect() ?? null,
    [anchorRef]
  );
  const selection = resolvePickerSelection(
    workspaceState.items,
    selectedId,
    isProjectlessWorkspace
  );
  const workspaceItems = selection.projects.map((workspace) => ({
    id: workspace.workspaceId,
    label: workspace.title,
    icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconFolderCloseRegular, { size: 16 }),
    disabled: busy
  }));
  const flowAvailable = useDirectoryFlow((occupied) => occupied);
  (0, import_react2.useEffect)(() => {
    if (flowOpen && !flowAvailable) setFlowOpen(false);
  }, [flowOpen, flowAvailable]);
  const footer = [
    {
      id: PROJECTLESS,
      label: t("picker.projectless"),
      icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconNewChatOutlineRegular, { size: 16 }),
      disabled: busy
    },
    ...flowAvailable ? [
      { type: "separator", id: "projectless-separator" },
      {
        id: ADD_WORKSPACE,
        label: t("picker.addWorkspace"),
        icon: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconPlusOutlineRegular, { size: 16 }),
        disabled: busy
      }
    ] : []
  ];
  const run = (operation) => {
    if (busy) return;
    setBusy(true);
    void operation().catch((reason) => {
      setModalError(errorMessage(reason));
    }).finally(() => {
      setBusy(false);
    });
  };
  const handleSelect = (id) => {
    if (id === PROJECTLESS) {
      onClose();
      run(async () => {
        await createProjectlessSession();
      });
      return;
    }
    if (id === ADD_WORKSPACE) {
      onClose();
      setModalError(null);
      setFlowOpen(true);
      return;
    }
    onClose();
    run(() => selectWorkspace(id));
  };
  const directoryFlowOwner = {
    open: flowOpen,
    busy,
    onPicked: (path) => {
      run(async () => {
        try {
          const workspace = await createWorkspace({ path });
          await selectWorkspace(workspace.workspaceId);
        } finally {
          setFlowOpen(false);
        }
      });
    },
    onCancel: () => {
      setFlowOpen(false);
    },
    onError: (message) => {
      setFlowOpen(false);
      setModalError(message);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_dsh_client_ui_primitives2.Menu,
      {
        open,
        anchor: null,
        items: workspaceItems,
        footer,
        selectedId: selection.selectedId ?? PROJECTLESS,
        onSelect: handleSelect,
        onClose,
        side: "bottom",
        portal: true,
        getAnchorRect
      }
    ),
    renderSlot(DIRECTORY_FLOW, directoryFlowOwner),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      import_dsh_client_ui_primitives2.Modal,
      {
        open: modalError !== null,
        onClose: () => {
          setModalError(null);
        },
        closeLabel: t("modal.close"),
        title: t("modal.createFailed"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", onClick: () => {
          setModalError(null);
        }, children: t("modal.close") }),
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-projectless-session-error", role: "alert", children: modalError })
      }
    )
  ] });
}
function ProjectlessEntry({ start, t }) {
  const ref = (0, import_react2.useRef)(null);
  (0, import_react2.useLayoutEffect)(() => {
    const entry = ref.current;
    const group = entry.closest(".dsh-projectless-chip-group");
    const folder = group.querySelector(".dsh-projectless-folder");
    const align = () => {
      const parent = group.getBoundingClientRect();
      const icon = folder.getBoundingClientRect();
      entry.style.left = `${icon.left - parent.left}px`;
      entry.style.top = `${icon.top - parent.top}px`;
    };
    align();
    const observer = new ResizeObserver(align);
    observer.observe(group);
    observer.observe(folder);
    return () => {
      observer.disconnect();
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    "button",
    {
      ref,
      type: "button",
      onClick: (event) => {
        event.stopPropagation();
        start();
      },
      title: t("entry.new"),
      "aria-label": t("entry.new"),
      className: "dsh-projectless-entry",
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M3 3L9 9M9 3L3 9", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round" }) })
    }
  );
}
function installStyles() {
  const style = document.createElement("style");
  style.dataset.plugin = PACKAGE_ID;
  style.textContent = `
    .dsh-projectless-chip-group { display: inline-flex; align-items: center; position: relative; }
    .dsh-projectless-chip-group button.dsh-projectless-entry { position: absolute; z-index: 1; width: 16px !important; height: 16px !important;
      min-width: 16px !important; min-height: 16px !important; padding: 0 !important;
      display: inline-flex; align-items: center; justify-content: center; border: 0 !important; border-radius: 4px !important;
      background: var(--dsw-alias-interactive-bg-hover, #e2e4e7) !important; color: var(--dsw-alias-label-primary, inherit) !important;
      line-height: 1; cursor: pointer; opacity: 0 !important; pointer-events: none !important; }
    .dsh-projectless-chip-group:hover .dsh-projectless-entry,
    .dsh-projectless-chip-group .dsh-projectless-entry:focus { opacity: 1 !important; pointer-events: auto !important; }
    .dsh-projectless-chip-group:has(.dsh-projectless-entry):hover .dsh-projectless-folder,
    .dsh-projectless-chip-group:has(.dsh-projectless-entry:focus) .dsh-projectless-folder { visibility: hidden; }
    .dsh-projectless-settings { display: grid; gap: 8px; padding: 12px 0; }
    .dsh-projectless-settings-controls { display: flex; gap: 8px; }
    .dsh-projectless-settings input { flex: 1; min-width: 0; padding: 8px; color: inherit;
      background: transparent; border: 1px solid var(--dsw-alias-border-primary, #888); border-radius: 6px; }
    .dsh-projectless-settings small { overflow-wrap: anywhere; }
    .dsh-projectless-session-error {
      margin-top: 8px;
      color: var(--dsw-alias-state-error-primary);
      font-size: 12px;
      line-height: 18px;
      overflow-wrap: anywhere;
    }
  `;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}
function mirrorDirectoryFlow(slots) {
  const register = slots.register.bind(slots);
  let mirrored;
  let disposers = [];
  const release = () => {
    for (const dispose of disposers) dispose();
    disposers = [];
  };
  const sync = () => {
    const entries = slots.entries(DSH_DIRECTORY_FLOW);
    if (entries === mirrored) return;
    mirrored = entries;
    release();
    disposers = entries.map((entry) => register({
      name: DIRECTORY_FLOW,
      ...entry.options.priority === void 0 ? {} : { priority: entry.options.priority },
      ...entry.inject === void 0 ? {} : { inject: entry.inject },
      ...entry.locale === void 0 ? {} : { locale: entry.locale }
    }, entry.component));
  };
  const unsubscribe = slots.subscribe(DSH_DIRECTORY_FLOW, sync);
  sync();
  return () => {
    unsubscribe();
    release();
  };
}
var name = PACKAGE_ID;
var inject = ["connection", "locale", "slots", "sessions", "workspaces", "uiWorkspace", "conversation", "remote", "remote.session", "remote.agentPresets", "remote.permissionPresets"];
function projectlessHost(ctx) {
  const workspaces = ctx.workspaces;
  const ui = ctx.uiWorkspace;
  const sessions = {
    list: ctx.sessions.list,
    open: (sessionId) => {
      ui.openSession(sessionId);
    }
  };
  const host = {
    list: workspaces.list,
    create: (input) => workspaces.create(input),
    delete: (workspaceId) => workspaces.delete(workspaceId),
    rename: (workspaceId, title) => workspaces.rename(workspaceId, title),
    connectWorkspace: (workspaceId) => ui.connectWorkspace(workspaceId),
    archiveSession: (sessionId) => ui.archiveSession(sessionId)
  };
  return { host, sessions };
}
function apply(ctx) {
  const { host, sessions } = projectlessHost(ctx);
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`);
  ctx.effect(
    () => ctx.locale.register(PROJECTLESS_LOCALE_NS, projectlessLocales),
    `${PACKAGE_ID}: dictionaries`
  );
  const registry = createProjectlessRegistry();
  const pendingWorkspaceIds = /* @__PURE__ */ new Set();
  const claim = createAbandonClaim();
  const rpc = ctx.connection.rpc;
  let diagnosticsEnabled = false;
  let loggingFailed = false;
  const diagnostics = (event, fields = {}) => {
    if (!diagnosticsEnabled || loggingFailed) return;
    console.debug(`[${PACKAGE_ID}] ${event}`, fields);
    try {
      void rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("log-event"), { event, fields }).then((result) => {
        if (!result.ok) throw new Error("diagnostic RPC failed");
      }).catch(() => {
        loggingFailed = true;
      });
    } catch {
      loggingFailed = true;
    }
  };
  const onError = (error) => {
    console.error(error);
    diagnostics("client.failed", { code: diagnosticErrorCode(error) });
  };
  const removeDirectory = (path) => requestRemoveProjectlessDirectory(rpc, path);
  const isProjectlessWorkspace = (workspace) => pendingWorkspaceIds.has(workspace.workspaceId) || registry.has(workspace.workspaceId) || isProjectlessPath(workspace.path);
  const directoryFlow = {
    getSnapshot: () => ctx.slots.entries(DIRECTORY_FLOW).length > 0,
    subscribe: (listener) => ctx.slots.subscribe(DIRECTORY_FLOW, listener)
  };
  ctx.effect(() => {
    let disposed = false;
    let stopSweep = () => {
    };
    void requestProjectlessSettings(rpc).then((settings) => {
      if (disposed) return;
      diagnosticsEnabled = settings.diagnosticsEnabled;
      stopSweep = sweepAbandonedProjectlessWorkspaces(
        host,
        sessions,
        settings.root,
        removeDirectory,
        pendingWorkspaceIds,
        claim,
        onError,
        diagnostics
      );
    }).catch(onError);
    return () => {
      disposed = true;
      stopSweep();
    };
  }, `${PACKAGE_ID}: sweep leftover unused workspaces`);
  const drafts = installProjectlessDrafts(ctx, host, pendingWorkspaceIds, diagnostics, onError);
  ctx.on("projectless/is-session", drafts.isProjectlessSession);
  ctx.on("projectless/label", () => ctx.locale.bind(PROJECTLESS_LOCALE_NS)("picker.projectless"));
  ctx.slots.inject("projectless.entry", () => ctx.slots.register({
    name: "projectless.entry",
    locale: PROJECTLESS_LOCALE_NS,
    inject: () => ({ start: () => {
      void drafts.start().catch(onError);
    } })
  }, ProjectlessEntry));
  ctx.effect(() => ctx.slots.register.bind(ctx.slots)({
    name: "settings.general.item",
    id: "projectless-session",
    order: 0,
    locale: PROJECTLESS_LOCALE_NS,
    inject: () => ({ rpc, browse: () => ctx.uiWorkspace.pickDirectory() })
  }, ProjectlessSettings), `${PACKAGE_ID}: root settings`);
  const actions = () => ({
    createWorkspace: (input) => host.create(input),
    selectWorkspace: drafts.switchWorkspace,
    isProjectlessWorkspace,
    hooks: { directoryFlow },
    createProjectlessSession: drafts.start
  });
  ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register(
    {
      name: "conversation.hero.workspace",
      priority: -1,
      children: {
        [DIRECTORY_FLOW]: { kind: "single", scope: "root" }
      },
      inject: actions,
      locale: PROJECTLESS_LOCALE_NS
    },
    ProjectlessWorkspacePicker
  ));
  ctx.slots.inject(DIRECTORY_FLOW, () => mirrorDirectoryFlow(ctx.slots));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
