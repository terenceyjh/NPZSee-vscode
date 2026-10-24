# Contributing

Contributions are accepted under GPL-3.0-or-later. Retain existing copyright and
license notices; record third-party code and assets in NOTICE / LICENSES.

Use Rust 1.96+, a platform linker, Node.js 22+ and npm. The VS Code backend
does not require desktop graphics libraries or Maturin. Run in this directory:

```
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
npm ci
npm run build:backend
npm run check
npm run build
npm test
npm run test:i18n
npm run test:ui
npm run test:vscode
```

The backend build script keeps outputs in this project's target directory.
Detailed test setup and the private-recording boundary are in docs/testing.md.

Keep experimental recordings, metadata values, account credentials, local tools
and validation output out of commits and release archives. Fixtures should be
synthetic. New storage behavior should be checked against NumPy; UI changes
should also be visually checked. Document approximations in the interface.

This repository is self-contained; no sibling desktop or upstream checkout is
required. The desktop version is maintained separately.

The packaging tool temporarily uses `@azure/identity` 4.13.0 within vsce's supported
range to avoid its newer dependency on MSAL Node 6, affected by
[GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5).
Review the override when Azure Identity supports the patched MSAL release.
MSAL's UUID dependency is pinned to the patched CommonJS-compatible 11.1.1;
the packaging dependency uses its unchanged `v4()` API.
These are development dependencies and are excluded from VSIX runtime files.
