# SPDX-License-Identifier: GPL-3.0-or-later
"""Create matching GPL sources with locked Rust dependencies and offline config."""
from pathlib import Path
import io, json, subprocess, tarfile, os
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
vendor=root/'.tools'/'source-vendor'
vendor.parent.mkdir(exist_ok=True)
subprocess.run(['cargo','vendor','--locked',str(vendor)],cwd=root,check=True,stdout=subprocess.DEVNULL)
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
assert any(name=='Cargo.toml' for name in files),'Commit or stage sources before bundling'
destination=root/'dist'/f'NPZSee-vscode-{version}-source.tar.gz'
destination.parent.mkdir(exist_ok=True)
prefix=f'NPZSee-vscode-{version}'
configuration=(root/'.cargo/config.toml').read_text(encoding='utf-8')+'\n[source.crates-io]\nreplace-with = "vendored-sources"\n[source.vendored-sources]\ndirectory = "vendor"\n'
with tarfile.open(destination,'w:gz') as archive:
    for name in files:
        if not name or name=='.cargo/config.toml':continue
        file=root/name
        assert file.is_file(),name
        archive.add(file,arcname=f'{prefix}/{name}')
    archive.add(vendor,arcname=f'{prefix}/vendor')
    data=configuration.encode()
    item=tarfile.TarInfo(f'{prefix}/.cargo/config.toml');item.size=len(data);item.mode=0o644
    archive.addfile(item,io.BytesIO(data))
print(f'Corresponding source: {destination.name} ({destination.stat().st_size} bytes)')
