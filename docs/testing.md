# Verification

Use Python with NumPy for synthetic fixtures and independent numeric validation.
The installed extension has no Python dependency.

```powershell
$env:CARGO_TARGET_DIR = Join-Path (Get-Location) 'target'
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
npm run build:backend
npm run check
npm run build
npm test
npm run test:i18n
npx playwright install chromium
npm run test:ui
npm run test:vscode
```

Run these sequentially: fixture generation rewrites test files and backend builds
replace executables, which should not happen while an editor test is using them.

- Rust tests retain storage/dtype/order, corruption, cancellation, spike and
  histogram regression cases from the desktop core.
- `npm test` tests the production TS process client against the real Rust binary:
  exact integers, slices, all matrix columns, Unicode/JSON, malformed requests,
  XY, complex components, nonfinite values, cancellation and lifecycle.
- If a private recording is present in `data/`, its 12.5-million-sample `voltage`
  array is exercised, including the last row and exact histogram counts. Otherwise
  that test is explicitly skipped. Private values are never printed in reports.
- `test:ui` uses the actual built interface connected to Rust with a minimal host
  harness. It checks actual clicks, navigation, SVG contents, state restoration,
  narrow layout, unsafe-text display and browser exceptions.
- `test:vscode` uses a dedicated downloaded VS Code and isolated project-local
  user/extension directories. The same interaction suite runs in its real
  webview, followed by file-watch/reload and document-disposal assertions.

`NPZSEE_CODE` can specify an existing executable; otherwise the test runner uses
`@vscode/test-electron` to download the version selected by
`NPZSEE_VSCODE_VERSION` (default stable). All local logs/screenshots/reports are
ignored under `validation-output/`. Development windows exit automatically.

For a separate NumPy oracle of the inherited core:

```powershell
cargo build --release --locked --features bench --bin npzsee-bench
python native/validate_numpy.py --recording 'data/your-recording.npz'
```

The actual local results and limitations for this iteration are recorded in
`agent.md`. The CI definition is configuration, not evidence that all platforms
have already run successfully.
