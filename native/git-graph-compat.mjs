/** Version-specific seam for Git Graph 0.4.4 on DSH 0.2.0-rc.2. */
export function patchGitGraph(source, version) {
  if (version !== '0.4.4') throw new Error(`Unsupported Git Graph version: ${version}`)
  const before = 'const routed = (workspaceId) => {'
  const after = `${before}
        if (workspaceId === void 0 && navigation.ctx.bail("projectless/is-session", navigation.mainReference?.sessionId) === true) {
          original.call(navigation);
          return;
        }`
  if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error('Unsupported Git Graph compatibility anchor')
  }
  return source.includes(after) ? source : source.replace(before, after)
}
