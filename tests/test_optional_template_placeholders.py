from pathlib import Path


def test_optional_template_placeholders():
    template_path = Path(r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\template.html")
    template = template_path.read_text() if template_path.exists() else ""
    optional = ['{title}', '{subtitle}', '{footer}', '{nav}']
    found = [token for token in optional if token in template]
    assert found, "Optional placeholders are not present in template.html"