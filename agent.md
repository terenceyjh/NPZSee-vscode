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

### Verified release-preparation results

- Rust formatting, strict Clippy and 20 storage/analysis/protocol tests passed locally.
- Six backend-client test groups and three translation tests passed. The browser
  suite passed 22 interaction groups, including six languages and Arabic layout.
- Actual VS Code 1.143.1 passed the same 22 groups in both development mode and
  with the installed Windows x64 VSIX. File-watch/reload, exact integer values,
  backend cleanup and document disposal passed. A private 12.5-million-sample
  recording passed last-page, waveform and exact-histogram checks; it is excluded
  from source control, packages and public screenshots.
- All six native OS/CPU CI builds passed in workflow run
  https://github.com/terenceyjh/NPZSee-vscode/actions/runs/40090753255.
  The Intel macOS runner initially failed downloading Rust because of DNS; its
  retry passed. Each target ran Rust tests, TS protocol tests, translations,
  independent NumPy validation, packaging and binary CPU checks. This does not
  imply manual GUI testing on all six platforms.
- The corresponding source archive resolved all 42 packages and rebuilt its Rust
  release backend offline with vendored dependencies and an empty Cargo cache.
- OSV checked 41 locked Rust dependencies with no findings. Packaging dependency
  overrides remove the reported MSAL/UUID advisories; npm reports zero findings.
  The CommonJS UUID API used by the packaging authentication dependency passed
  a direct smoke check. Runtime VSIX files contain no npm dependencies.
- Public source: https://github.com/terenceyjh/NPZSee-vscode. Private vulnerability
  reporting is enabled. No Marketplace upload has been performed; final publisher
  identity and rebuilding store packages remain dependent on user registration.

## 2026-10-24 — registered publisher and installable Release

The user's Marketplace screenshot shows publisher Jinghao Yang (TerenceYang),
with Owner access. Configured `TerenceYang.npzsee`, bumped package/core versions
to 0.2.1 and switched tagged GitHub builds to a regular Release. Added direct
six-platform download links and explicit Install from VSIX instructions. The
Marketplace guide now starts at New extension → Visual Studio Code. No account
credentials are required for packaging, and no Marketplace upload was performed.
The data engine and viewer behavior are unchanged from the tested 0.2.0 version.
Integration tooling now resolves the extension identity from the manifest and
handles VS Code's lower-cased installation folder names.
