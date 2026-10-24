# NPZSee for VS Code 0.2.1

Download a VSIX and install it directly in VS Code. No Python installation is
required. NPZSee is a read-only multidimensional NumPy viewer powered by Rust.

**Windows Intel/AMD:** [Download Windows x64](https://github.com/terenceyjh/NPZSee-vscode/releases/download/v0.2.1/NPZSee-vscode-0.2.1-win32-x64.vsix).
For Windows ARM, Linux or macOS, choose the matching `.vsix` under Assets.

In VS Code open **Extensions → … → Install from VSIX…**, select the downloaded
file, then open a `.npy` or `.npz` file. Keep the `.vsix` file intact; Source code
downloads are for development and cannot be installed as an extension.

- New NPZSee identity and independent NPZSee-vscode repository.
- Inline Table details: click another cell to update the panel without a modal.
- Chinese, English, French, Spanish, Russian and Arabic with an in-view selector.
- On-demand arrays, exact text values, multidimensional navigation and JSON.
- Rust waveform decimation, original index readouts, sampled/exact histograms and SVG.
- Native VSIX targets for Windows, Linux and macOS on x64 and ARM64.

These packages use the registered publisher **TerenceYang**, extension ID
**TerenceYang.npzsee**, and can also be used for the first Marketplace upload.
Marketplace publication remains a separate step. Uninstall older local previews
(`npzsee-local.npzsee` / `npzview-local.npzview`) when migrating.
A matching source archive and checksums are included; private input data and
credentials are excluded.

See the repository's platform documentation for OS requirements and validation
boundaries. Runtime tests on a native CI host and manual GUI testing are distinct.
