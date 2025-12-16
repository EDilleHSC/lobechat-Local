$ie = New-Object -ComObject 'InternetExplorer.Application'
$ie.Visible = $false
$url = 'file:///D:/05_AGENTS-AI/01_RUNTIME/VBoarder/NAVI/presenter/index.html'
$ie.Navigate($url)
$tries = 0
while (($ie.Busy -or $ie.ReadyState -ne 4) -and $tries -lt 200) {
    Start-Sleep -Milliseconds 100
    $tries++
}
if ($tries -ge 200) {
    Write-Host '✗ Timeout waiting for page load'
    $ie.Quit()
    exit 1
}
$doc = $ie.Document
$el = $doc.querySelector('.actions-section')
if (-not $el) {
    Write-Host '✗ .actions-section not found'
    $ie.Quit()
    exit 1
}
$win = $doc.parentWindow
$script = @"
(function(){
  var el = document.querySelector('.actions-section');
  if(!el) { return 'NO_EL' }
  var s = getComputedStyle(el);
  el.setAttribute('data-display', s.display);
  el.setAttribute('data-flex', s.flexDirection);
  el.setAttribute('data-children', el.children.length);
  for(var i=0;i<el.children.length;i++){
    var c = getComputedStyle(el.children[i]);
    el.children[i].setAttribute('data-display', c.display);
    el.children[i].setAttribute('data-margin-left', c.marginLeft);
    el.children[i].setAttribute('data-margin-top', c.marginTop);
  }
  return 'OK';
})();
"@

$win.execScript($script)
Write-Host 'script executed'
Write-Host 'display:' $el.getAttribute('data-display')
Write-Host 'flex-direction:' $el.getAttribute('data-flex')
Write-Host 'children-count:' $el.getAttribute('data-children')
for ($i = 0; $i -lt $el.children.length; $i++) {
    $child = $el.children.item($i)
    Write-Host ('child[{0}] display: {1}, margin-left: {2}, margin-top: {3}' -f $i, $child.getAttribute('data-display'), $child.getAttribute('data-margin-left'), $child.getAttribute('data-margin-top'))
}
$ie.Quit()