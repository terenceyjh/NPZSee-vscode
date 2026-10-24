# Platform targets

| Target | Rust CPU/OS | Requirements |
| --- | --- | --- |
| win32-x64 | x86_64-pc-windows-msvc | Windows x64 with a compatible VS Code |
| win32-arm64 | aarch64-pc-windows-msvc | Native Windows ARM64 VS Code |
| linux-x64 | x86_64-unknown-linux-gnu | glibc 2.28+ |
| linux-arm64 | aarch64-unknown-linux-gnu | glibc 2.28+, ARM64 |
| darwin-x64 | x86_64-apple-darwin | macOS 13+, Intel |
| darwin-arm64 | aarch64-apple-darwin | macOS 13+, Apple Silicon |

These are six **64-bit** targets. 32-bit x86, ARMv7 and Alpine/musl are not included.
The packaged Rust process is headless; no desktop GUI/OpenGL libraries are linked.
The VS Code runtime itself still needs a supported OS.

Native CI runners build each target and run the Rust and TS-protocol tests.
Linux packages use Zig's glibc 2.28 target; package verification checks the highest
GLIBC symbol version and CPU identity. macOS builds use a 13.0 deployment target.
Windows links the C runtime statically.

Windows x64 is additionally tested in an actual VS Code webview, including six
languages, inline details, file-watch/reload, large-array plots and cleanup.
Native backend tests on another OS do not constitute manual GUI validation on
that OS. Local reports in `validation-output/` and CI results document actual runs.

For a remote workspace, install the target matching the workspace extension host,
such as Linux x64 for WSL on a Windows client. The Rust process runs alongside the
data and messages carry bounded display results. Full remote GUI interaction has
its own validation boundary; browser-only/virtual filesystem hosts are unsupported.
