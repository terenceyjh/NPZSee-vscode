# SPDX-License-Identifier: GPL-3.0-or-later
"""Verify the local extension artifact without installing it globally."""
from pathlib import Path
import hashlib
import json
import zipfile
import re
import struct

root = Path(__file__).resolve().parents[1]
artifacts = sorted((root / 'dist').glob('*.vsix'))
assert artifacts, 'No VSIX artifact'
for artifact in artifacts:
    with zipfile.ZipFile(artifact) as archive:
        names = archive.namelist()
        manifest = json.loads(archive.read('extension/package.json'))
        assert manifest['name'] == 'npzsee'
        expected=json.loads((root/'package.json').read_text(encoding='utf-8'))
        assert manifest['publisher'] == expected['publisher']
        assert manifest['version'] == expected['version']
        assert not manifest.get('dependencies')
        assert 'extension/out/extension.js' in names
        assert 'extension/out/media/main.js' in names
        assert 'extension/out/media/style.css' in names
        assert 'extension/LICENSE.txt' in names
        assert 'extension/NOTICE' in names
        assert 'extension/assets/icon.png' in names
        assert all(f'extension/package.nls.{language}.json' in names for language in ['zh-cn','fr','es','ru','ar'])
        binaries = [n for n in names if n.startswith('extension/bin/')]
        assert len(binaries) == 1, binaries
        binary=archive.read(binaries[0])
        platform=binaries[0].split('/')[2]
        assert f'TargetPlatform="{platform}"'.encode() in archive.read('extension.vsixmanifest')
        if platform.startswith('win32-'):
            offset=struct.unpack_from('<I',binary,0x3c)[0]
            machine=struct.unpack_from('<H',binary,offset+4)[0]
            assert machine==({'win32-x64':0x8664,'win32-arm64':0xaa64}[platform])
        elif platform.startswith('linux-'):
            assert binary[:4]==b'\x7fELF'
            assert struct.unpack_from('<H',binary,18)[0]==({'linux-x64':62,'linux-arm64':183}[platform])
            versions=[tuple(map(int,value.split(b'.'))) for value in re.findall(rb'GLIBC_([0-9]+\.[0-9]+)',binary)]
            assert not versions or max(versions)<=(2,28),max(versions)
        else:
            assert binary[:4]==b'\xcf\xfa\xed\xfe'
            assert struct.unpack_from('<I',binary,4)[0]==({'darwin-x64':0x1000007,'darwin-arm64':0x100000c}[platform])
        if artifact.name.endswith('win32-x64.vsix'):
            assert binaries[0] == 'extension/bin/win32-x64/npzsee-backend.exe'
            assert archive.read(binaries[0])[:2] == b'MZ'
            assert b'TargetPlatform="win32-x64"' in archive.read('extension.vsixmanifest')
        for name in names:
            assert not set(Path(name).parts) & {'data', '.tools', '.cache', '.git', '.vscode-test', 'target', 'node_modules', 'validation-output'}, name
            assert not name.endswith(('.npz', '.npy', '.env', '.pdb')), name
        report = {'artifact': artifact.name, 'bytes': artifact.stat().st_size, 'files': len(names), 'sha256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'backend': binaries[0], 'private_data_excluded': True}
    (root / 'validation-output').mkdir(exist_ok=True)
    (root / 'validation-output' / 'vsix-check.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
