window.__ModuleLoader__.load({ id: 'dsh-runtime-acceptance', factory: () => ({
  inject: ['sessions', 'workspaces', 'uiWorkspace', 'conversation', 'connection', 'remote'],
  apply(ctx) {
    const events = []
    const sessions = ctx.sessions
    const workspaces = ctx.workspaces
    const off = sessions.list.subscribe(() => events.push({ at: performance.now(), ids: [...sessions.list.getSnapshot().ids] }))
    globalThis.__DSH_ACCEPTANCE__ = {
      events, sessions, workspaces, navigation: ctx.uiWorkspace, conversation: ctx.conversation, connection: ctx.connection,
      snapshot: () => ({ sessions: sessions.list.getSnapshot(), workspaces: workspaces.list.getSnapshot() }),
      status: () => ctx.connection.rpc.call('/api', 'dsh-codexlike-projectless/runtime-status', {}),
    }
    ctx.inject(['remote.session'], scope => { globalThis.__DSH_ACCEPTANCE__.hostList = () => scope.remote.session.list({}) })
    ctx.inject(['remote.pluginManager'], scope => {
      globalThis.__DSH_ACCEPTANCE__.manager = {
        install: spec => scope.remote.pluginManager.installBundle(spec, { requestId: crypto.randomUUID() }),
        enable: (name, enabled) => scope.remote.pluginManager.setBundleEnabled(name, enabled),
        remove: name => scope.remote.pluginManager.removeBundle(name),
        list: () => scope.remote.pluginManager.listBundles(),
      }
    })
    ctx.effect(() => () => { off(); delete globalThis.__DSH_ACCEPTANCE__ })
  },
}) })
