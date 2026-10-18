"""Offline shell artifact and worker simulation; no physical phone acceptance."""
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from https_spike.build import build, validate_shell


class OfflineTests(unittest.TestCase):
    def test_worker_cache_lifecycle_and_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            output = build('https://smoker-test.navodio.cz:8443', Path(directory))
            subprocess.run(['node', 'scripts/https-spike-offline-test.cjs', str(output)], check=True)

    def test_release_identity_and_missing_corrupt_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            output = build('https://smoker-test.navodio.cz:8443', Path(directory))
            original = (output / 'sw.js').read_bytes()
            build('https://smoker-test.navodio.cz:8443', output)
            self.assertEqual((output / 'sw.js').read_bytes(), original)
            build('https://device.example.test:8443', output)
            self.assertNotEqual((output / 'sw.js').read_bytes(), original)
            release = json.loads(re.search(r'const RELEASE = (.*);', (output / 'sw.js').read_text())[1])
            for asset in release['assets']:
                path = output / asset['path']
                content = path.read_bytes()
                path.write_bytes(content + b'corrupt')
                with self.assertRaises(ValueError):
                    validate_shell(output)
                path.unlink()
                with self.assertRaises(OSError):
                    validate_shell(output)
                path.write_bytes(content)
            validate_shell(output)


if __name__ == '__main__':
    unittest.main()
