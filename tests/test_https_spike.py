"""Loopback TLS and deterministic synthetic protocol tests; no phone/CA evidence."""
import http.client
import json
from pathlib import Path
import socket
import ssl
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import patch

from https_spike.server import DEVICE, RECIPIENT, TOKEN, State, Server, origin
from https_spike.build import build as build_spike, FILES

APP = 'https://app.example.test'
HOST = 'device.example.test:8443'


class StateTests(unittest.TestCase):
    def test_expiry_replay_boundaries_and_restart(self):
        now = [0]
        state = State(clock=lambda: now[0], nonce=lambda: 'a' * 32)
        challenge = state.challenge()
        body = {'challenge': challenge, 'deviceId': DEVICE, 'recipient': RECIPIENT}
        self.assertEqual(state.enroll(body), (200, 'synthetic_enrolled'))
        self.assertEqual(state.enroll(body), (409, 'replay'))
        now[0] = 120
        self.assertEqual(state.enroll(body), (409, 'expired_or_unknown'))
        self.assertEqual(State().enroll(body), (409, 'expired_or_unknown'))

    def test_bounded_state_and_rate_recovery(self):
        now = [0]
        counter = iter(range(100))
        state = State(clock=lambda: now[0], nonce=lambda: f'{next(counter):032x}')
        for _ in range(16):
            self.assertIsNotNone(state.challenge())
        self.assertIsNone(state.challenge())
        self.assertTrue(all(state.admit() for _ in range(120)))
        self.assertFalse(state.admit())
        now[0] = 60
        self.assertTrue(state.admit())
        now[0] = 120
        self.assertIsNotNone(state.challenge())
        self.assertEqual(len(state.challenges), 1)

    def test_origin_configuration(self):
        for value in ('http://app.example.test', 'https://app.example.test/', 'null',
                      'https://user@app.example.test', 'https://*.example.test',
                      'https://app.example.test#x', 'https://app.example.test:0',
                      'https://app.example.test\nInjected', 'https://app.example.test\n'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                origin(value)
        self.assertEqual(origin(APP), APP)


class HTTPSTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='synthetic-https-')
        root = Path(cls.directory.name)
        cls.cert, cls.key = root / 'cert.pem', root / 'key.pem'
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                        '-keyout', str(cls.key), '-out', str(cls.cert), '-days', '1',
                        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'],
                       check=True, capture_output=True)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(cls.cert, cls.key)
        cls.server = Server(('127.0.0.1', 0), HOST, APP, context)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.client_context = ssl.create_default_context(cafile=str(cls.cert))

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def setUp(self):
        self.server.state = State()

    def request(self, method='GET', path='/spike/v1/challenge', body=None, headers=None):
        connection = http.client.HTTPSConnection('localhost', self.server.server_port,
                                                context=self.client_context, timeout=5)
        request_headers = {'Host': HOST, 'Origin': APP}
        request_headers.update(headers or {})
        connection.request(method, path, body, request_headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), json.loads(response.read())
        connection.close()
        return result

    def enroll(self, body, headers=None):
        return self.request('POST', '/spike/v1/enroll', json.dumps(body), {
            'Content-Type': 'application/json', 'X-Spike-Authorization': TOKEN, **(headers or {})})

    def test_success_unauthorized_and_replay(self):
        status, headers, challenge = self.request()
        self.assertEqual(status, 200)
        self.assertEqual(headers['Access-Control-Allow-Origin'], APP)
        self.assertNotIn('Access-Control-Allow-Credentials', headers)
        self.assertEqual(headers['Vary'], 'Origin')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        body = {'challenge': challenge['challenge'], 'deviceId': DEVICE, 'recipient': RECIPIENT}
        self.assertEqual(self.enroll(body, {'X-Spike-Authorization': 'invalid'})[0], 401)
        self.assertEqual(self.enroll(body)[0], 200)
        self.assertEqual(self.enroll(body)[2]['code'], 'replay')

    def test_origin_host_and_preflight(self):
        for value in ('null', 'https://evil.example.test', APP + '.evil', APP + '/'):
            status, headers, _ = self.request(headers={'Origin': value})
            self.assertEqual(status, 403)
            self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(self.request(headers={'Host': 'evil.example.test'})[0], 421)
        headers = {'Access-Control-Request-Method': 'POST',
                   'Access-Control-Request-Headers': 'content-type, x-spike-authorization'}
        self.assertEqual(self.request('OPTIONS', '/spike/v1/enroll', headers=headers)[0], 200)
        self.assertEqual(self.server.state.challenges, {})
        for invalid in ({'Access-Control-Request-Method': 'DELETE'},
                        {'Access-Control-Request-Headers': 'x-unapproved'},
                        {'Access-Control-Request-Private-Network': 'true'}):
            self.assertEqual(self.request('OPTIONS', '/spike/v1/enroll', headers={**headers, **invalid})[0], 403)

    def test_malformed_and_real_data_rejected_without_consuming_challenge(self):
        nonce = self.request()[2]['challenge']
        valid = {'challenge': nonce, 'deviceId': DEVICE, 'recipient': RECIPIENT}
        for body in (None, [], {}, {**valid, 'subscription': {}},
                     {**valid, 'recipient': 'other'}, {**valid, 'challenge': 1}):
            self.assertEqual(self.enroll(body)[0], 400)
        for raw in ('{', '{"challenge":1,"challenge":2}', '\ufffd', '[' * 1000):
            self.assertEqual(self.request('POST', '/spike/v1/enroll', raw.encode(), {
                'Content-Type': 'application/json', 'X-Spike-Authorization': TOKEN})[0], 400)
        self.assertEqual(self.enroll(valid)[0], 200)

    def test_limits_methods_and_content_type(self):
        self.assertEqual(self.request('POST', '/spike/v1/enroll', b'x' * 1025)[0], 413)
        self.assertEqual(self.request('POST', '/spike/v1/enroll', b'x' * 1024)[0], 401)
        self.assertEqual(self.enroll({}, {'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.request('POST')[0], 405)
        self.assertEqual(self.request(path='/spike/v2/challenge')[0], 404)
        self.assertEqual(self.request(path='/spike/v1/challenge?x=1')[0], 404)
        for _ in range(16):
            self.assertEqual(self.request()[0], 200)
        self.assertEqual(self.request()[0], 429)
        self.server.state.requests.extend([self.server.state.clock()] * 120)
        self.assertEqual(self.request()[0], 429)

    def test_raw_duplicate_framing_absent_origin_and_header_limit(self):
        for extra, expected in (
            ('Origin: ' + APP + '\r\nOrigin: null\r\n', 400),
            ('', 403),
            ('Origin: ' + APP + '\r\nContent-Length: -1\r\n', 400),
            ('Origin: ' + APP + '\r\nTransfer-Encoding: chunked\r\n', 400),
            ('Origin: ' + APP + '\r\nX-Fill: ' + 'x' * 8192 + '\r\n', 431),
        ):
            with socket.create_connection(('localhost', self.server.server_port), timeout=5) as raw:
                with self.client_context.wrap_socket(raw, server_hostname='localhost') as connection:
                    connection.sendall(('GET /spike/v1/challenge HTTP/1.1\r\nHost: ' + HOST + '\r\n' + extra + '\r\n').encode())
                    self.assertIn(f' {expected} '.encode(), connection.recv(4096).split(b'\r\n')[0])

    def test_incomplete_body_times_out_without_mutation_and_recovers(self):
        with socket.create_connection(('localhost', self.server.server_port), timeout=5) as raw:
            with self.client_context.wrap_socket(raw, server_hostname='localhost') as connection:
                connection.sendall(('POST /spike/v1/enroll HTTP/1.1\r\nHost: ' + HOST
                                    + '\r\nOrigin: ' + APP + '\r\nContent-Type: application/json'
                                    + '\r\nX-Spike-Authorization: ' + TOKEN
                                    + '\r\nContent-Length: 2\r\n\r\n{').encode())
                self.assertEqual(connection.recv(4096), b'')
        self.assertEqual(self.server.state.challenges, {})
        self.assertEqual(self.request()[0], 200)

    def test_expired_tls_fixture_fails_closed(self):
        expired = Path(self.directory.name) / 'expired.pem'
        subprocess.run(['openssl', 'x509', '-in', str(self.cert), '-signkey', str(self.key),
                        '-days', '-1', '-out', str(expired)], check=True, capture_output=True)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(expired, self.key)
        original = self.server.context
        self.server.context = context
        try:
            client = ssl.create_default_context(cafile=str(expired))
            with socket.create_connection(('localhost', self.server.server_port), timeout=5) as raw:
                with self.assertRaises(ssl.SSLCertVerificationError) as error:
                    client.wrap_socket(raw, server_hostname='localhost')
            self.assertEqual(error.exception.verify_code, 10)  # OpenSSL certificate expired.
        finally:
            self.server.context = original

    def test_tls_fails_closed_for_untrusted_and_hostname_mismatch(self):
        for context, hostname in ((ssl.create_default_context(), 'localhost'),
                                  (self.client_context, 'wrong.example.test')):
            with socket.create_connection(('localhost', self.server.server_port), timeout=5) as raw:
                with self.assertRaises(ssl.SSLCertVerificationError):
                    context.wrap_socket(raw, server_hostname=hostname)


class BuildTests(unittest.TestCase):
    def test_isolated_build_exact_csp_locales_and_no_production_output(self):
        with tempfile.TemporaryDirectory() as directory:
            target = build_spike('https://' + HOST, Path(directory))
            self.assertEqual({p.name for p in target.iterdir()}, FILES)
            html = (target / 'index.html').read_text()
            self.assertIn("connect-src 'self' https://" + HOST + ';', html)
            self.assertNotIn('https:', html.replace('https://' + HOST, ''))
            self.assertIn('"cs"', (target / 'catalogs.js').read_text())
            self.assertIn('"en"', (target / 'catalogs.js').read_text())
            for name in FILES:
                if name.endswith('.js'):
                    subprocess.run(['node', '--check', str(target / name)], check=True, capture_output=True)
            self.assertNotIn("addEventListener('fetch'", (target / 'sw.js').read_text())
            (target / 'unexpected.txt').write_text('synthetic')
            with self.assertRaises(ValueError):
                build_spike('https://' + HOST, target)

    def test_browser_protocol_behavior(self):
        subprocess.run(['node', 'scripts/https-spike-test.cjs'], check=True)

    def test_cli_missing_certificate_never_starts_listener(self):
        from https_spike.server import main
        with patch('sys.argv', ['server', '--device-origin', 'https://' + HOST,
                               '--app-origin', APP, '--cert', '/nonexistent/cert.pem',
                               '--key', '/nonexistent/key.pem']), patch('https_spike.server.Server') as server:
            with self.assertRaises(SystemExit):
                main()
            server.assert_not_called()


if __name__ == '__main__':
    unittest.main()
