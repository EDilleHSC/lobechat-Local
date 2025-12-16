from pathlib import Path


def test_template_placeholders():
    template_path = Path(r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\template.html")
    template = template_path.read_text() if template_path.exists() else ""
    required = ['{header}', '{items}', '{timestamp}']
    missing = [t for t in required if t not in template]
    assert not missing, f"Missing required placeholder(s): {', '.join(missing)}"