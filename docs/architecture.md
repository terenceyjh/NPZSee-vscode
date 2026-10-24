# VS Code architecture

The extension is a separate source copy of the desktop project. Its default Rust
target is headless; egui, windowing, font loading and desktop dialogs are not
linked into the backend. No runtime Python, npm package or local HTTP server is
required by the installed extension.

## Ownership

- `data.rs` owns NPY parsing, fixed-width dtype semantics and mapped storage.
- `analysis.rs` owns envelope building, view-dependent decimation and histograms.
- `service.rs` owns a file catalog, bounded array cache and current series index.
- `backend.rs` serializes file work on a worker thread. Its input reader can
  invalidate ongoing work immediately using an atomic generation counter.
- The extension creates one backend per custom document. Different files have
  independent work queues, caches and cancellation. Closing the last view disposes
  the document and terminates its child process.
- A single file uses one editor view at a time; moving it between editor groups
  avoids conflicting cancellation from multiple views of the same session.
- The webview owns presentation and view preferences. It never receives the full
  large array and never computes whole-array statistics or decimation in JS.

## Protocol 1

Each UTF-8 line is one JSON object. Request:

```json
{"id":1,"method":"table","params":{"array":0,"prefix":[1,2],"start":0,"count":100,"columnStart":0,"columnCount":8}}
```

Success: `{"id":1,"result":{...}}`; failure: `{"id":1,"error":"..."}`.
Only stdout contains protocol data. Requests are limited to 64 KiB and unknown
fields/methods are rejected. Bounds are validated before accessing slice functions.

| Method | Work |
| --- | --- |
| `open`, `reload` | Catalog without decoding member payloads; reload clears caches |
| `select` | Load/map one array and return shape/dtype information |
| `table` | Scalar, empty, subarray list, matrix or vector; at most 200×16 cells |
| `cell` | Exact text at full logical indices |
| `plot` | Build/reuse Rust envelope and return current-range points |
| `sample` | Original sample text and numeric plot coordinate |
| `histogram` | Sampled or exact Rust histogram and statistics |
| `cancel` | Invalidate running and queued work without waiting for its completion |

Table/cell values preserve int64/uint64 as strings. Nonfinite chart coordinates
serialize as null and produce line breaks. Statistics with no finite values use
null for undefined metrics. Chart computations use float64, as in the desktop
core; exact integer inspection belongs to Table.

Scalar/cell text previews are limited to 2 million Unicode characters and labelled
when truncated. Table cells show 240 characters; clicking accesses the larger
preview. JSON is presented as a lazy tree; raw copy preserves original text.

## Host behavior

The backend is bundled under `bin/<platform>-<arch>/`, never loaded from a workspace
setting or external PATH. Shell invocation is not used for backend startup.
File watchers close mappings when changes/deletion/creation are detected; Reload
creates a fresh session. Writers should finish writing before browsing/reloading,
especially for directly mapped NPY files.

The extension runs as a workspace extension, so local files use local binaries
and SSH/WSL/container files use binaries in the remote extension host. This design
does not implement arbitrary virtual filesystem providers or pure browser hosts.
