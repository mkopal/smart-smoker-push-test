"""Bench firmware boundaries and development provisioning; never contact hardware."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Esp32Tests(unittest.TestCase):
    def test_synthetic_provision_is_private_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'esp32').mkdir()
            shutil.copyfile(ROOT / 'publisher.cjs', root / 'publisher.cjs')
            shutil.copyfile(ROOT / 'esp32/provision.cjs', root / 'esp32/provision.cjs')
            command = ['node', str(root / 'esp32/provision.cjs'), '--synthetic']
            first = subprocess.run(command, capture_output=True, check=True)
            target = root / 'local/esp32-input/poc_config.h'
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            self.assertEqual(target.parent.stat().st_mode & 0o777, 0o700)
            self.assertIn('POC_SEND_ENABLED = false', target.read_text())
            self.assertNotIn(b'https://web.push.apple.com', first.stdout)
            before = hashlib.sha256(target.read_bytes()).digest()
            second = subprocess.run(command, capture_output=True)
            self.assertNotEqual(second.returncode, 0)
            self.assertEqual(before, hashlib.sha256(target.read_bytes()).digest())
            bad = subprocess.run(command[:-1] + ['--flash'], capture_output=True)
            self.assertNotEqual(bad.returncode, 0)

    def test_private_build_artifacts_are_ignored(self):
        for name in ('local/esp32-input/poc_config.h', 'local/esp32-build/push_poc.bin',
                     'esp32/sdkconfig', 'esp32/build/config.json', 'esp32/main/poc_config.h'):
            subprocess.run(['git', 'check-ignore', '--no-index', '-q', name], cwd=ROOT, check=True)

    def test_build_interface_has_no_device_operation(self):
        result = subprocess.run(['python3', 'esp32/build.py', '--help'], cwd=ROOT,
                                text=True, capture_output=True, check=True)
        self.assertIn('{host,firmware,size}', result.stdout)
        for operation in ('flash', 'monitor', 'erase-flash', 'ota'):
            refused = subprocess.run(['python3', 'esp32/build.py', operation], cwd=ROOT, capture_output=True)
            self.assertNotEqual(refused.returncode, 0)

    def test_source_security_boundaries(self):
        # Policy guard against accidental additions; behavior is exercised in the
        # compiled C++/Node suite and future actual transport tests, not by text.
        source = (ROOT / 'esp32/main/main.cpp').read_text()
        self.assertIn('config.crt_bundle_attach=esp_crt_bundle_attach', source)
        self.assertIn('config.skip_cert_common_name_check=false', source)
        self.assertIn('config.disable_auto_redirect=true', source)
        self.assertIn('shutdown(socket, SHUT_RDWR)', source)
        self.assertIn('static volatile bool send_enabled = POC_SEND_ENABLED', source)
        for prohibited in ('gpio_set_', 'gpio_config(', 'httpd_start(', 'esp_ota_', 'esp_restart('):
            self.assertNotIn(prohibited, source)
        config = (ROOT / 'esp32/sdkconfig.defaults').read_text()
        self.assertIn('CONFIG_LOG_MAXIMUM_LEVEL=0', config)
        self.assertNotIn('CONFIG_ESP_TLS_INSECURE=y', config)


if __name__ == '__main__':
    unittest.main()
