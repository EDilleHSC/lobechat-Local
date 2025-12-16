from pathlib import Path


def test_smoke_presenter_html():
    path = Path(r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\presenter\index.html")
    assert path.exists(), "index.html not found"
    txt = path.read_text()

    # Required classes
    assert 'content-grid' in txt, "Missing 'content-grid'"
    assert 'actions-section' in txt, "Missing 'actions-section'"
    assert 'file-card' in txt, "Missing 'file-card'"

    # Footer appears exactly once (as a div.footer)
    footer_count = txt.count('<div class="footer"')
    assert footer_count == 1, f"Expected 1 <div class=\"footer\", found {footer_count}"