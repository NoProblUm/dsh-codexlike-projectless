# Third-party notices

The project retains the upstream attribution in NOTICE and LICENSE.

The pinned Git Graph 0.4.6 routing body and its recognition fixture are derived
from @linxin666/dsh-client-ui-git-graph, maintained in
https://github.com/zhu1090093659/dsh-web (packages/dsh-git-graph).
Original module: src/client/auto-isolation.ts; installed package version: 0.4.6.
Licensed under Apache License 2.0; see licenses/git-graph-Apache-2.0.txt.

This distribution adapts that route in src/client/git-graph-046.ts by rebinding
its terminal callback to the current StartSessionOptions. The original Git
Graph installation is not modified. Project selection, duplicate-operation
suppression, config checks, worktree creation and rollback follow the pinned
route; the compatibility adapter supplies the request-local initialization.
