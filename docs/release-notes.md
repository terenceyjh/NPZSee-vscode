NPZSee is a read-only multidimensional NumPy viewer for VS Code, powered by Rust.

- New NPZSee identity and independent NPZSee-vscode repository.
- Inline Table details: click another cell to update the panel without a modal.
- Chinese, English, French, Spanish, Russian and Arabic with an in-view selector.
- On-demand arrays, exact text values, multidimensional navigation and JSON.
- Rust waveform decimation, original index readouts, sampled/exact histograms and SVG.
- Native VSIX targets for Windows, Linux and macOS on x64 and ARM64.

These pre-Marketplace packages use the temporary publisher `npzsee-local`.
Install through Extensions → … → Install from VSIX. A final publisher will be
configured before the store release. A matching source archive and checksums are
included; private input data and credentials are excluded.

See the repository's platform documentation for OS requirements and validation
boundaries. Runtime tests on a native CI host and manual GUI testing are distinct.
