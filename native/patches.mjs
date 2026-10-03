/** Version-specific native seams for DSH Desktop 0.2.0-rc.2. */
function replace(source, before, after) {
  const first = source.indexOf(before)
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) throw new Error(`Native patch anchor is missing or ambiguous: ${before.slice(0, 90)}`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

export function patchSessions(source) {
  source = replace(source, 'async doOpen(generation) {', `async doOpen(generation) {
    if (this.options.projectlessDraft) {
      this.openState = "open";
      this.notifier.markDirty();
      return;
    }`)
  source = replace(source, 'createSession(sessionId) {', `createSession(sessionId) {`)
  source = replace(source, 'return new Session(sessionId, this.remote, {', `return new Session(sessionId, this.remote, {
    projectlessDraft: this.projectlessDrafts?.has(sessionId) === true,`)
  source = replace(source, 'refreshProjections(sessionId) {\n\t\t\t\tconst existing', `refreshProjections(sessionId) {
    if (this.projectlessDrafts?.has(sessionId)) return Promise.resolve();
    const existing`)
  source = replace(source, 'const summaries = mutations.reduce(applyMutation, baseline);', `const summaries = mutations.reduce(applyMutation, baseline);
    for (const draft of this.projectlessDrafts?.values() ?? []) {
      if (!summaries.some(s => s.sessionId === draft.sessionId)) summaries.push(draft);
    }`)
  source = replace(source, 'async create(opts = {}) {\n\t\t\t\tconst result = await this.manager.create(opts);', `createProjectlessDraft(values) {
    const sessionId = "projectless-draft-" + randomUUID();
    const summary = { sessionId, updatedAt: Date.now(), running: false, blank: true, agentAvailable: true };
    this.manager.projectlessDrafts ??= new Map();
    this.manager.projectlessDrafts.set(sessionId, summary);
    this.manager.recordMutation({ kind: "placeholder", summary });
    this.manager.projectionStore(sessionId).seed({ asOfSeq: 0, values });
    this.projectList();
    return sessionId;
  }
  updateProjectlessDraft(sessionId, key, value) {
    if (!this.manager.projectlessDrafts?.has(sessionId)) throw new Error("Not a live projectless draft");
    const store = this.manager.projectionStore(sessionId);
    store.apply(key, value, (store.seqOf(key) ?? 0) + 1);
  }
  isProjectlessDraft(sessionId) { return this.manager.projectlessDrafts?.has(sessionId) === true; }
  discardProjectlessDraft(sessionId) {
    if (!this.manager.projectlessDrafts?.delete(sessionId)) return;
    this.manager.handleSessionRemoved(sessionId);
  }
  async create(opts = {}) {
    const result = await this.manager.create(opts);`)
  return source
}

export function patchGateway(source) {
  return replace(source, 'const prepared = this.prepareInvocation(descriptor, projection, token, callerCtx, values, boundIdentity);\n\t\t\t\tconst connection', `const prepared = this.prepareInvocation(descriptor, projection, token, callerCtx, values, boundIdentity);
    const intercepted = this.ownerCtx.bail("projectless/draft-rpc", endpoint, values, prepared.signal);
    if (intercepted !== undefined) return await intercepted;
    const connection`)
}

export function patchConversation(source) {
  source = replace(source, 'const storedChipTitle = pendingWorkspace?.title', `const projectless = sessionId !== undefined && props.isProjectlessSession?.(sessionId) === true;
    const storedChipTitle = projectless ? props.projectlessLabel() : pendingWorkspace?.title`)
  source = replace(source, 'const inert = sessionId === void 0 || hero && chipTitle === void 0;', 'const inert = sessionId === void 0 || hero && chipTitle === void 0 && !projectless;')
  // Supply the draft predicate to the existing factory's inject face.
  source = replace(source, 'selectWorkspace: (workspaceId) => workspaceNavigation.openWorkspace', `isProjectlessSession: (sessionId) => ctx.bail("projectless/is-session", sessionId) === true,
    projectlessLabel: () => ctx.bail("projectless/label") ?? "No project",
    selectWorkspace: (workspaceId) => workspaceNavigation.openWorkspace`)
  const chipStart = source.indexOf('(0, react_jsx_runtime.jsx)(WorkspaceChip, {')
  const chipEnd = source.indexOf('renderSlot("conversation.hero.workspace", {', chipStart)
  if (chipStart < 0 || chipEnd < 0) throw new Error('Workspace chip anchor is missing')
  const chip = source.slice(chipStart, chipEnd).trim().replace(/,$/, '')
  source = replace(source, source.slice(chipStart, chipEnd), `(0, react_jsx_runtime.jsxs)("span", {
    className: "dsh-projectless-chip-group",
    children: [${chip}, !projectless && chipTitle !== undefined && renderSlot("dsh-codexlike-projectless.entry", {})]
  }),\n`)
  for (const icon of ['IconFolderCloseRegular', 'IconFolderOpenRegular']) {
    const anchor = `_deepseek_ai_dsh_client_ui_primitives.${icon}, {\n\t\t\t\t\t\tclassName: HeroShell_module_css_default.folder,`
    source = replace(source, anchor, anchor.replace('HeroShell_module_css_default.folder,', 'HeroShell_module_css_default.folder + " dsh-projectless-folder",'))
  }
  source = replace(source, '"conversation.hero.workspace": {', `"dsh-codexlike-projectless.entry": { kind: "single", scope: "root" },
    "conversation.hero.workspace": {`)
  source = replace(source, 'hero && heroWorkspaceRow,', 'heroWorkspaceRow,')
  source = replace(source, 'sink(session, text, attachmentIds, mode, signal) {', `sink(session, text, attachmentIds, mode, signal) {
    const intercepted = this.rootCtx.bail("projectless/first-send", session, text, attachmentIds, mode, signal);
    if (intercepted !== undefined) return intercepted;`)
  source = replace(source, 'beginFileUpload(sessionId, attachment) {', `beginFileUpload(sessionId, attachment) {
    if (this.ctx.sessions.isProjectlessDraft?.(sessionId)) {
      this.fileUploads.update(draft => { draft[attachment.id] = {
        status: "ready", receiptId: "projectless-draft:" + attachment.id,
        file: { attachmentId: attachment.id, name: attachment.file.name, size: attachment.file.size, mediaType: attachment.file.type }
      }; });
      return;
    }`)
  source = replace(source, 'async sendSession(session, text, attachmentIds, mode, signal) {', `async sendSession(session, text, attachmentIds, mode, signal) {
    const uploadsBefore = this.fileUploads.getSnapshot();
    const operations = [];
    for (const id of attachmentIds) {
      if (uploadsBefore[id]?.receiptId?.startsWith("projectless-draft:")) {
        const attachment = this.draftAttachments.get(id);
        if (attachment?.kind === "file") {
          this.beginFileUpload(session.sessionId, attachment);
          operations.push(this.fileUploadOperations.get(id).done);
        }
      }
    }
    await Promise.all(operations);
    signal?.throwIfAborted();`)
  source = replace(source, 'if (!(await session.prompt(content, mode, signal, submission.requestId)).ok) return { kind: "error" };', `const admission = await session.prompt(content, mode, signal, submission.requestId);
    if (!admission.ok) return { kind: "error", remoteError: admission.error, requestId: submission.requestId };`)
  return source
}

export function patchWorkspace(source) {
  source = replace(source, 'this.replaceMain(target, this.lifetime.signal, "reveal");',
    'this.replaceMain(target, AbortSignal.any([this.ctx.layout.beginNavigation(), this.lifetime.signal]), "reveal");')
  source = replace(source, 'async openWorkspace(workspaceId, beforeOpen) {', `async openWorkspace(workspaceId, beforeOpen) {
    if (beforeOpen !== undefined) {
      const intercepted = this.ctx.bail("projectless/select-workspace", workspaceId);
      if (intercepted !== undefined) return await intercepted;
    }`)
  return replace(source, 'startSession(workspaceId) {', `startSession(workspaceId) {
    if (this.ctx.bail("projectless/new-session", workspaceId, this.mainReference?.sessionId) === true) return;`)
}

export function patchTitle(source) {
  source = replace(source, 'onUserMessage(session, event) {', `onUserMessage(session, event) {
    const prepared = this.projectlessBound?.get(session.id);
    if (prepared) {
      this.projectlessBound.delete(session.id);
      Promise.resolve().then(() => {
        if (!this.serviceActive() || this.ctx.sessions.get(session.id) !== session) return;
        for (const [type, data] of prepared.events) session.append(type, { ...data, messageSeqs: [event.seq] });
        session.append("session/title", { title: prepared.title, messageSeqs: [event.seq], source: prepared.source });
      });
      return;
    }`)
  return replace(source, 'get(session) {', `async prepareProjectlessTitle(input, route, sessionId, signal) {
    this.assertServiceActive();
    const events = [];
    const messages = [{ seq: 0, text: input }];
    let result;
    let source = { kind: "fallback" };
    const registration = this.registration;
    if (registration && !registration.closing) {
      try {
        result = await this.track(registration.provider.generate({
          session: { id: sessionId, append: (type, data) => { events.push([type, data]); } },
          messages, route, signal: AbortSignal.any([signal, this.lifetime.signal])
        }), registration);
        result = this.validateResult(result, messages);
        source = { kind: "provider", provider: registration.provider.id, ...result.model ? { model: result.model } : {} };
      } catch (error) {
        signal.throwIfAborted();
        this.lifetime.signal.throwIfAborted();
        this.ctx.logger.warn("projectless title provider failed; using native fallback: " + String(error));
      }
    }
    const title = result?.title ?? (fallbackSessionTitle(input, this.config.fallbackMaxWords, this.config.fallbackMaxBytes) || "Untitled");
    const token = globalThis.crypto.randomUUID();
    this.projectlessPrepared ??= new Map();
    for (const [key, item] of this.projectlessPrepared) if (item.expires < Date.now()) this.projectlessPrepared.delete(key);
    if (this.projectlessPrepared.size >= 64) throw new Error("Too many pending projectless titles");
    this.projectlessPrepared.set(token, { sessionId, title, source, events, expires: Date.now() + 300000 });
    return { token, title, sessionId, source: source.kind };
  }
  bindProjectlessTitle(sessionId, token) {
    const prepared = this.projectlessPrepared?.get(token);
    if (!prepared || prepared.sessionId !== sessionId || prepared.expires < Date.now()) throw new Error("Prepared title expired or belongs to another Session");
    if (!this.ctx.sessions.get(sessionId)) throw new Error("Final Session does not exist");
    this.projectlessPrepared.delete(token);
    this.projectlessBound ??= new Map();
    this.projectlessBound.set(sessionId, prepared);
  }
  get(session) {`)
}

export const patches = {
  'dsh-api-session-controller/lib/client.js': patchSessions,
  'dsh-api-gateway/lib/client.js': patchGateway,
  'dsh-client-ui-conversation/lib/client.js': patchConversation,
  'dsh-client-ui-workspace/lib/client.js': patchWorkspace,
  'dsh-session-title/lib/index.js': patchTitle,
}
