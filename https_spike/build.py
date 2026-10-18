"""Build a separate, owner-deployable probe artifact; never modify production dist."""
import argparse
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
    for name in ('app.js', 'style.css', 'manifest.webmanifest', 'sw.js'):
        (output / name).write_bytes((source / name).read_bytes())
    (output / 'index.html').write_text(template.replace('DEVICE_ORIGIN', device_origin))
    (output / 'i18n.js').write_bytes((ROOT / 'web/i18n.js').read_bytes())
    (output / 'catalogs.js').write_text('self.PUSH_CATALOGS = ' + json.dumps(resources, ensure_ascii=False) + ';\n')
    (output / 'config.js').write_text('self.SPIKE_ORIGIN = ' + json.dumps(device_origin) + ';\n')
    for size in (192, 512):
        (output / f'icon-{size}.png').write_bytes(icon(size))
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device-origin', required=True)
    args = parser.parse_args()
    build(args.device_origin)
    print('PASS: isolated probe artifact in local/https-spike/site; no deployment performed')
