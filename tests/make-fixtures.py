# SPDX-License-Identifier: GPL-3.0-or-later
"""Synthetic public test fixtures; never serialize private recording values."""
from pathlib import Path
import json
import numpy as np

out = Path(__file__).resolve().parents[1] / "validation-output"
out.mkdir(exist_ok=True)
wave = np.sin(np.arange(1_000_001) * .013)
wave[543_210] = 1000.
wave[987_654] = -2000.
fixtures = {
    "wave": wave,
    "metadata_json": np.array(json.dumps({"setup": {"仪器": "测试🙂", "channels": [1, 2]}, "notes": "line one\nline two", "items": list(range(230)), "largeInteger": 2**64-1, "html": "<img src=x onerror=alert(1)>"}, ensure_ascii=False)),
    "cube": np.arange(2*3*4*5).reshape(2,3,4,5),
    "matrix": np.arange(12*35).reshape(12,35),
    "fortran": np.asfortranarray(np.arange(24).reshape(2,3,4)),
    "unsigned": np.array([0, 2**63+1, 2**64-1], dtype='u8'),
    "nonfinite": np.array([np.nan, np.inf, -np.inf, 1.]),
    "empty": np.empty((3,0,2)),
    "complex": np.array([3+4j,-2-1j]),
    "xy_rows": np.array([[10.,20.,30.],[4.,5.,6.]]),
    "xy_columns": np.array([[10.,4.],[20.,5.],[30.,6.]]),
    "unicode": np.array(["中文", "µV/√Hz", "🙂", "two\nlines", "embedded\0nul"]),
    "long_text": np.array('A' * 1200 + '完整文本🙂'),
    "scalar": np.array(42),
    "constant": np.full(200,5.),
    "object_unsupported": np.array({"no": "pickle execution"}, dtype=object),
    "xss_<img src=x onerror=alert(1)>": np.array('<script>alert(1)</script>'),
}
np.savez_compressed(out / "extension-fixtures.npz", **fixtures)
np.save(out / "bare-fortran.npy", fixtures['fortran'])
(out / 'corrupt.npz').write_bytes(b'PK\x03\x04broken data')
print('Generated synthetic extension fixtures')
