Describe 'cleanup-reset-runlog dry-run behavior' {
  $temp = Join-Path $env:TEMP ("navi_test_" + (Get-Random))
  BeforeAll {
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    # create minimal NAVI structure
    New-Item -ItemType Directory -Path (Join-Path $temp 'NAVI\packages') -Force | Out-Null
    New-Item -ItemType File -Path (Join-Path $temp 'NAVI\packages\dummy.txt') -Force | Out-Null
  }
  AfterAll {
    Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
  }

  It 'does not remove files on DryRun and prints DRYRUN lines' {
    $script = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\scripts\cleanup-reset-runlog.ps1')
    $cmd = "& { . $script -NaviRoot '$($temp)\NAVI' -Scope tests -DryRun }"
    $output = pwsh -NoProfile -Command $cmd 2>&1
    $output | Should -Contain '[DRYRUN]'
    (Test-Path (Join-Path $temp 'NAVI\packages\dummy.txt')) | Should -Be $true
  }
}