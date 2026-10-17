window.__ModuleLoader__.load({
  id: 'dsh-runtime-adapter-probe',
  factory: require => {
    const React = require('react')
    return {
      inject: ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'conversation', 'remote', 'connection'],
      apply(ctx) {
        const trace = []
        const restores = []
        const drafts = new Map()
        const manager = ctx.sessions.manager
        let active = true
        const raw = value => value?.[Symbol.for('cordis.original')] ?? value
        const record = (event, facts = {}) => trace.push({ event, at: performance.now(), ...facts })
        const wrap = (target, key, replacement) => {
          target = raw(target)
          const descriptor = Object.getOwnPropertyDescriptor(target, key)
          const original = target[key]
          if (typeof original !== 'function') throw new Error('Missing runtime method: ' + key)
          const installed = function (...args) { return replacement.call(this, original, args) }
          target[key] = installed
          if (target[key] !== installed) throw new Error('Runtime method is not writable: ' + key)
          restores.push(() => {
            if (target[key] !== installed) return
            if (descriptor) Object.defineProperty(target, key, descriptor)
            else delete target[key]
          })
        }
        const owns = id => drafts.has(id)
        const phases = () => ({ sessions: ctx.sessions.list.getSnapshot().phase, workspaces: ctx.workspaces.list.getSnapshot().phase })
        try {
        record('installed', phases())

        // Record navigation before any model catalog or remote namespace is awaited.
        wrap(ctx.uiWorkspace, 'restoreSelection', function (original, args) {
          record('restore.enter', phases())
          const saved = localStorage.getItem('dsh-runtime-adapter-probe.projectless') === 'true'
          const summary = this.selection.getSnapshot().sessionId
          const history = summary && args[1].byId[summary]
          if (active && saved && (!history || history.blank)) {
            record('restore.intercepted')
            return Promise.resolve()
          }
          return original.apply(this, args)
        })
        for (const method of ['initializeDefaultWorkspace', 'connectWorkspace', 'startSession']) {
          wrap(ctx.uiWorkspace, method, function (original, args) {
            record('navigation.' + method)
            return original.apply(this, args)
          })
        }

        // Protect the manager's pre-publication summaries, not a later UI subscription.
        wrap(manager, 'buildListSnapshot', function (original, args) {
          if (active) for (const row of drafts.values()) {
            if (!this.summaries.some(item => item.sessionId === row.sessionId)) this.summaries.push(row)
          }
          return original.apply(this, args)
        })
        wrap(manager, 'refreshProjections', function (original, args) {
          return owns(args[0]) ? Promise.resolve() : original.apply(this, args)
        })
        wrap(manager, 'createSession', function (original, args) {
          const session = original.apply(this, args)
          if (owns(args[0])) {
            wrap(session, 'doOpen', function () {
              if (!active) throw new Error('Retired local draft')
              this.openState = 'open'
              this.notifier.markDirty()
              record('draft.open.local')
              return Promise.resolve()
            })
          }
          return session
        })
        // This is a probe-owned method, never a production escape hatch for RPC.
        wrap(ctx.remote, 'invoke', function (original, args) {
          const prepared = this.prepareInvocation(...args)
          if (Object.values(prepared.args).some(owns)) {
            record('draft.rpc.blocked', { endpoint: args[0].namespace + '/' + args[0].name })
            return Promise.resolve({ ok: false, error: { code: 'probe/draft-only', message: 'Probe blocks draft RPC', details: {} } })
          }
          return original.apply(this, args)
        })

        const core = raw(ctx.slots._core)
        const patchFactory = () => {
          const definition = core.factory('conversation.content')
          if (!definition || definition.component.__runtimeProbe) return
          const Original = definition.component
          function ProbeContent(props) {
            const renderSlot = (name, owner, ...rest) => {
              if (owns(props.sessionId) && name === 'conversation.composer.bar') {
                record('view.native-input')
                owner = { ...owner, disabled: false, placeholder: '运行时原生输入验证' }
              }
              return props.renderSlot(name, owner, ...rest)
            }
            return React.createElement(Original, { ...props, renderSlot })
          }
          ProbeContent.__runtimeProbe = true
          definition.component = ProbeContent
          restores.push(() => { if (definition.component === ProbeContent) definition.component = Original })
          // Preserve the definition identity and the owning child-slot declarations.
          core.markFactoryDirty(core.factoryRecord('conversation.content'))
          record('view.factory-wrapped')
        }
        patchFactory()
        const stopFactory = core.subscribeFactory('conversation.content', patchFactory)
        restores.push(stopFactory)

        const createDraft = values => {
          if (!active) throw new Error('Inactive probe')
          const id = 'projectless-draft-' + crypto.randomUUID()
          const row = { sessionId: id, updatedAt: Date.now(), running: false, blank: true, agentAvailable: true }
          drafts.set(id, row)
          manager.recordMutation({ kind: 'placeholder', summary: row })
          manager.projectionStore(id).seed({ asOfSeq: 0, values })
          ctx.sessions.projectList()
          ctx.uiWorkspace.openSession(id)
          record('draft.created', { id })
          return id
        }
        globalThis.__DSH_RUNTIME_PROBE__ = {
          trace,
          phases,
          createDraft,
          sessions: ctx.sessions,
          workspaces: ctx.workspaces,
          navigation: ctx.uiWorkspace,
          conversation: ctx.conversation,
          remote: ctx.remote,
          connection: ctx.connection,
          ownIds: () => [...drafts.keys()],
          refreshList: () => raw(manager).refreshList(),
          inspect: () => ({ phases: phases(), trace: [...trace], draftIds: [...drafts.keys()], sessions: ctx.sessions.list.getSnapshot(), workspaces: ctx.workspaces.list.getSnapshot() }),
        }
        ctx.inject(['remote.session'], scope => {
          globalThis.__DSH_RUNTIME_PROBE__.hostList = () => scope.remote.session.list({})
        })
        ctx.effect(() => () => {
          active = false
          for (const id of drafts.keys()) manager.handleSessionRemoved(id)
          drafts.clear()
          for (const restore of restores.reverse()) restore()
          delete globalThis.__DSH_RUNTIME_PROBE__
        })
        } catch (error) {
          active = false
          for (const restore of restores.reverse()) restore()
          globalThis.__DSH_RUNTIME_PROBE__ = { inspect: () => ({ error: String(error), stack: error.stack, trace, slotsKeys: Object.getOwnPropertyNames(ctx.slots), remoteKeys: Object.getOwnPropertyNames(ctx.remote) }) }
        }
      },
    }
  },
})
