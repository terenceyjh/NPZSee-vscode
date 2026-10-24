# Changelog

## 0.2.0 NPZSee for VS Code — 2026-10-24

- Adopted NPZSee / NPZSee-vscode and created an independent public GPL repository.
- Added an inline Table details panel with exact-value copy and long-text/JSON navigation.
- Added Chinese, English, French, Spanish, Russian and Arabic, an in-view language selector,
  persistent preferences, localized commands/errors and Arabic right-to-left layout.
- Preserved the Rust data and analysis core; removed desktop-only source and dependencies.
- Added six native OS/CPU builds, platform-specific VSIX checks and matching source bundles.
- Added synthetic-data listing screenshots, a PNG icon and Marketplace publishing guidance.
- Kept a temporary local publisher pending account registration; no Marketplace upload.

## 0.1.0 VS Code local preview — 2026-10-24

- Independent project copied from the desktop version; original desktop tree unchanged.
- Headless Rust backend retains parsing, mmap, extraction, cache, slicing and analysis.
- Read-only custom editor with TS bridge, bounded messages, cancellation and cleanup.
- Paged exact-value tables, large integer text, lazy JSON, multidimensional navigation.
- Interactive Canvas plot/histogram, original sample readouts, log axes and SVG export.
- File-change detection/reload and saved per-file view state.
- Local Windows x64 VSIX, platform build CI and automated real-webview validation.
- Provisional name/publisher; no Marketplace publishing.

## 0.1.0 — 2026-10-24

- Earlier desktop release preparation, derived from npyquick (historical context).
- Rust/egui rewrite with background NumPy loading and mapped data access.
- Array sidebar; Table / Plot / Histogram tabs, with Table selected initially.
- Hierarchical multidimensional browsing and readable Unicode/JSON metadata.
- Screen-width waveform envelopes and sampled/exact histograms with area fill.
- SVG export, complex components, zoom/pan and log axes.
- Maturin binary wheels, pip command installation and bundled OFL CJK font.
- Updated ZIP reader to 9.0.5 after checking current RustSec advisories.
- Target matrix: Windows, Linux and macOS on x86_64 and ARM64.
  See docs/cross-platform.md for actual build/run validation status.

Upstream base: LiukDiihMieu/npyquick commit 6be16fd. This release is a renamed
derivative project under GPL-3.0-or-later; it is not an upstream npyquick release.
