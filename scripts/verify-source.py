# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import json,os,subprocess,tarfile,argparse
parser=argparse.ArgumentParser(description='Resolve or rebuild the matching Rust source without network access')
parser.add_argument('--build',action='store_true',help='Also build the release backend from vendored sources')
arguments=parser.parse_args()
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
archive=root/'dist'/f'NPZSee-vscode-{version}-source.tar.gz'
destination=root/'.tools'/'source-verification'
destination.mkdir(parents=True,exist_ok=True)
with tarfile.open(archive) as source:source.extractall(destination,filter='data')
project=destination/f'NPZSee-vscode-{version}'
empty_home=destination/'empty-cargo-home';empty_home.mkdir(exist_ok=True)
environment={**os.environ,'CARGO_HOME':str(empty_home),'CARGO_TARGET_DIR':str(project/'target')}
result=subprocess.run(['cargo','metadata','--offline','--locked','--format-version','1'],cwd=project,env=environment,capture_output=True,text=True,encoding='utf-8',check=True)
packages=json.loads(result.stdout)['packages']
print(f'Matching source verified offline: {len(packages)} packages resolved with an empty Cargo cache')
if arguments.build:
    subprocess.run(['cargo','build','--offline','--locked','--release','--bin','npzsee-backend'],cwd=project,env=environment,check=True)
    print('Matching Rust backend rebuilt offline from vendored source')
