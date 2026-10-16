"""Offline build/test entry points only; no upload, serial, network or production secrets."""
import argparse
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['host', 'firmware', 'size'])
    args = parser.parse_args()
    os.umask(0o077)
    cache = Path.home() / '.cache/esphome/idf'
    idf = Path(os.environ.get('IDF_PATH', cache / 'frameworks/5.5.5')).resolve()
    if (idf / 'version.txt').read_text().strip().lstrip('v') != '5.5.5':
        parser.error('ESP-IDF 5.5.5 is required')
    local = ROOT / 'local'
    local.mkdir(mode=0o700, exist_ok=True)
    env = os.environ.copy()
    env['IDF_PATH'] = str(idf)
    env.setdefault('IDF_TOOLS_PATH', str(cache))
    env.setdefault('IDF_PYTHON_ENV_PATH', str(cache / 'penvs/5.5.5'))
    env.setdefault('ESP_ROM_ELF_DIR', str(cache / 'tools/esp-rom-elfs/20241011'))
    tool = cache / 'tools/xtensa-esp-elf/esp-14.2.0_20260121/xtensa-esp-elf/bin'
    env['PATH'] = str(Path(env['IDF_PYTHON_ENV_PATH']) / 'bin') + os.pathsep + str(tool) + os.pathsep + env['PATH']
    env['IDF_COMPONENT_MANAGER'] = '0'

    def run(command):
        subprocess.run([str(x) for x in command], cwd=ROOT, env=env, check=True)

    if args.mode == 'host':
        run(['cmake', '-S', ROOT / 'esp32/tests', '-B', local / 'esp32-host',
             '-D', f'MBEDTLS_SOURCE={idf}/components/mbedtls/mbedtls'])
        run(['cmake', '--build', local / 'esp32-host', '-j', '4'])
        run(['node', ROOT / 'esp32/tests/test.cjs', local / 'esp32-host/push_driver'])
    else:
        if not (local / 'esp32-input/poc_config.h').is_file():
            parser.error('Run node esp32/provision.cjs --synthetic first')
        build = local / 'esp32-build'
        build.mkdir(mode=0o700, exist_ok=True)
        run([Path(env['IDF_PYTHON_ENV_PATH']) / 'bin/python', idf / 'tools/idf.py',
             '-C', ROOT / 'esp32', '-B', build, '-D', f'SDKCONFIG={build}/sdkconfig',
             'build' if args.mode == 'firmware' else 'size'])


if __name__ == '__main__':
    main()
