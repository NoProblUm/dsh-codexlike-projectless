// Adapted from @linxin666/dsh-client-ui-git-graph 0.4.6 (Apache-2.0).
// See THIRD_PARTY_NOTICES.md and licenses/git-graph-Apache-2.0.txt.
// Only this pinned route is rebound; third-party installation bytes are untouched.
export const graph046Source = "(workspaceId) => {\n\t\t\t\tconst target = resolveTarget(workspaceId);\n\t\t\t\tif (target === void 0) {\n\t\t\t\t\toriginal.call(navigation);\n\t\t\t\t\treturn;\n\t\t\t\t}\n\t\t\t\tif (routing.has(target)) return;\n\t\t\t\trouting.add(target);\n\t\t\t\t(async () => {\n\t\t\t\t\tconst configResult = await git.config();\n\t\t\t\t\tif (!configResult.ok || !configResult.value.autoIsolate) {\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tconst config = configResult.value;\n\t\t\t\t\tconst item = registry.list.getSnapshot().items.find((entry) => entry.workspaceId === target);\n\t\t\t\t\tif (item === void 0) {\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tconst home = config.worktreesHome;\n\t\t\t\t\tif (item.path.startsWith(home + \"/\") || item.path.startsWith(home + \"\\\\\")) {\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tconst status = await git.status(item.path);\n\t\t\t\t\tif (!status.ok || status.value === null) {\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tconst name = `s-${Date.now().toString(36)}`;\n\t\t\t\t\tconst baseRef = config.autoBaseline === \"default\" ? \"origin/HEAD\" : void 0;\n\t\t\t\t\tconst created = await git.addWorktree(item.path, name, baseRef);\n\t\t\t\t\tif (!created.ok) {\n\t\t\t\t\t\tconsole.warn(`${TAG} worktree creation failed; starting the session in the main checkout instead`, created.error);\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tlet registeredId;\n\t\t\t\t\ttry {\n\t\t\t\t\t\tconst workspace = await registry.create({ path: created.value.path });\n\t\t\t\t\t\tregisteredId = workspace.workspaceId;\n\t\t\t\t\t\toriginal.call(navigation, workspace.workspaceId);\n\t\t\t\t\t} catch (error) {\n\t\t\t\t\t\tif (registeredId !== void 0 && typeof registry.delete === \"function\") try {\n\t\t\t\t\t\t\tawait registry.delete(registeredId);\n\t\t\t\t\t\t} catch (cleanupError) {\n\t\t\t\t\t\t\tconsole.warn(`${TAG} could not drop the failed workspace registration`, cleanupError);\n\t\t\t\t\t\t}\n\t\t\t\t\t\tawait git.removeWorktree(item.path, created.value.path, { force: true });\n\t\t\t\t\t\tconsole.warn(`${TAG} workspace registration failed; rolled back the worktree`, error);\n\t\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t\t}\n\t\t\t\t})().catch((error) => {\n\t\t\t\t\tconsole.warn(`${TAG} routing failed; using the official behavior`, error);\n\t\t\t\t\toriginal.call(navigation, target);\n\t\t\t\t}).finally(() => {\n\t\t\t\t\trouting.delete(target);\n\t\t\t\t});\n\t\t\t}"
export function bindGraph046(original: (...args: any[]) => any, navigation: any, registry: any, git: any, routing: Set<string>, resolveTarget: (id?: string) => string | undefined) {
  const TAG = '[git-graph] auto-isolation'
  const routed = (workspaceId?: string) => {
				const target = resolveTarget(workspaceId);
				if (target === void 0) {
					original.call(navigation);
					return;
				}
				if (routing.has(target)) return;
				routing.add(target);
				(async () => {
					const configResult = await git.config();
					if (!configResult.ok || !configResult.value.autoIsolate) {
						original.call(navigation, target);
						return;
					}
					const config = configResult.value;
					const item = registry.list.getSnapshot().items.find((entry: any) => entry.workspaceId === target);
					if (item === void 0) {
						original.call(navigation, target);
						return;
					}
					const home = config.worktreesHome;
					if (item.path.startsWith(home + "/") || item.path.startsWith(home + "\\")) {
						original.call(navigation, target);
						return;
					}
					const status = await git.status(item.path);
					if (!status.ok || status.value === null) {
						original.call(navigation, target);
						return;
					}
					const name = `s-${Date.now().toString(36)}`;
					const baseRef = config.autoBaseline === "default" ? "origin/HEAD" : void 0;
					const created = await git.addWorktree(item.path, name, baseRef);
					if (!created.ok) {
						console.warn(`${TAG} worktree creation failed; starting the session in the main checkout instead`, created.error);
						original.call(navigation, target);
						return;
					}
					let registeredId;
					try {
						const workspace = await registry.create({ path: created.value.path });
						registeredId = workspace.workspaceId;
						original.call(navigation, workspace.workspaceId);
					} catch (error) {
						if (registeredId !== void 0 && typeof registry.delete === "function") try {
							await registry.delete(registeredId);
						} catch (cleanupError) {
							console.warn(`${TAG} could not drop the failed workspace registration`, cleanupError);
						}
						await git.removeWorktree(item.path, created.value.path, { force: true });
						console.warn(`${TAG} workspace registration failed; rolled back the worktree`, error);
						original.call(navigation, target);
					}
				})().catch((error) => {
					console.warn(`${TAG} routing failed; using the official behavior`, error);
					original.call(navigation, target);
				}).finally(() => {
					routing.delete(target);
				});
			};
  return routed
}
