# VS Code release roadmap

Adapted from the desktop release roadmap on 2026-10-24. This repository contains
only the VS Code version; the desktop project is maintained separately.

1. **Identity** — NPZSee product name; NPZSee-vscode repository; lower-case
   `npzsee` Marketplace extension name; registered publisher `TerenceYang`.
2. **Public source repository** — self-contained source, GPL-3.0-or-later, upstream
   npyquick credit, accurate features/performance, licenses and build instructions.
3. **Viewer polish** — general NumPy/multidimensional wording; a persistent details
   panel inside Table; six UN languages with an in-view selector and Arabic RTL.
4. **Prebuilt distributions** — six OS/CPU VSIX packages, verified architecture,
   matching source archive and checksums. Python wheels belong to the desktop
   project, not this extension.
5. **GitHub** — publish the source repository; build six packages in native CI;
   attach artifacts and matching sources to a Release after successful checks.
6. **Visual Studio Marketplace** — prepare listing, icon, screenshots and an upload
   guide. Publisher is registered; 0.2.1 packages use that ID. The next user step
   is uploading those packages from New extension → Visual Studio Code.

Implementation and actual validation results are recorded in `agent.md`. CI
configuration alone is not treated as evidence that a target has passed.
