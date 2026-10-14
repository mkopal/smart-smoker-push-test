"""Static deployment, localization and public/private boundary regressions."""
import json
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import build
from scripts.audit_public import audit


class SiteTests(unittest.TestCase):
    def test_build_exact_files_and_subpath_links(self):
        output = build.build()
        self.assertEqual({p.name for p in output.iterdir()}, build.SITE_FILES)
        for size in (180, 192, 512):
            image = (output / f'icon-{size}.png').read_bytes()
            self.assertEqual(image[:8], b'\x89PNG\r\n\x1a\n')
            self.assertEqual(struct.unpack('!II', image[16:24]), (size, size))
        for name in ('app.js', 'sw.js', 'i18n.js', 'catalogs.js'):
            subprocess.run(['node', '--check', str(output / name)], check=True, capture_output=True)
        html = (output / 'index.html').read_text()
        self.assertIn("connect-src 'self'", html)
        self.assertNotIn('src="/', html)
        self.assertNotIn('href="/', html)
        worker = (output / 'sw.js').read_text()
        self.assertNotIn("addEventListener('fetch'", worker)
        self.assertNotIn('caches.', worker)
        self.assertNotIn('localStorage', (output / 'app.js').read_text().split('getSubscription')[1])

    def test_unknown_artifact_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            for name in build.SITE_FILES:
                (output / name).write_text('{}')
            (output / 'publisher.cjs').write_text('synthetic unexpected artifact')
            with self.assertRaises(ValueError):
                build.validate_site(output)

    def test_catalog_discovery_and_failures(self):
        canonical = build.catalogs(ROOT / 'web')
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            shutil.copytree(ROOT / 'web/locales', source / 'locales')
            extra = source / 'locales/de.json'
            extra.write_text(json.dumps(canonical['en']))
            self.assertIn('de', build.catalogs(source))
            for invalid in ('{"x":"a","x":"b"}', '[]', '{', '{"app":1}'):
                extra.write_text(invalid)
                with self.assertRaises((ValueError, TypeError)):
                    build.catalogs(source)
            missing = json.loads(json.dumps(canonical['en']))
            missing['notification']['body'] = 'No arguments'
            extra.write_text(json.dumps(missing))
            with self.assertRaises(ValueError):
                build.catalogs(source)

    def test_ignore_private_data(self):
        for name in ('local/private/vapid.json', 'local/private/iphone.json', 'dist/index.html',
                     'node_modules/cache', '.env', 'accidental-subscription.json', 'accidental-vapid.json'):
            subprocess.run(['git', 'check-ignore', '--no-index', '-q', name], cwd=ROOT, check=True)

    def test_workflow_only_uploads_dist_after_tests(self):
        workflow = (ROOT / '.github/workflows/pages.yml').read_text()
        self.assertIn('path: dist\n', workflow)
        self.assertNotIn("path: '.'", workflow)
        self.assertIn('npm run test:library', workflow)
        self.assertIn('python scripts/audit_public.py', workflow)
        self.assertIn('needs: build', workflow)
        self.assertIn('persist-credentials: false', workflow)
        self.assertNotIn('continue-on-error', workflow)

    def test_public_audit_rejects_staged_private_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in (ROOT / 'PUBLIC_FILES.txt').read_text().splitlines():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            shutil.copytree(ROOT / 'dist', root / 'dist')
            def git(*args):
                return subprocess.run(['git', *args], cwd=root, check=True, capture_output=True)
            git('init', '-q')
            git('add', '.')
            audit(root)
            private = root / 'phone.json'
            private.write_text('synthetic-private-marker')
            git('add', 'phone.json')
            with self.assertRaises(ValueError):
                audit(root)
            git('rm', '--cached', 'phone.json')
            notes = root / 'NOTICE.md'
            original = notes.read_text()
            notes.write_text('"privateKey": "' + 'X' * 43 + '"')
            git('add', 'NOTICE.md')
            notes.write_text(original)
            with self.assertRaises(ValueError):
                audit(root)

    def test_dependency_lock_is_development_only(self):
        package = json.loads((ROOT / 'package.json').read_text())
        self.assertNotIn('dependencies', package)
        self.assertEqual(package['devDependencies'], {'web-push': '3.6.7'})
        lock = json.loads((ROOT / 'package-lock.json').read_text())
        for name, entry in lock['packages'].items():
            if name:
                self.assertTrue(entry['dev'])
                self.assertTrue(entry['integrity'].startswith('sha512-'))


if __name__ == '__main__':
    unittest.main()
