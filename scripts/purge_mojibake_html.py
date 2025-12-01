import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
FILES = [
    os.path.join(ROOT, 'hy-alhusin-sfry.html'),
    os.path.join(ROOT, 'hy-elz-sfry.html'),
    os.path.join(ROOT, 'hy-wars-sfry.html'),
]

BAD_CHARS = set(['§','Ù','Ø'])

def has_bad(s: str) -> bool:
    return any(ch in s for ch in BAD_CHARS)

def clean_file(path: str):
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return False
    new_lines = []
    removed = 0
    for line in lines:
        if has_bad(line):
            removed += 1
            continue
        new_lines.append(line)
    if removed:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
    print(f"{os.path.basename(path)}: removed {removed} lines")
    return True

def main():
    for fp in FILES:
        clean_file(fp)

if __name__ == '__main__':
    main()
