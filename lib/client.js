window.__ModuleLoader__.load({ id: "dsh-codexlike-projectless", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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
var import_react3 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/shared/paths.ts
var DATE_DIRECTORY = /^\d{4}-\d{2}-\d{2}$/;
var SESSION_DIRECTORY = /^session-\d{2}-\d{2}-\d{2}-[0-9a-f]{8}$/;
function normalizeFsPath(path) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}
function isProjectlessPath(path) {
  const segments = normalizeFsPath(path).split("/").filter((segment) => segment.length > 0);
  const dateName = segments.at(-2);
  const sessionName = segments.at(-1);
  return dateName !== void 0 && sessionName !== void 0 && DATE_DIRECTORY.test(dateName) && SESSION_DIRECTORY.test(sessionName);
}

// src/shared/rpc.ts
var PROJECTLESS_RPC_CHANNEL = "/api";
var PROJECTLESS_RPC_PREFIX = "dsh-codexlike-projectless";
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
var PROJECTLESS_ENTRY_ID = "::dsh-codexlike-projectless";
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

// src/client/locales.ts
var PROJECTLESS_LOCALE_NS = "dsh-codexlike-projectless";
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
  services.signal?.throwIfAborted();
  diagnostics("title.preparation.started");
  const title = await services.prepareTitle(input);
  services.signal?.throwIfAborted();
  diagnostics("title.preparation.finished");
  const path = await services.provisionDirectory(title.title);
  let workspace;
  try {
    services.signal?.throwIfAborted();
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
    services.signal?.throwIfAborted();
    const sessionId = services.createSession === void 0 ? await host.connectWorkspace(workspace.workspaceId) : await services.createSession(workspace.workspaceId, title);
    receipt = { sessionId, workspaceId: workspace.workspaceId, path };
    diagnostics("session.created", { sessionId, workspaceId: workspace.workspaceId, path });
    await services.bindPreparedTitle(sessionId, title);
    services.signal?.throwIfAborted();
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
    let detachmentPending = false;
    try {
      await host.delete(workspace.workspaceId);
      diagnostics("workspace.detached", { sessionId, workspaceId: workspace.workspaceId });
    } catch (error) {
      detachmentPending = true;
      protectPending = true;
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
    return { receipt, acceptance, ...detachmentPending ? { detachmentPending: true } : {} };
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
var SELECTION_KEY = "dsh-codexlike-projectless.selected-workspace";
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

// src/client/admission.ts
function matchesNativeSubmission(requestId, message) {
  return requestId !== void 0 && message.source?.kind === "user" && message.source.rpcId === requestId;
}
function classifyNativeAdmission(admission, outcome) {
  if (admission?.accepted || admission?.observed || outcome.kind === "success") return "accepted";
  if (!admission?.requestId) return "rejected";
  if (!admission.errorCode || admission.errorCode.startsWith("gateway/") || admission.errorCode.startsWith("carrier/") || admission.errorCode.includes("cancel")) return "unknown";
  return "rejected";
}

// src/client/model.ts
function requireCatalogSelection(catalog, selection) {
  const model = catalog.groups.find((group) => group.id === selection.provider)?.models.find((model2) => model2.id === selection.model);
  if (!catalog.routableProviders.includes(selection.provider) || model === void 0) throw new Error("\u6240\u9009\u6A21\u578B\u76EE\u5F55\u4E0D\u53EF\u7528\uFF0C\u8BF7\u6062\u590D\u8FDE\u63A5\u6216\u91CD\u65B0\u9009\u62E9\u6A21\u578B\u3002");
  if (selection.reasoningEffort !== void 0 && !model.reasoning?.efforts.some((effort) => effort.id === selection.reasoningEffort)) throw new Error("\u6240\u9009\u6A21\u578B\u4E0D\u652F\u6301\u5F53\u524D\u63A8\u7406\u5F3A\u5EA6\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002");
}

// src/client/draft.ts
function installProjectlessDrafts(ctx, host, pending, diagnostics, onError, adapter) {
  const sessions = ctx.sessions;
  if (typeof sessions.createProjectlessDraft !== "function") {
    throw new Error("\u65E0\u9879\u76EE\u8FD0\u884C\u65F6\u9002\u914D\u5C1A\u672A\u5C31\u7EEA");
  }
  const conversation = ctx.conversation;
  const rpc = ctx.connection.rpc;
  const drafts = /* @__PURE__ */ new Map();
  const registry = createProjectlessRegistry();
  const cache = createDraftCache();
  const held = /* @__PURE__ */ new Map();
  const projectlessSessions = /* @__PURE__ */ new Set();
  const detachments = /* @__PURE__ */ new Map();
  let disposed = false;
  const lifetime = new AbortController();
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
  const keyOf = (workspaceId) => workspaceId ?? "::dsh-codexlike-projectless";
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
  const pluginCall = async (endpoint, payload, signal) => {
    const result = await rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint(endpoint), payload, signal);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  };
  const start = () => {
    if (starting !== void 0) return starting;
    starting = (async () => {
      const catalog = await nativeCall("session", "modelCatalog");
      requireCatalogSelection(catalog, catalog.default);
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
  ctx.on("projectless/detach-pending", (id) => detachments.has(id));
  ctx.on("projectless/retry-detach", async (id) => {
    const receipt = detachments.get(id);
    if (disposed || receipt === void 0) throw new Error("\u6CA1\u6709\u53EF\u91CD\u8BD5\u7684\u5DF2\u63A5\u6536\u4F1A\u8BDD\u6CE8\u9500\u64CD\u4F5C");
    await host.delete(receipt.workspaceId);
    detachments.delete(id);
    pending.delete(receipt.workspaceId);
  });
  ctx.on("projectless/new-session", (workspaceId, currentSessionId, options) => {
    const current = currentSessionId ?? currentId();
    if (workspaceId !== void 0 || current !== void 0 && workspaceOf(current) !== void 0) return void 0;
    void openEditor(void 0, true).then(async (id) => {
      if (disposed || options === void 0) return;
      const reference = held.get(id);
      if (reference === void 0) throw new Error("\u8349\u7A3F\u8F93\u5165\u4F5C\u7528\u57DF\u4E0D\u53EF\u7528");
      const binding = await reference.ready;
      if (disposed) return;
      if (options.agentPreset !== void 0) {
        const draft = drafts.get(id);
        draft.preset = options.agentPreset;
        sessions.updateProjectlessDraft(id, "agentPreset", draft.preset);
      }
      switch (conversation.input.requestDraftInitialization(binding, options)) {
        case "applied":
        case "preserved":
          break;
        case "blocked":
          throw new Error("\u8F93\u5165\u5DF2\u9501\u5B9A\uFF0C\u65E0\u6CD5\u521D\u59CB\u5316\u65B0\u8349\u7A3F");
      }
    }).catch(onError);
    return true;
  });
  ctx.on("projectless/draft-rpc", async (endpoint, args, signal) => {
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
      const catalog = await nativeCall("session", "modelCatalog");
      signal.throwIfAborted();
      if (disposed) throw new Error("Projectless plugin unloaded");
      requireCatalogSelection(catalog, model);
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
    signal = AbortSignal.any([signal, lifetime.signal]);
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
            const catalog = await nativeCall("session", "modelCatalog");
            signal.throwIfAborted();
            requireCatalogSelection(catalog, choice.model);
            return pluginCall("prepare-title", {
              text: input.text || "\u9644\u4EF6\u5206\u6790",
              route: choice.model,
              sessionId: crypto.randomUUID()
            }, signal);
          },
          provisionDirectory: (title) => requestProjectlessDirectory(rpc, title, void 0, root),
          createSession: async (workspaceId, title) => {
            projectlessSessions.add(title.sessionId);
            return sessions.create({ workspaceId, sessionId: title.sessionId });
          },
          bindPreparedTitle: async (id, title) => {
            signal.throwIfAborted();
            await pluginCall("bind-title", { sessionId: id, token: title.token }, signal);
            if (choice.preset !== void 0) await nativeCall("agentPresets", "select", id, choice.preset);
            await nativeCall("session", "selectModel", { sessionId: id, ...choice.model });
            const applyCommand = async (line) => {
              const result2 = await nativeCall("commands", "execute", id, line, []);
              if (result2 === void 0) throw new Error(`\u5F53\u524D Agent \u9884\u8BBE\u4E0D\u652F\u6301\u8BBE\u7F6E\uFF1A${line}`);
              if (result2.result.kind !== "success") throw new Error(result2.result.text ?? `\u8BBE\u7F6E\u5931\u8D25\uFF1A${line}`);
            };
            await applyCommand(`/permission ${choice.permission}`);
            if (choice.plan) await applyCommand("/plan");
          },
          send: async (id, input) => sessions.using(id, { source: "controllerOperation" }, async (reference2) => {
            const binding = await reference2.ready;
            adapter.beginFirstSend(id);
            let outcome;
            try {
              outcome = await conversation.sendSession(binding.session, input.text, input.attachments, input.mode, input.signal);
            } catch (error) {
              if (!adapter.admission(id)?.requestId) {
                onError(error);
                return "rejected";
              }
              throw error;
            }
            const admission = adapter.admission(id);
            return classifyNativeAdmission(admission, outcome);
          }),
          removeDirectory: (path) => requestRemoveProjectlessDirectory(rpc, path).then(() => {
          }),
          isCurrentTarget: () => isCurrentSession(sessions.list.getSnapshot(), session.sessionId),
          signal,
          onError
        }, registry, pending, diagnostics);
        if (result.acceptance === "unknown") {
          draft.uncertain = true;
          draft.receipt = result.receipt;
          draft.admissionReference = sessions.retain(result.receipt.sessionId, { source: "controllerOperation" });
          void draft.admissionReference.ready.then(reconcile).catch(onError);
          reconcile();
          return { kind: "error", text: `\u53D1\u9001\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\u3002\u8BF7\u67E5\u770B\u4F1A\u8BDD ${result.receipt.sessionId}\uFF0C\u4E0D\u8981\u91CD\u590D\u53D1\u9001\u3002` };
        }
        if (result.acceptance === "accepted") {
          if (result.detachmentPending) detachments.set(result.receipt.sessionId, result.receipt);
          releaseDraft(session.sessionId);
        }
        return result.acceptance === "accepted" ? { kind: "success" } : { kind: "error" };
      } catch (error) {
        onError(error);
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      } finally {
        draft.busy = false;
        if (!disposed && !draft.uncertain) conversation.blocks.set(session.sessionId, void 0);
        reference.release();
      }
    })();
  });
  const releaseDraft = (id) => {
    const draft = drafts.get(id);
    drafts.delete(id);
    cache.remove(id);
    const reference = held.get(id);
    held.delete(id);
    reference?.release();
    draft?.admissionReference?.release();
    if (draft) sessions.discardProjectlessDraft(id);
  };
  const reconcile = () => {
    for (const [id, draft] of drafts) {
      const receipt = draft.receipt;
      if (!draft.uncertain || receipt === void 0 || !adapter.admission(receipt.sessionId)?.observed) continue;
      delete draft.receipt;
      void host.delete(receipt.workspaceId).then(() => pending.delete(receipt.workspaceId)).catch((error) => {
        detachments.set(receipt.sessionId, receipt);
        onError(error);
      }).finally(() => {
        if (disposed) return;
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
      if (selection.kind === "projectless" && (current === void 0 || sessions.list.getSnapshot().byId[current]?.blank)) {
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
    lifetime.abort(new Error("Projectless plugin unloaded"));
    for (const reference of held.values()) reference.release();
    held.clear();
    for (const [id, draft] of drafts) {
      draft.admissionReference?.release();
      sessions.discardProjectlessDraft(id);
    }
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
    error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { role: "alert", className: "dsh-codexlike-projectless-error", children: error })
  ] });
}

// src/client/runtime.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

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

// src/client/runtime.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var installations = /* @__PURE__ */ new WeakMap();
var activationGeneration = 0;
function activateClientRuntime(ctx) {
  const key = originalInstance(ctx.sessions);
  const existing = installations.get(key);
  if (existing) return existing;
  const generation = ++activationGeneration;
  const status = { state: "checking", reason: "\u6B63\u5728\u68C0\u67E5\u8FD0\u884C\u65F6\u517C\u5BB9\u6027", adapter: ADAPTER_ID, version: RUNTIME_PACKAGE_VERSION, build: TARGET_BUILD, missingCapabilities: [] };
  const listeners = /* @__PURE__ */ new Set();
  const disposers = [];
  const ownership = [];
  const drafts = /* @__PURE__ */ new Map();
  const retiredIds = /* @__PURE__ */ new Set();
  const localFiles = /* @__PURE__ */ new Map();
  const submissions = /* @__PURE__ */ new Map();
  let active = true;
  let business = false;
  let restored = false;
  const sessions = originalInstance(ctx.sessions);
  const manager = originalInstance(sessions.manager);
  const navigation = originalInstance(ctx.uiWorkspace);
  const conversation = originalInstance(ctx.conversation);
  const gateway = originalInstance(ctx.remote);
  const core = originalInstance(ctx.slots._core);
  const isDraft = (id) => typeof id === "string" && drafts.has(id);
  const isLocal = (id) => typeof id === "string" && (drafts.has(id) || retiredIds.has(id));
  const updateStatus = (state, reason) => {
    Object.assign(status, { state, reason, missingCapabilities: state === "ready" ? [] : [reason] });
    for (const listener of listeners) listener();
  };
  const requireActive = () => {
    if (active && business && ownership.some((check) => !check())) {
      business = false;
      updateStatus("conflict", "\u5173\u952E\u8FD0\u884C\u65F6\u65B9\u6CD5\u5DF2\u88AB\u8986\u76D6\uFF0C\u8BF7\u505C\u7528\u51B2\u7A81\u529F\u80FD\u540E\u6B63\u5E38\u91CD\u542F");
    }
    if (!active || !business || status.state !== "ready") throw new Error(status.reason);
  };
  const wrap = (target, key2, fn) => {
    target = originalInstance(target);
    const restore = wrapRuntimeMethod(target, key2, fn);
    const installed = target[key2];
    const check = () => target[key2] === installed;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const index = disposers.indexOf(release);
      if (index >= 0) disposers.splice(index, 1);
      const ownerIndex = ownership.indexOf(check);
      if (ownerIndex >= 0) ownership.splice(ownerIndex, 1);
      restore();
    };
    disposers.push(release);
    ownership.push(check);
    return release;
  };
  const deny = () => ({ ok: false, error: { code: "projectless/draft-only", message: "\u6B64\u64CD\u4F5C\u9700\u8981\u771F\u5B9E\u4F1A\u8BDD\uFF0C\u8349\u7A3F\u8EAB\u4EFD\u4E0D\u4F1A\u53D1\u9001\u5230\u5BBF\u4E3B\u3002", details: {} } });
  const localIdentity = (value) => isLocal(value) || typeof value === "object" && value !== null && Object.values(value).some(localIdentity);
  try {
    if (sessions.createProjectlessDraft || /projectless\/new-session/.test(Function.prototype.toString.call(navigation.startSession))) throw new Error("\u68C0\u6D4B\u5230\u65E7\u5F52\u6863\u8865\u4E01\uFF1B\u8BF7\u5148\u660E\u786E\u6062\u590D\u539F\u7248\u540E\u518D\u542F\u7528");
    if (!Function.prototype.toString.call(navigation.startSession).includes("const workspace = this.workspaces.list.getSnapshot()")) throw new Error("\u65B0\u5EFA\u4F1A\u8BDD\u65B9\u6CD5\u5DF2\u88AB\u5176\u4ED6\u63D2\u4EF6\u63A5\u7BA1\uFF1B\u5F53\u524D\u7EC4\u5408\u672A\u901A\u8FC7\u517C\u5BB9\u9A8C\u8BC1");
    if (!core || typeof core.factory !== "function" || !conversation.input) throw new Error("\u539F\u751F\u89C6\u56FE\u6216\u8F93\u5165\u670D\u52A1\u4E0D\u5339\u914D");
    wrap(navigation, "restoreSelection", (original, receiver, args) => {
      restored = true;
      const saved = receiver.selection.getSnapshot();
      const history = args[1].byId[saved.sessionId];
      const choice = decodeSelection(localStorage.getItem(SELECTION_KEY));
      if (active && !saved.subagentAddress && (!history || history.blank) && choice.kind === "projectless") return Promise.resolve();
      if (active && !saved.subagentAddress && (!history || history.blank) && choice.kind === "project" && args[0].items.some((item) => item.workspaceId === choice.workspaceId)) return receiver.openWorkspace(choice.workspaceId);
      return original.apply(receiver, args);
    });
    wrap(navigation, "startSession", (original, receiver, args) => {
      if (!active || !business) return original.apply(receiver, args);
      requireActive();
      if (ctx.bail("projectless/new-session", args[0], receiver.mainReference?.sessionId, args[1]) === true) return;
      return original.apply(receiver, args);
    });
    wrap(navigation, "openWorkspace", (original, receiver, args) => {
      if (active && business && args[1] !== void 0 && args[2] === void 0 && isDraft(receiver.mainReference?.sessionId)) {
        requireActive();
        const result = ctx.bail("projectless/select-workspace", args[0]);
        if (result !== void 0) return result;
      }
      return original.apply(receiver, args);
    });
  } catch (error) {
    for (const dispose2 of disposers.splice(0).reverse()) dispose2();
    active = false;
    updateStatus("conflict", String(error));
  }
  try {
    let AdaptedInput2 = function(props) {
      const useFileUploads = (selector) => {
        const source = props.useFileUploads((value) => value);
        const display = (0, import_react2.useMemo)(() => Object.fromEntries(Object.entries(source).map(([id, value]) => [
          id,
          isDraft(props.sessionId) && localFiles.get(id) === props.sessionId && value.status === "projectless-pending" ? { status: "ready" } : value
        ])), [source, props.sessionId]);
        return selector(display);
      };
      return (0, import_react2.createElement)(OriginalInput, { ...props, useFileUploads });
    };
    var AdaptedInput = AdaptedInput2;
    if (!active) throw new Error(status.reason);
    wrap(manager, "buildListSnapshot", (original, receiver, args) => {
      if (active) {
        for (const item of drafts.values()) if (!receiver.summaries.some((row) => row.sessionId === item.summary.sessionId)) receiver.summaries.push(item.summary);
      }
      return original.apply(receiver, args);
    });
    wrap(manager, "refreshProjections", (original, receiver, args) => isLocal(args[0]) ? Promise.resolve() : original.apply(receiver, args));
    wrap(manager, "handleConnected", (original, receiver, args) => {
      const result = original.apply(receiver, args);
      if (active) for (const [id, item] of drafts) receiver.projectionStore(id).seed({ asOfSeq: 0, values: item.values });
      receiver.notifier.markDirty();
      return result;
    });
    wrap(manager, "createSession", (original, receiver, args) => {
      const session = original.apply(receiver, args);
      const releases = [];
      const wrapSession = (key2, replacement) => releases.push(wrap(session, key2, replacement));
      if (isDraft(args[0])) {
        wrapSession("doOpen", () => {
          if (!active) throw new Error("Local draft adapter disposed");
          session.openState = "open";
          session.notifier.markDirty();
          return Promise.resolve();
        });
      }
      wrapSession("beginSubmission", (begin, owner, values) => {
        const operation = submissions.get(owner.sessionId);
        if (!operation) return begin.apply(owner, values);
        const request = values[0];
        const submission = begin.call(owner, { ...request, onRetire: (settlement) => {
          if (settlement.reason === "observed") operation.observed = true;
          request.onRetire?.(settlement);
        } });
        operation.requestId = submission.requestId;
        return submission;
      });
      wrapSession("prompt", async (prompt, owner, values) => {
        const operation = submissions.get(owner.sessionId);
        const result = await prompt.apply(owner, values);
        if (operation && operation.requestId === values[3] && result.ok) operation.accepted = true;
        if (operation && operation.requestId === values[3] && !result.ok) operation.errorCode = result.error.code;
        return result;
      });
      const observeMessages = (owner, messages) => {
        const operation = submissions.get(owner.sessionId);
        if (operation && messages.some((message) => matchesNativeSubmission(operation.requestId, message))) operation.observed = true;
      };
      wrapSession("observeSubmissionEvent", (observe, owner, values) => {
        const event = values[0];
        if (event.type === "user/message") observeMessages(owner, [event.data]);
        if (event.type === "agent/inbox/spliced") observeMessages(owner, event.data.inserted);
        return observe.apply(owner, values);
      });
      wrapSession("observeSubmissionInsertions", (observe, owner, values) => {
        observeMessages(owner, values[1]);
        return observe.apply(owner, values);
      });
      wrapSession("dispose", async (originalDispose, owner, values) => {
        try {
          return await originalDispose.apply(owner, values);
        } finally {
          for (const release of releases.reverse()) release();
        }
      });
      return session;
    });
    const methods = {
      createProjectlessDraft(values) {
        requireActive();
        const sessionId = "projectless-draft-" + crypto.randomUUID();
        const summary = { sessionId, updatedAt: Date.now(), running: false, blank: true, agentAvailable: true };
        drafts.set(sessionId, { summary, values });
        manager.recordMutation({ kind: "placeholder", summary });
        manager.projectionStore(sessionId).seed({ asOfSeq: 0, values });
        sessions.projectList();
        return sessionId;
      },
      isProjectlessDraft: isDraft,
      updateProjectlessDraft(id, key2, value) {
        requireActive();
        const draft = drafts.get(id);
        if (!draft) throw new Error("Not a live projectless draft");
        draft.values[key2] = value;
        const store = manager.projectionStore(id);
        store.apply(key2, value, (store.seqOf(key2) ?? 0) + 1);
      },
      discardProjectlessDraft(id) {
        if (!drafts.delete(id)) return;
        retiredIds.add(id);
        manager.handleSessionRemoved(id);
      }
    };
    for (const [key2, method] of Object.entries(methods)) {
      if (key2 in sessions) throw new Error("Draft method already installed: " + key2);
      sessions[key2] = method;
      disposers.push(() => {
        if (sessions[key2] === method) delete sessions[key2];
      });
    }
    wrap(gateway, "invoke", async (original, receiver, args) => {
      if (!args[2].active) return original.apply(receiver, args);
      const prepared = receiver.prepareInvocation(...args);
      if (!localIdentity(prepared.args)) return original.apply(receiver, args);
      if (!active || !business || status.state !== "ready") return deny();
      prepared.signal.throwIfAborted();
      if (!args[2].active) return deny();
      const id = Object.values(prepared.args).find(isLocal) ?? Object.values(prepared.args).map((value) => value?.sessionId).find(isLocal);
      const positional = args[1]?.parameterIndex === 0 && id ? [id, ...args[4]] : args[4];
      const result = await ctx.bail("projectless/draft-rpc", prepared.endpoint, positional, prepared.signal) ?? deny();
      prepared.signal.throwIfAborted();
      if (!active || !args[2].active) return deny();
      if (!result.ok) return result;
      const descriptor = args[0];
      return { ok: true, value: descriptor.result.mode === "strict" && descriptor.result.decode ? descriptor.result.decode(result.value) : result.value };
    });
    wrap(gateway, "invokeStream", (original, receiver, args) => {
      const prepared = receiver.prepareInvocation(...args);
      if (localIdentity(prepared.args)) throw new Error("\u672C\u5730\u8349\u7A3F\u4E0D\u652F\u6301\u4F1A\u8BDD\u6D41\u5F0F\u7AEF\u70B9");
      return original.apply(receiver, args);
    });
    wrap(conversation.input, "sink", (original, receiver, args) => {
      if (!isLocal(args[0].sessionId)) return original.apply(receiver, args);
      if (args[1] === "" && args[2].length === 0) return Promise.resolve({ kind: "success" });
      requireActive();
      return ctx.bail("projectless/first-send", ...args) ?? Promise.resolve({ kind: "error", text: "\u9996\u6B21\u53D1\u9001\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA" });
    });
    wrap(conversation, "beginFileUpload", (original, receiver, args) => {
      if (!isLocal(args[0])) return original.apply(receiver, args);
      requireActive();
      const attachment = args[1];
      receiver.fileUploadOperations.get(attachment.id)?.controller.abort();
      localFiles.set(attachment.id, args[0]);
      receiver.fileUploads.update((state) => {
        state[attachment.id] = { status: "projectless-pending" };
      });
    });
    wrap(conversation, "releaseDraftAttachment", (original, receiver, args) => {
      localFiles.delete(args[0]);
      return original.apply(receiver, args);
    });
    wrap(conversation, "sendSession", async (original, receiver, args) => {
      const [session, , attachmentIds, , signal] = args;
      if (isLocal(session.sessionId)) throw new Error("Local draft cannot be sent directly");
      const pending = [];
      for (const id of attachmentIds) if (localFiles.has(id)) {
        const attachment = receiver.draftAttachments.get(id);
        if (attachment?.kind === "file") {
          requireActive();
          signal?.throwIfAborted();
          receiver.beginFileUpload(session.sessionId, attachment);
          const operation = receiver.fileUploadOperations.get(id);
          const abort = () => operation.controller.abort();
          signal?.addEventListener("abort", abort, { once: true });
          pending.push(operation.done.finally(() => signal?.removeEventListener("abort", abort)));
        }
      }
      await Promise.all(pending);
      if (pending.length) requireActive();
      signal?.throwIfAborted();
      return original.apply(receiver, args);
    });
    const inputDefinition = core.entries("conversation.composer.bar")[0];
    if (!inputDefinition) throw new Error("Native input factory missing");
    if (core.entries("conversation.composer.bar").length !== 1) throw new Error("\u8F93\u5165\u63D2\u69FD\u5B58\u5728\u5176\u4ED6\u63A5\u7BA1\uFF0C\u672C\u7EC4\u5408\u5C1A\u672A\u9A8C\u8BC1");
    const OriginalInput = inputDefinition.component;
    Object.defineProperty(AdaptedInput2, RUNTIME_WRAPPER, { value: { target: inputDefinition, original: OriginalInput, installed: AdaptedInput2, generation } });
    disposers.push(() => {
      if (inputDefinition.component !== AdaptedInput2) return;
      inputDefinition.component = OriginalInput;
      core.markDirty("conversation.composer.bar", core.record("conversation.composer.bar"));
    });
    inputDefinition.component = AdaptedInput2;
    core.markDirty("conversation.composer.bar", core.record("conversation.composer.bar"));
    const installFactory = () => {
      const definition = core.factory("conversation.content");
      if (!definition) return;
      const Original = definition.component;
      function AdaptedContent(props) {
        const renderSlot = (name2, owner, ...rest) => {
          if (name2 !== "conversation.composer.bar" || !active || !business) return props.renderSlot(name2, owner, ...rest);
          let input = owner;
          if (isDraft(props.sessionId)) {
            const block = conversation.blocks.storeFor(props.sessionId).getSnapshot();
            input = { ...owner, disabled: false, placeholder: block?.reason ?? props.t("placeholder.hero"), ...block ? { blocked: block } : {} };
          }
          return (0, import_react2.createElement)(
            import_react2.Fragment,
            null,
            (0, import_react2.createElement)(ProjectControl, { props, ctx, navigation, conversation, status, requireActive }),
            props.renderSlot(name2, input, ...rest)
          );
        };
        return (0, import_react2.createElement)(Original, { ...props, renderSlot });
      }
      Object.defineProperty(AdaptedContent, RUNTIME_WRAPPER, { value: { target: definition, original: Original, installed: AdaptedContent, generation } });
      disposers.push(() => {
        if (definition.component !== AdaptedContent) return;
        definition.component = Original;
        core.markFactoryDirty(core.factoryRecord("conversation.content"));
      });
      definition.component = AdaptedContent;
      core.markFactoryDirty(core.factoryRecord("conversation.content"));
    };
    installFactory();
    let known = core.factory("conversation.content");
    disposers.push(core.subscribeFactory("conversation.content", () => {
      const next = core.factory("conversation.content");
      if (next === known || !active) return;
      known = next;
      installFactory();
    }));
    if (sessions.list.getSnapshot().phase === "ready" && !restored) updateStatus("restart-required", "\u9002\u914D\u52A0\u8F7D\u665A\u4E8E\u539F\u751F\u542F\u52A8\u6062\u590D\uFF0C\u8BF7\u6B63\u5E38\u91CD\u542F\u5E94\u7528");
  } catch (error) {
    active = false;
    for (const dispose2 of disposers.splice(0).reverse()) dispose2();
    if (status.state !== "conflict") updateStatus("failed", String(error));
  }
  const dispose = () => {
    if (!active && installations.get(key) !== runtime) return;
    active = false;
    business = false;
    if (isDraft(navigation.mainReference?.sessionId)) navigation.clearMain();
    for (const id of drafts.keys()) {
      retiredIds.add(id);
      manager.handleSessionRemoved(id);
    }
    drafts.clear();
    for (const release of disposers.splice(0).reverse()) release();
    localFiles.clear();
    if (installations.get(key) === runtime) installations.delete(key);
    listeners.clear();
  };
  ctx.effect(() => dispose);
  const runtime = {
    getStatus: () => ({ ...status, missingCapabilities: [...status.missingCapabilities] }),
    subscribeStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    confirm(host) {
      if (!active || status.state === "restart-required") return false;
      if (host.state !== "ready" || host.adapter !== ADAPTER_ID || host.version !== RUNTIME_PACKAGE_VERSION || host.build !== TARGET_BUILD || host.missingCapabilities.length > 0) {
        updateStatus("unsupported", host.reason || "Host \u4E0E\u5BA2\u6237\u7AEF\u9002\u914D\u7248\u672C\u4E0D\u5339\u914D");
        return false;
      }
      business = true;
      updateStatus("ready", "\u65E0\u9879\u76EE\u8FD0\u884C\u65F6\u9002\u914D\u5DF2\u5C31\u7EEA");
      return true;
    },
    admission(sessionId) {
      return submissions.get(sessionId);
    },
    beginFirstSend(sessionId) {
      submissions.set(sessionId, { accepted: false, observed: false });
    },
    fail(reason) {
      business = false;
      updateStatus("failed", reason);
    },
    dispose
  };
  installations.set(key, runtime);
  return runtime;
}
function ProjectControl({ props, ctx, navigation, status, requireActive }) {
  const anchor = (0, import_react2.useRef)(null);
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [detached, setDetached] = (0, import_react2.useState)(false);
  const [retrying, setRetrying] = (0, import_react2.useState)(false);
  const [detachError, setDetachError] = (0, import_react2.useState)("");
  (0, import_react2.useLayoutEffect)(() => {
    setDetached(false);
    setDetachError("");
  }, [props.sessionId]);
  const workspaces = props.useWorkspaces((state) => state);
  const project = workspaces.items.find((item) => item.sessionIds.includes(props.sessionId));
  const start = () => {
    requireActive();
    void ctx.bail("projectless/open-draft");
  };
  (0, import_react2.useLayoutEffect)(() => {
    const root = anchor.current?.closest("[data-conversation-content]");
    root?.setAttribute("data-projectless-unified", "");
    return () => {
      root?.removeAttribute("data-projectless-unified");
    };
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-projectless-unified-control", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-projectless-chip-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", ref: anchor, onClick: () => setOpen((value) => !value), disabled: status.state !== "ready", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-projectless-folder", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.IconFolderCloseRegular, { size: 16 }) }),
        " ",
        project?.title ?? ctx.bail("projectless/label") ?? "\u65E0\u9879\u76EE",
        " \u25BE"
      ] }),
      project && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "dsh-projectless-entry", "aria-label": "\u5207\u6362\u5230\u65E0\u9879\u76EE", title: "\u5207\u6362\u5230\u65E0\u9879\u76EE", onClick: start, children: "\xD7" })
    ] }),
    props.renderSlot("conversation.hero.agentPreset", {}),
    !detached && ctx.bail("projectless/detach-pending", props.sessionId) && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", disabled: retrying, onClick: () => {
      requireActive();
      setRetrying(true);
      Promise.resolve(ctx.bail("projectless/retry-detach", props.sessionId)).then(() => setDetached(true), (error) => setDetachError(String(error))).finally(() => setRetrying(false));
    }, children: "\u91CD\u8BD5\u6CE8\u9500\u4E34\u65F6\u5DE5\u4F5C\u533A" }),
    detachError && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { role: "status", children: detachError }),
    props.renderSlot("conversation.hero.workspace", { open, anchorRef: anchor, selectedId: project?.workspaceId, onClose: () => setOpen(false), onPick: (id) => {
      setOpen(false);
      void navigation.openWorkspace(id);
    } })
  ] });
}

// src/client/index.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var PACKAGE_ID = "dsh-codexlike-projectless";
var PROJECTLESS = PROJECTLESS_ENTRY_ID;
var ADD_WORKSPACE = "::add-workspace";
var DSH_DIRECTORY_FLOW = "conversation.hero.workspace.directoryFlow";
var DIRECTORY_FLOW = "dsh-codexlike-projectless.directoryFlow";
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
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const [flowOpen, setFlowOpen] = (0, import_react3.useState)(false);
  const [modalError, setModalError] = (0, import_react3.useState)(null);
  const getAnchorRect = (0, import_react3.useCallback)(
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
    icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconFolderCloseRegular, { size: 16 }),
    disabled: busy
  }));
  const flowAvailable = useDirectoryFlow((occupied) => occupied);
  (0, import_react3.useEffect)(() => {
    if (flowOpen && !flowAvailable) setFlowOpen(false);
  }, [flowOpen, flowAvailable]);
  const footer = [
    {
      id: PROJECTLESS,
      label: t("picker.projectless"),
      icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconNewChatOutlineRegular, { size: 16 }),
      disabled: busy
    },
    ...flowAvailable ? [
      { type: "separator", id: "projectless-separator" },
      {
        id: ADD_WORKSPACE,
        label: t("picker.addWorkspace"),
        icon: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconPlusOutlineRegular, { size: 16 }),
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_dsh_client_ui_primitives3.Menu,
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
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      import_dsh_client_ui_primitives3.Modal,
      {
        open: modalError !== null,
        onClose: () => {
          setModalError(null);
        },
        closeLabel: t("modal.close"),
        title: t("modal.createFailed"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", onClick: () => {
          setModalError(null);
        }, children: t("modal.close") }),
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-codexlike-projectless-error", role: "alert", children: modalError })
      }
    )
  ] });
}
function installStyles() {
  const style = document.createElement("style");
  style.dataset.plugin = PACKAGE_ID;
  style.textContent = `
    .dsh-projectless-chip-group { display: inline-flex; align-items: center; position: relative; }
    [data-projectless-unified] [class*="heroWorkspaceRow"] { display: none; }
    .dsh-projectless-unified-control { display: flex; gap: 8px; align-items: center; margin: 0 0 12px; }
    .dsh-projectless-unified-control button { color: inherit; background: transparent; border: 0; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
    .dsh-projectless-unified-control .dsh-projectless-entry { left: 8px; top: 4px; }
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
    .dsh-codexlike-projectless-error {
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
var inject = ["connection", "locale", "slots", "sessions", "workspaces", "uiWorkspace", "conversation", "remote"];
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
  ctx.effect(installStyles, `${PACKAGE_ID}: styles`);
  ctx.effect(
    () => ctx.locale.register(PROJECTLESS_LOCALE_NS, projectlessLocales),
    `${PACKAGE_ID}: dictionaries`
  );
  const adapter = activateClientRuntime(ctx);
  const rpc = ctx.connection.rpc;
  ctx.effect(() => ctx.slots.register.bind(ctx.slots)({
    name: "settings.general.item",
    id: PACKAGE_ID,
    order: 0,
    locale: PROJECTLESS_LOCALE_NS,
    inject: () => ({ rpc, browse: () => ctx.uiWorkspace.pickDirectory(), adapter })
  }, RuntimeSettings), `${PACKAGE_ID}: settings and runtime status`);
  ctx.inject(["remote.session", "remote.agentPresets", "remote.permissionPresets", "remote.commands"], (scope) => {
    let active = true;
    scope.effect(() => () => {
      active = false;
    });
    void rpc.call(PROJECTLESS_RPC_CHANNEL, projectlessEndpoint("runtime-status"), {}).then((result) => {
      if (!active) return;
      if (!result.ok) throw new Error(result.error.message);
      if (adapter.confirm(result.value)) installBusiness(scope, adapter);
    }).catch((error) => {
      if (active) adapter.fail(String(error));
    });
  });
}
function RuntimeSettings(props) {
  const [status, setStatus] = (0, import_react3.useState)(props.adapter.getStatus);
  (0, import_react3.useEffect)(() => props.adapter.subscribeStatus(() => setStatus(props.adapter.getStatus())), [props.adapter]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { role: "status", children: status.reason }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ProjectlessSettings, { ...props })
  ] });
}
function installBusiness(ctx, adapter) {
  const { host } = projectlessHost(ctx);
  const registry = createProjectlessRegistry();
  const pendingWorkspaceIds = /* @__PURE__ */ new Set();
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
  const isProjectlessWorkspace = (workspace) => pendingWorkspaceIds.has(workspace.workspaceId) || registry.has(workspace.workspaceId) || isProjectlessPath(workspace.path);
  const directoryFlow = {
    getSnapshot: () => ctx.slots.entries(DIRECTORY_FLOW).length > 0,
    subscribe: (listener) => ctx.slots.subscribe(DIRECTORY_FLOW, listener)
  };
  ctx.effect(() => {
    let disposed = false;
    void requestProjectlessSettings(rpc).then((settings) => {
      if (disposed) return;
      diagnosticsEnabled = settings.diagnosticsEnabled;
    }).catch(onError);
    return () => {
      disposed = true;
    };
  }, `${PACKAGE_ID}: diagnostics settings`);
  const drafts = installProjectlessDrafts(ctx, host, pendingWorkspaceIds, diagnostics, onError, adapter);
  ctx.on("projectless/is-session", drafts.isProjectlessSession);
  ctx.on("projectless/label", () => ctx.locale.bind(PROJECTLESS_LOCALE_NS)("picker.projectless"));
  ctx.on("projectless/open-draft", () => drafts.start().then(() => {
  }));
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
