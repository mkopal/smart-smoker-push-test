"""Build only the explicitly approved static PWA files; no publisher or private inputs."""
import json
from pathlib import Path
import re
import struct
import subprocess
import zlib

from scripts.catalogs import messages, unique_pairs

ROOT = Path(__file__).resolve().parent
SITE_FILES = {'index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest',
              'i18n.js', 'catalogs.js', 'icon-180.png', 'icon-192.png', 'icon-512.png',
              'build-info.json'}


def catalogs(source):
    found = {}
    for path in sorted((source / 'locales').glob('*.json')):
        if not re.fullmatch(r'[a-z]{2,3}(?:-[A-Z]{2})?', path.stem):
            raise ValueError('Invalid locale filename')
        found[path.stem] = json.loads(path.read_text(), object_pairs_hook=unique_pairs)
    if not {'en', 'cs'} <= set(found):
        raise ValueError('English and Czech required')
    canonical = messages(found['en'])
    for catalog in found.values():
        if messages(catalog) != canonical:
            raise ValueError('Catalog mismatch')
    return found


def icon(size):
    """Render a new generic bell from geometric primitives, with no private brand asset."""
    rows = bytearray()
    for row in range(size):
        rows.append(0)
        y = (row + .5) / size
        for column in range(size):
            x = (column + .5) / size
            bell = ((x - .5) ** 2 + (y - .22) ** 2 < .045 ** 2
                    or ((x - .5) / .22) ** 2 + ((y - .46) / .23) ** 2 < 1 and y < .6
                    or .28 < x < .72 and .44 < y < .69
                    or .22 < x < .78 and .68 < y < .75
                    or (x - .5) ** 2 + (y - .82) ** 2 < .065 ** 2)
            rows.extend((240, 246, 250) if bell else (24, 45, 65))
    def chunk(kind, value):
        return struct.pack('!I', len(value)) + kind + value + struct.pack('!I', zlib.crc32(kind + value))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b''))


def validate_site(output):
    if {path.name for path in output.iterdir()} != SITE_FILES:
        raise ValueError('Unexpected static artifact file; refusing deployment')
    for path in output.iterdir():
        if path.is_symlink() or not path.is_file():
            raise ValueError('Redirected static artifact')
    manifest = json.loads((output / 'manifest.webmanifest').read_text())
    if any(manifest[key] != './' for key in ('id', 'start_url', 'scope')):
        raise ValueError('Manifest must stay within its project subpath')
    if manifest['display'] != 'standalone':
        raise ValueError('Home Screen standalone display required')


def build(root=ROOT):
    source, output = root / 'web', root / 'dist'
    if output.is_symlink():
        raise ValueError('Redirected output')
    output.mkdir(exist_ok=True)
    resources = catalogs(source)
    template = (source / 'index.html').read_text()
    for key in re.findall(r'data-i18n="([^"]+)"', template):
        if key not in messages(resources['en']):
            raise ValueError('Missing template translation')
    for name in ('index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest', 'i18n.js'):
        (output / name).write_bytes((source / name).read_bytes())
    (output / 'catalogs.js').write_text('self.PUSH_CATALOGS = ' + json.dumps(resources, ensure_ascii=False) + ';\n')
    for size in (180, 192, 512):
        (output / f'icon-{size}.png').write_bytes(icon(size))
    revision = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, text=True, capture_output=True)
    sha = revision.stdout.strip() if revision.returncode == 0 else 'uncommitted'
    (output / 'build-info.json').write_text(json.dumps({'sourceRevision': sha}) + '\n')
    validate_site(output)
    print('PASS: static artifact contains exactly ' + str(len(SITE_FILES)) + ' approved public files')
    return output


if __name__ == '__main__':
    build()
