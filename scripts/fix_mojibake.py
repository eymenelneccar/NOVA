import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def fix_text(s):
    if s is None:
        return s
    s = str(s)
    for enc in ('latin1', 'cp1252'):
        try:
            return s.encode(enc).decode('utf-8')
        except Exception:
            pass
    try:
        b = bytes(ord(c) for c in s)
        return b.decode('utf-8')
    except Exception:
        pass
    return s

def fix_file(path, fields):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        return False
    changed = False
    if isinstance(data, list):
        for obj in data:
            if isinstance(obj, dict):
                for k in fields:
                    if k in obj:
                        v = obj[k]
                        fv = fix_text(v)
                        if fv != v:
                            obj[k] = fv
                            changed = True
    elif isinstance(data, dict):
        for k in list(data.keys()):
            if k in fields:
                v = data[k]
                fv = fix_text(v)
                if fv != v:
                    data[k] = fv
                    changed = True
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{os.path.basename(path)}: {'fixed' if changed else 'unchanged'}")
    return changed

def main():
    cats = os.path.join(ROOT, 'assets', 'categories.json')
    menu = os.path.join(ROOT, 'assets', 'menu.json')
    fix_file(cats, ['name', 'imageUrl'])
    fix_file(menu, ['name', 'category', 'description'])
    # zero out data if requested via env
    if os.environ.get('ZERO_DATA', '0') == '1':
        for p in (cats, menu):
            with open(p, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False)
            print(f"{os.path.basename(p)}: zeroed")

if __name__ == '__main__':
    main()
