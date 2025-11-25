import os
import json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import base64
import re
import time
import urllib.request
import io
import zipfile


ROOT_DIR = os.path.abspath(os.getcwd())
ASSETS_PATH = os.path.join(ROOT_DIR, 'assets', 'menu.json')
CATEGORIES_ASSETS_PATH = os.path.join(ROOT_DIR, 'assets', 'categories.json')
GOVS_ASSETS_PATH = os.path.join(ROOT_DIR, 'assets', 'governorates.json')
HERO_ASSETS_PATH = os.path.join(ROOT_DIR, 'assets', 'hero.json')
SAVE_ENDPOINT = '/api/save-menu'
SAVE_CATS_ENDPOINT = '/api/save-categories'
SAVE_GOVS_ENDPOINT = '/api/save-governorates'
SAVE_HERO_ENDPOINT = '/api/save-hero'
UPLOAD_ENDPOINT = '/api/upload-image'


class Handler(SimpleHTTPRequestHandler):
    # تأكد من تقديم الملفات من مجلد المشروع
    def __init__(self, *args, **kwargs):
        kwargs['directory'] = ROOT_DIR
        super().__init__(*args, **kwargs)

    def do_GET(self):
        # تنزيل مجلد الأصول كملف مضغوط
        if self.path in ['/download/assets', '/download/assets.zip']:
            try:
                assets_dir = os.path.join(ROOT_DIR, 'assets')
                if not os.path.isdir(assets_dir):
                    raise FileNotFoundError('assets directory not found')
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for root, _, files in os.walk(assets_dir):
                        for name in files:
                            abs_file = os.path.join(root, name)
                            arcname = os.path.relpath(abs_file, assets_dir).replace('\\', '/')
                            zf.write(abs_file, arcname)
                data = buf.getvalue()
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', 'attachment; filename="assets.zip"')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
            return

        # تنزيل ملف بعينه من داخل الأصول عبر /download/assets/<path>
        if self.path.startswith('/download/assets/'):
            try:
                rel = self.path[len('/download/assets/'):].lstrip('/')
                assets_dir = os.path.join(ROOT_DIR, 'assets')
                target = os.path.normpath(os.path.join(assets_dir, rel))
                if not os.path.abspath(target).startswith(os.path.abspath(assets_dir)):
                    raise ValueError('Invalid path')
                if not os.path.isfile(target):
                    raise FileNotFoundError('File not found')
                mime = self.guess_type(target) or 'application/octet-stream'
                with open(target, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
            return

        # خلاف ذلك استخدم خدمة الملفات الثابتة الافتراضية
        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/save-menu':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode('utf-8'))
                if not isinstance(data, list):
                    raise ValueError('Payload must be a JSON array')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
                return

            # اكتب إلى ملف الأصول
            try:
                os.makedirs(os.path.dirname(ASSETS_PATH), exist_ok=True)
                with open(ASSETS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'path': 'assets/menu.json'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/save-categories':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode('utf-8'))
                if not isinstance(data, list):
                    raise ValueError('Payload must be a JSON array')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
                return

            try:
                os.makedirs(os.path.dirname(CATEGORIES_ASSETS_PATH), exist_ok=True)
                with open(CATEGORIES_ASSETS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'path': 'assets/categories.json'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/upload-image':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8'))
                data_url_or_b64 = payload.get('data')
                filename = payload.get('filename')
                if not data_url_or_b64:
                    raise ValueError('Missing image data')

                m = re.match(r'^data:([\w.+-]+/[\w.+-]+);base64,(.*)$', data_url_or_b64)
                if m:
                    mime = m.group(1)
                    b64data = m.group(2)
                else:
                    mime = None
                    b64data = data_url_or_b64

                ext_map = {
                    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/svg+xml': '.svg',
                    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv'
                }
                ext = ext_map.get(mime, '')
                if not filename:
                    filename = f"img_{int(time.time()*1000)}{ext or '.bin'}"

                safe_name = re.sub(r'[^A-Za-z0-9._-]+', '_', filename)
                base_dir = os.path.join(ROOT_DIR, 'assets', 'videos') if (mime and mime.startswith('video/')) else os.path.join(ROOT_DIR, 'assets', 'images')
                os.makedirs(base_dir, exist_ok=True)
                abs_path = os.path.join(base_dir, safe_name)

                with open(abs_path, 'wb') as f:
                    f.write(base64.b64decode(b64data))

                rel_path = os.path.join('assets', 'videos' if (mime and mime.startswith('video/')) else 'images', safe_name).replace('\\', '/')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'path': rel_path}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/save-hero':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode('utf-8'))
                if not isinstance(data, dict):
                    raise ValueError('Payload must be a JSON object')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
                return

            try:
                os.makedirs(os.path.dirname(HERO_ASSETS_PATH), exist_ok=True)
                with open(HERO_ASSETS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'path': 'assets/hero.json'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/save-governorates':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode('utf-8'))
                if not isinstance(data, list):
                    raise ValueError('Payload must be a JSON array')
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
                return

            try:
                os.makedirs(os.path.dirname(GOVS_ASSETS_PATH), exist_ok=True)
                with open(GOVS_ASSETS_PATH, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'path': 'assets/governorates.json'}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/log-customer':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                rec = json.loads(body.decode('utf-8')) or {}
                name = (rec.get('name') or '').strip()
                phone = (rec.get('phone') or '').strip()
                branch = (rec.get('branch') or '').strip()
                ts = rec.get('timestamp') or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                order_number = rec.get('orderNumber')
                total = rec.get('total')
                item_count = rec.get('itemCount')
                if not name or not phone:
                    raise ValueError('Missing name or phone')

                log_path = os.path.join(ROOT_DIR, 'assets', 'customer_logs.json')
                os.makedirs(os.path.dirname(log_path), exist_ok=True)
                try:
                    if os.path.exists(log_path):
                        with open(log_path, 'r', encoding='utf-8') as f:
                            entries = json.load(f)
                            if not isinstance(entries, list):
                                entries = []
                    else:
                        entries = []
                except Exception:
                    entries = []

                entry = {
                    'name': name,
                    'phone': phone,
                    'branch': branch,
                    'orderNumber': order_number,
                    'total': total,
                    'itemCount': item_count,
                    'timestamp': ts
                }
                entries.append(entry)
                with open(log_path, 'w', encoding='utf-8') as f:
                    json.dump(entries, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        elif self.path == '/api/forward-webhook':
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length)
            try:
                payload = json.loads(body.decode('utf-8')) or {}
                url = (payload.get('url') or '').strip()
                data = payload.get('data')
                if not url:
                    raise ValueError('Missing url')
                if data is None:
                    raise ValueError('Missing data')
                req = urllib.request.Request(url=url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
                with urllib.request.urlopen(req, timeout=10) as resp:
                    status = resp.getcode()
                self.send_response(200 if status == 200 else status)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'status': status}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode('utf-8'))


def main():
    port = int(os.environ.get('PORT', '5005'))
    httpd = ThreadingHTTPServer(('', port), Handler)
    print(f"Serving at http://localhost:{port}/ (root: {ROOT_DIR})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == '__main__':
    main()
