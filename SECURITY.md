# Security and data handling

npzsee reads local NumPy files without executing pickle. Object arrays are
rejected with an explanation. ZIP member names are never used as extraction
paths; decoded arrays use anonymous temporary files. Header size, arithmetic,
payload lengths and ZIP CRC are checked. The application does not upload data.

Compressed arrays need temporary disk space. Bare NPY files are mapped read-only;
avoid externally truncating or replacing an open mapped file. Close/reload after
the producer finishes writing. The installed VS Code extension uses a bundled
headless backend and displays bounded responses in an isolated webview; it does
not start an HTTP server or select executables from workspace configuration.

Before public release, configure private vulnerability reporting on the actual
repository's Security tab. Use that channel for sensitive reports; do not attach
private recordings or credentials to public issues. No reporting email or
repository URL is invented in this template.

Release preparation should refresh dependency advisories and preserve licenses,
checksums and the matching source bundle. Local testing is not a guarantee that
every platform or graphics driver has been exercised.
