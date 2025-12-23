#!/usr/bin/env python
import sys
import os

# Try to import pdfminer.text
try:
    from pdfminer.high_level import extract_text
except Exception:
    # Attempt to install pdfminer.six
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pdfminer.six'])
    from pdfminer.high_level import extract_text

try:
    import pytesseract
    from PIL import Image
    has_tesseract = True
except Exception:
    has_tesseract = False


def extract_from_pdf(path, maxchars=16000):
    try:
        text = extract_text(path, maxpages=1)
        if text and len(text.strip())>0:
            return text[:maxchars]
    except Exception as e:
        pass
    return ''


def main():
    if len(sys.argv) < 2:
        print('Usage: extract_text.py <file1> [file2 ...]')
        sys.exit(2)
    out = {}
    for p in sys.argv[1:]:
        p = os.path.abspath(p)
        if not os.path.exists(p):
            print(p + ' MISSING', file=sys.stderr)
            out[p] = ''
            continue
        text = ''
        ext = os.path.splitext(p)[1].lower()
        if ext == '.pdf':
            text = extract_from_pdf(p)
        elif ext in ['.txt', '.md']:
            try:
                with open(p, 'r', encoding='utf8', errors='ignore') as f:
                    text = f.read(16000)
            except Exception:
                text = ''
        else:
            # Try pdf extraction anyway
            text = extract_from_pdf(p)
        # If empty and we have tesseract, try OCR via image conversion (rudimentary)
        if (not text or len(text.strip())==0) and has_tesseract:
            try:
                # Use PIL to open image or convert PDF page to image is complex; skip PDF OCR here
                # We can try for image files
                if ext in ['.png', '.jpg', '.jpeg', '.tiff']:
                    img = Image.open(p)
                    text = pytesseract.image_to_string(img)
                else:
                    text = ''
            except Exception:
                text = ''
        out[p] = (text or '').strip()
    # Print JSON to stdout
    import json
    print(json.dumps(out))

if __name__ == '__main__':
    main()
