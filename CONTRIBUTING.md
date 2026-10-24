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
npm run test:ui
npm run test:vscode
```

The backend build script keeps outputs in this project's target directory.
Detailed test setup and the private-recording boundary are in docs/testing.md.

Keep experimental recordings, metadata values, account credentials, local tools
and validation output out of commits and release archives. Fixtures should be
synthetic. New storage behavior should be checked against NumPy; UI changes
should also be visually checked. Document approximations in the interface.

The sibling npzsee directory is the desktop project and npyquick is the upstream
snapshot. This extension project can be developed independently of both.
