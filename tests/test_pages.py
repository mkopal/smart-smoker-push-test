"""Combined Pages inventory, byte preservation and deployment isolation regressions."""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from urllib.parse import urljoin

import build
import build_pages
from https_spike.build import build as build_spike

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {'index.html', 'style.css', 'app.js', 'sw.js', 'manifest.webmanifest',
              'i18n.js', 'catalogs.js', 'icon-180.png', 'icon-192.png', 'icon-512.png',
              'build-info.json'}
SPIKE_FILES = {'index.html', 'app.js', 'style.css', 'i18n.js', 'catalogs.js', 'config.js',
               'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png'}
DEVICE = 'https://smoker-test.navodio.cz:8443'
APP = 'https://mkopal.github.io'
BASE = APP + '/smart-smoker-push-test/'


def contents(directory):
    return {p.relative_to(directory).as_posix(): p.read_bytes()
            for p in directory.rglob('*') if p.is_file()}


class PagesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.output = build_pages.build(self.root / 'dist')

    def test_exact_inventory_original_bytes_and_repeatability(self):
        baseline = build.build(output=self.root / 'original')
        isolated = build_spike(DEVICE, self.root / 'isolated')
        expected = ROOT_FILES | {'https-spike/' + name for name in SPIKE_FILES}
        combined = contents(self.output)
        self.assertEqual(set(combined), expected)
        self.assertEqual(len(combined), 21)
        self.assertEqual((ROOT / 'PAGES_FILES.txt').read_text().splitlines(), sorted(expected))
        self.assertEqual({name: combined[name] for name in ROOT_FILES}, contents(baseline))
        self.assertEqual(contents(self.output / 'https-spike'), contents(isolated))
        build_pages.build(self.output)
        self.assertEqual(contents(self.output), combined)
        # Adding the spike never relaxes the original builder's root-only validator.
        with self.assertRaises(ValueError):
            build.validate_site(self.output)

    def test_csp_origins_scopes_and_independent_workers(self):
        self.assertEqual(build_pages.APP_ORIGIN, APP)
        self.assertEqual(build_pages.DEVICE_ORIGIN, DEVICE)
        policy = ("default-src 'self'; script-src 'self'; connect-src 'self'{device}; "
                  "worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
        for subpath, device in (('', ''), ('https-spike/', ' ' + DEVICE)):
            app = self.output / subpath
            html = (app / 'index.html').read_text()
            self.assertIn('content="' + policy.format(device=device) + '"', html)
            self.assertNotIn('DEVICE_ORIGIN', html)
            manifest = json.loads((app / 'manifest.webmanifest').read_text())
            for key in ('id', 'start_url', 'scope'):
                self.assertEqual(manifest[key], './')
                self.assertEqual(urljoin(BASE + subpath, manifest[key]), BASE + subpath)
            source = ROOT / ('https_spike/ui' if subpath else 'web')
            for name in ('app.js', 'sw.js', 'manifest.webmanifest'):
                self.assertEqual((app / name).read_bytes(), (source / name).read_bytes())
            self.assertIn("register('./sw.js'", (app / 'app.js').read_text())
            self.assertNotIn("addEventListener('fetch'", (app / 'sw.js').read_text())
        self.assertIn("{ scope: './' }", (self.output / 'https-spike/app.js').read_text())
        self.assertEqual((self.output / 'https-spike/config.js').read_text(),
                         'self.SPIKE_ORIGIN = "' + DEVICE + '";\n')

    def test_missing_extra_and_redirected_entries_fail_closed(self):
        victim = self.output / 'https-spike/config.js'
        original = victim.read_bytes()
        victim.unlink()
        with self.assertRaises(ValueError):
            build_pages.validate_pages(self.output)
        victim.write_bytes(original)
        for name in ('unexpected.txt', 'https-spike/tls.pem', 'https-spike/local/state.json'):
            extra = self.output / name
            extra.parent.mkdir(exist_ok=True)
            extra.write_text('synthetic private marker')
            before = contents(self.output)
            with self.assertRaises(ValueError):
                build_pages.validate_pages(self.output)
            with self.assertRaises(ValueError):
                build_pages.build(self.output)
            self.assertEqual(contents(self.output), before)
            extra.unlink()
            if extra.parent.name == 'local':
                extra.parent.rmdir()
        victim.unlink()
        outside = self.root / 'synthetic.key'
        outside.write_text('synthetic marker')
        victim.symlink_to(outside)
        with self.assertRaises(ValueError):
            build_pages.build(self.output)
        victim.unlink()
        victim.mkdir()
        with self.assertRaises(ValueError):
            build_pages.validate_pages(self.output)
        redirected = self.root / 'redirected'
        redirected.symlink_to(self.output, target_is_directory=True)
        with self.assertRaises(ValueError):
            build_pages.build(redirected)

    def test_wrong_device_csp_or_manifest_is_rejected(self):
        for name, replacement in (
            ('config.js', 'self.SPIKE_ORIGIN = "https://other.example.test:8443";\n'),
            ('index.html', (self.output / 'https-spike/index.html').read_text().replace(DEVICE, '*')),
            ('manifest.webmanifest', '{"id":"./","start_url":"../","scope":"../","display":"standalone"}'),
        ):
            path = self.output / 'https-spike' / name
            original = path.read_bytes()
            path.write_text(replacement)
            with self.assertRaises(ValueError):
                build_pages.validate_pages(self.output)
            path.write_bytes(original)

    def test_workflow_validation_and_main_only_upload_and_deploy(self):
        workflow = (ROOT / '.github/workflows/pages.yml').read_text()
        self.assertIn('  pull_request:\n', workflow)
        self.assertIn('    branches: [main]\n', workflow)
        steps = ['npm test', 'npm run test:library', 'python -m unittest discover -s tests -v',
                 'python build_pages.py', 'python scripts/audit_public.py',
                 'actions/configure-pages@', 'actions/upload-pages-artifact@']
        positions = [workflow.index(step) for step in steps]
        self.assertEqual(positions, sorted(positions))
        gate = "if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'"
        self.assertEqual(workflow.count(gate), 3)
        for action in ('configure-pages', 'upload-pages-artifact'):
            self.assertIn(gate, workflow.split('actions/' + action + '@')[1].split('      - ')[0])
        self.assertIn('  deploy:\n    ' + gate, workflow)
        self.assertIn('          path: dist\n', workflow)

    def test_private_material_remains_ignored(self):
        for name in ('local/https-spike/tls/fullchain.pem', 'local/https-spike/tls/key.pem',
                     'local/https-spike/cloudflare.ini', 'local/https-spike/state.json',
                     'dist/https-spike/config.js', 'accidental.key', 'accidental.pem', '.env.cloudflare'):
            subprocess.run(['git', 'check-ignore', '--no-index', '-q', name], cwd=ROOT, check=True)


if __name__ == '__main__':
    unittest.main()
