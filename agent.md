# NPZSee-vscode development record

## 2026-10-24 — release preparation

User direction: work only on the VS Code version, preserve the Rust core, adopt
NPZSee / NPZSee-vscode, follow the desktop roadmap with Marketplace replacing PyPI.
The desktop version is being handled independently and was not edited.

- Created a standalone repository from the existing VS Code project. Removed
  desktop-only code/assets/helpers from the release source by archiving local
  copies under ignored `.tools/desktop-reference`; no original project was moved.
- Renamed the Rust crate/backend, extension/command identities and product copy.
- Added an in-Table details panel, exact values/copy, six UI languages, persistent
  language configuration, manifest translations and Arabic RTL. Raw array names
  and values are not translated. Structured error codes localize user messages
  while preserving original diagnostics under Technical details.
- Kept parsing, extraction, mmap, caching, slicing, envelope calculation and
  histograms in Rust. The webview still consumes bounded responses.
- Added PNG icon, synthetic-data screenshots, English/Chinese README, GPL credit,
  a Marketplace guide and adapted roadmap. Publisher registration remains a user
  step; `npzsee-local` is temporary, and no store upload is authorized yet.
- Added native six-target CI, glibc 2.28 Linux builds, VSIX CPU validation,
  corresponding-source bundling and a GitHub prerelease workflow.
- Current local checks: TS type checking, backend protocol groups, translation
  completeness/placeholder checks and 22 browser interaction groups pass. Further
  native CI, installed-package and actual VS Code checks are recorded below.
