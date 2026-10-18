"""Build a separate, owner-deployable probe artifact; never modify production dist."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from build import catalogs, icon
from https_spike.server import origin
from scripts.catalogs import messages

FILES = {'index.html', 'app.js', 'style.css', 'i18n.js', 'catalogs.js', 'config.js',
         'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png'}


def validate_shell(output):
    source = ROOT / 'https_spike/ui/sw.js'
    worker = (output / 'sw.js').read_text()
    match = re.search(r'const RELEASE = (.*);', worker)
    if not match:
        raise ValueError('Missing offline release')
    release = json.loads(match[1])
    names = sorted(FILES - {'sw.js'})
    expected = [{'path': name, 'sha256': hashlib.sha256((output / name).read_bytes()).hexdigest()}
                for name in names]
    config = (output / 'config.js').read_text()
    identity = hashlib.sha256(source.read_bytes())
    for name in names:
        content = config.splitlines(keepends=True)[0].encode() if name == 'config.js' else (output / name).read_bytes()
        identity.update(name.encode() + b'\0' + content)
    version = 'v1-' + identity.hexdigest()
    if (release != {'version': version, 'assets': expected}
            or worker != source.read_text().replace('null /* OFFLINE_RELEASE */', json.dumps(release, sort_keys=True))
            or config.splitlines()[1:] != ['self.SPIKE_SHELL_VERSION = ' + json.dumps(version) + ';']):
        raise ValueError('Incomplete or obsolete offline release')


def build(device_origin, output=None):
    origin(device_origin)
    output = output or ROOT / 'local/https-spike/site'
    if output.is_symlink():
        raise ValueError('Redirected output')
    output.mkdir(parents=True, exist_ok=True)
    if any(p.is_symlink() or p.name not in FILES for p in output.iterdir()):
        raise ValueError('Unexpected output entry')
    source = ROOT / 'https_spike/ui'
    resources = catalogs(source)
    template = (source / 'index.html').read_text()
    for key in re.findall(r'data-i18n="([^"]+)"', template):
        if key not in messages(resources['en']):
            raise ValueError('Missing translation')
    for name in ('app.js', 'style.css', 'manifest.webmanifest'):
        (output / name).write_bytes((source / name).read_bytes())
    (output / 'index.html').write_text(template.replace('DEVICE_ORIGIN', device_origin))
    (output / 'i18n.js').write_bytes((ROOT / 'web/i18n.js').read_bytes())
    (output / 'catalogs.js').write_text('self.PUSH_CATALOGS = ' + json.dumps(resources, ensure_ascii=False) + ';\n')
    (output / 'config.js').write_text('self.SPIKE_ORIGIN = ' + json.dumps(device_origin) + ';\n')
    for size in (192, 512):
        (output / f'icon-{size}.png').write_bytes(icon(size))
    # Explicit schema version plus content identity: every changed asset changes release.
    shell_files = sorted(FILES - {'sw.js'})
    identity = hashlib.sha256()
    identity.update((source / 'sw.js').read_bytes())
    for name in shell_files:
        identity.update(name.encode() + b'\0' + (output / name).read_bytes())
    version = 'v1-' + identity.hexdigest()
    with (output / 'config.js').open('a') as config:
        config.write('self.SPIKE_SHELL_VERSION = ' + json.dumps(version) + ';\n')
    release = {'version': version, 'assets': [
        {'path': name, 'sha256': hashlib.sha256((output / name).read_bytes()).hexdigest()}
        for name in shell_files]}
    worker = (source / 'sw.js').read_text().replace('null /* OFFLINE_RELEASE */', json.dumps(release, sort_keys=True))
    (output / 'sw.js').write_text(worker)
    validate_shell(output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device-origin', required=True)
    args = parser.parse_args()
    build(args.device_origin)
    print('PASS: isolated probe artifact in local/https-spike/site; no deployment performed')
