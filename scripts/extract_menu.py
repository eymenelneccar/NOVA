import os, re, json, time, hashlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

HTML_FILES = [
    os.path.join(ROOT, name)
    for name in os.listdir(ROOT)
    if name.startswith('hy-') and name.endswith('.html')
]

def normalize_path(p):
    p = (p or '').strip()
    if not p:
        return ''
    p = p.replace('\\', '/')
    p = re.sub(r'^/?', '', p)
    # unify any leftover 'imges/' to 'assets/images/'
    p = p.replace('imges/', 'assets/images/')
    return p

def strip_scripts(html):
    return re.sub(r'<script[\s\S]*?</script>', '', html, flags=re.I)

def parse_file(path):
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    categories = []  # list of (name, imageUrl)
    items = []       # list of dicts

    # Robust scan: locate each <h2 class="image-text ..."> then locate its header image and items block
    # Ignore <script> blocks to avoid matching template strings
    html_no_scripts = strip_scripts(html)
    for h2 in re.finditer(r'<h2[^>]*class="[^"\n]*image-text[^"\n]*"[^>]*>(.*?)</h2>', html_no_scripts, flags=re.S):
        cat_name = (h2.group(1) or '').strip()
        # Find preceding image within the same header block (search up to 600 chars back)
        back_start = max(0, h2.start() - 600)
        header_segment = html_no_scripts[back_start:h2.end()]
        mm = re.search(r'<img[^>]+src="([^"]+)"', header_segment)
        img_src = normalize_path(mm.group(1)) if mm else ''
        if cat_name:
            categories.append({'name': cat_name, 'imageUrl': img_src})

        # Find the immediate items container after this h2
        items_start = html_no_scripts.find('<div', h2.end())
        # Ensure it is the category-items block
        ci = re.search(r'<div\s+class="category-items"[^>]*>', html_no_scripts[items_start:]) if items_start != -1 else None
        if not ci:
            continue
        abs_ci_start = items_start + ci.start()
        abs_ci_end_open = items_start + ci.end()
        # Bracket counting to find the closing </div> of the items container
        depth = 1
        i = abs_ci_end_open
        while depth > 0 and i < len(html_no_scripts):
            m_open = re.search(r'<div\b', html_no_scripts[i:])
            m_close = re.search(r'</div>', html_no_scripts[i:])
            next_open = (i + m_open.start()) if m_open else None
            next_close = (i + m_close.start()) if m_close else None
            if next_close is None:
                break
            if next_open is not None and next_open < next_close:
                depth += 1
                i = next_open + 4
            else:
                depth -= 1
                i = next_close + 6
        items_html = html_no_scripts[abs_ci_end_open:i-6] if depth == 0 else ''
        if not items_html:
            continue

        for im in re.finditer(r'data-name="([^"]+)"[^>]*data-price="(\d+)"', items_html):
            name = (im.group(1).strip())
            price = int(im.group(2))
            # find nearest <img> before the button within the row
            row_start = items_html.rfind('<div', 0, im.start())
            row_end = items_html.find('</div>', im.end())
            if row_start == -1:
                row_start = 0
            if row_end == -1:
                row_end = im.end()
            row_html = items_html[row_start:row_end]
            mm2 = re.search(r'<img[^>]+src="([^"]+)"', row_html)
            image_url = normalize_path(mm2.group(1)) if mm2 else ''
            items.append({
                'id': int(time.time()*1000) + len(items),
                'name': name,
                'category': cat_name,
                'price': price,
                'imageUrl': image_url,
                'description': ''
            })

    return categories, items

def merge_unique(categories_list, items_list):
    # categories unique by name; prefer first non-empty imageUrl
    cat_map = {}
    for c in categories_list:
        n = (c.get('name') or '').strip()
        if not n:
            continue
        if n not in cat_map:
            cat_map[n] = c
        else:
            if not cat_map[n].get('imageUrl') and c.get('imageUrl'):
                cat_map[n]['imageUrl'] = c['imageUrl']

    # items unique by (name, category)
    item_map = {}
    for it in items_list:
        key = (it.get('name','').strip(), it.get('category','').strip())
        if not key[0] or not key[1]:
            continue
        if key not in item_map:
            item_map[key] = it
        else:
            # prefer item with image
            if not item_map[key].get('imageUrl') and it.get('imageUrl'):
                item_map[key]['imageUrl'] = it['imageUrl']
            # prefer higher price if zero
            if (not item_map[key].get('price') and it.get('price')):
                item_map[key]['price'] = it['price']

    cats = [ {'name': n, 'imageUrl': cat_map[n].get('imageUrl','')} for n in sorted(cat_map.keys()) ]
    items = list(item_map.values())
    # sort items by category then name
    items.sort(key=lambda x: ((x.get('category') or ''), (x.get('name') or '')))
    return cats, items

def main():
    if not HTML_FILES:
        print('No hy-*.html files found')
        return
    all_cats = []
    all_items = []
    for f in HTML_FILES:
        c, i = parse_file(f)
        all_cats.extend(c)
        all_items.extend(i)
    cats, items = merge_unique(all_cats, all_items)

    assets_dir = os.path.join(ROOT, 'assets')
    os.makedirs(assets_dir, exist_ok=True)
    cats_path = os.path.join(assets_dir, 'categories.json')
    menu_path = os.path.join(assets_dir, 'menu.json')

    with open(cats_path, 'w', encoding='utf-8') as f:
        json.dump(cats, f, ensure_ascii=False, indent=2)
    with open(menu_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f'Wrote {len(cats)} categories to {cats_path}')
    print(f'Wrote {len(items)} items to {menu_path}')

if __name__ == '__main__':
    main()
