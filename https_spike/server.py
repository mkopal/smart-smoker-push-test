"""Synthetic, memory-only HTTPS transport probe. Never a production enrollment API."""
import argparse
from collections import deque
from http.server import BaseHTTPRequestHandler, HTTPServer
import ipaddress
import json
import re
import secrets
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit

TOKEN = 'synthetic-spike-only'
DEVICE = 'synthetic-smoker'
RECIPIENT = 'synthetic-recipient'
PREFIX = '/spike/v1/'
MAX_BODY = 1024


def origin(value):
    parsed = urlsplit(value)
    if (value != 'https://' + parsed.netloc or parsed.scheme != 'https'
            or not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment or parsed.netloc != parsed.netloc.lower()
            or not re.fullmatch(r'[a-z0-9.-]+(?::[0-9]+)?', parsed.netloc)):
        raise ValueError('An exact HTTPS origin without a path is required')
    if parsed.port is not None and not 1 <= parsed.port <= 65535:
        raise ValueError('Invalid port')
    return value


def unique(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate key')
        result[key] = value
    return result


class State:
    def __init__(self, clock=time.monotonic, nonce=lambda: secrets.token_hex(16)):
        self.clock, self.nonce = clock, nonce
        self.challenges = {}
        self.requests = deque()

    def admit(self):
        now = self.clock()
        while self.requests and self.requests[0] <= now - 60:
            self.requests.popleft()
        if len(self.requests) >= 120:
            return False
        self.requests.append(now)
        return True

    def challenge(self):
        now = self.clock()
        self.challenges = {key: value for key, value in self.challenges.items() if now < value[0]}
        if len(self.challenges) >= 16:
            return None
        nonce = self.nonce()
        self.challenges[nonce] = (now + 120, False)
        return nonce

    def enroll(self, body):
        if (not isinstance(body, dict) or set(body) != {'challenge', 'deviceId', 'recipient'}
                or body['deviceId'] != DEVICE or body['recipient'] != RECIPIENT
                or not isinstance(body['challenge'], str)
                or not re.fullmatch(r'[a-f0-9]{32}', body['challenge'])):
            return 400, 'malformed_body'
        value = self.challenges.get(body['challenge'])
        if value is None or self.clock() >= value[0]:
            return 409, 'expired_or_unknown'
        if value[1]:
            return 409, 'replay'
        self.challenges[body['challenge']] = (value[0], True)
        return 200, 'synthetic_enrolled'


class Handler(BaseHTTPRequestHandler):
    server_version = 'SyntheticSpike/1'
    sys_version = ''

    def log_message(self, *_):
        pass  # No request paths, headers, client addresses or bodies in logs.

    def reply(self, status, code, extra=None):
        payload = json.dumps({'version': 1, 'synthetic': True, 'code': code, **(extra or {})}).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Vary', 'Origin')
        self.send_header('Connection', 'close')
        if self.cors:
            self.send_header('Access-Control-Allow-Origin', self.server.app_origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, POST')
            self.send_header('Access-Control-Allow-Headers', 'content-type, x-spike-authorization')
            self.send_header('Access-Control-Max-Age', '0')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(payload)
        self.close_connection = True

    def do_request(self):
        self.cors = False
        if not self.server.state.admit():
            return self.reply(429, 'request_limit')
        if sum(len(k) + len(v) for k, v in self.headers.items()) > 8192:
            return self.reply(431, 'header_limit')
        for name in ('Host', 'Origin', 'Content-Length', 'Content-Type',
                     'X-Spike-Authorization', 'Access-Control-Request-Method',
                     'Access-Control-Request-Headers', 'Transfer-Encoding'):
            if len(self.headers.get_all(name, [])) > 1:
                return self.reply(400, 'duplicate_header')
        if self.headers.get('Host') != self.server.authority:
            return self.reply(421, 'invalid_host')
        if self.headers.get('Origin') != self.server.app_origin:
            return self.reply(403, 'invalid_origin')
        self.cors = True
        if self.headers.get('Transfer-Encoding') is not None:
            return self.reply(400, 'unsupported_framing')
        length = self.headers.get('Content-Length', '0')
        if not re.fullmatch(r'[0-9]{1,8}', length):
            return self.reply(400, 'malformed_length')
        length = int(length)
        if length > MAX_BODY:
            return self.reply(413, 'body_limit')
        if self.path not in (PREFIX + 'challenge', PREFIX + 'enroll'):
            return self.reply(404, 'unknown_route')
        expected = 'GET' if self.path.endswith('/challenge') else 'POST'
        if self.command == 'OPTIONS':
            requested = self.headers.get('Access-Control-Request-Headers', '')
            headers = [item.strip().lower() for item in requested.split(',') if item.strip()]
            if (length or self.headers.get('Access-Control-Request-Method') != expected
                    or not set(headers) <= {'content-type', 'x-spike-authorization'}
                    or self.headers.get('Access-Control-Request-Private-Network') is not None):
                return self.reply(403, 'invalid_preflight')
            return self.reply(200, 'preflight')
        if self.command != expected:
            return self.reply(405, 'invalid_method')
        if expected == 'GET':
            if length:
                return self.reply(400, 'unexpected_body')
            nonce = self.server.state.challenge()
            if nonce is None:
                return self.reply(429, 'challenge_limit')
            return self.reply(200, 'challenge', {'challenge': nonce, 'expiresIn': 120, 'deviceId': DEVICE})
        if self.headers.get('X-Spike-Authorization') != TOKEN:
            return self.reply(401, 'unauthorized')
        if self.headers.get('Content-Type') != 'application/json':
            return self.reply(415, 'invalid_content_type')
        if 'Content-Length' not in self.headers:
            return self.reply(411, 'length_required')
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                return self.reply(400, 'incomplete_body')
            body = json.loads(raw.decode('utf-8'), object_pairs_hook=unique)
        except (ValueError, RecursionError):
            return self.reply(400, 'malformed_body')
        status, code = self.server.state.enroll(body)
        return self.reply(status, code)

    do_GET = do_POST = do_OPTIONS = do_PUT = do_DELETE = do_HEAD = do_PATCH = do_request


class Server(HTTPServer):
    request_queue_size = 4

    def __init__(self, address, authority, app_origin, context, state=None):
        self.authority, self.app_origin = authority, origin(app_origin)
        self.context, self.state = context, state or State()
        super().__init__(address, Handler)

    def get_request(self):
        connection, address = super().get_request()
        connection.settimeout(3)
        try:
            return self.context.wrap_socket(connection, server_side=True), address
        except Exception:
            connection.close()
            raise

    def process_request(self, request, client_address):
        def expire():
            try:
                request.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        timer = threading.Timer(10, expire)
        timer.daemon = True
        timer.start()
        try:
            super().process_request(request, client_address)
        finally:
            timer.cancel()

    def handle_error(self, *_):
        pass  # Fail closed without traceback/body leakage.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8443)
    parser.add_argument('--device-origin', required=True)
    parser.add_argument('--app-origin', required=True)
    parser.add_argument('--cert', required=True)
    parser.add_argument('--key', required=True)
    args = parser.parse_args()
    try:
        address = ipaddress.IPv4Address(args.bind)
        if address.is_unspecified or not (address.is_private or address.is_loopback) or address.is_multicast:
            raise ValueError('Bind only a specific LAN or loopback address')
        device = urlsplit(origin(args.device_origin))
        if (device.port or 443) != args.port or not 1 <= args.port <= 65535:
            raise ValueError('Device origin and listener port must match')
        origin(args.app_origin)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(args.cert, args.key)
        server = Server((args.bind, args.port), device.netloc, args.app_origin, context)
    except (ValueError, OSError, ssl.SSLError):
        parser.exit(2, 'Refused invalid configuration or unavailable TLS material; details suppressed.\n')
    print('Synthetic HTTPS probe running; Ctrl-C stops it and clears volatile sessions.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
