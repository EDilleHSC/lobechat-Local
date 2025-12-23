Describe 'Route to Office resolution' {
  $naviRoot = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI'
  It 'loads routing_config and has function_to_office mappings' {
    $cfg = Get-Content (Join-Path $naviRoot 'config\routing_config.json') -Raw | ConvertFrom-Json
    $cfg.function_to_office | Should -Not -BeNullOrEmpty
    $cfg.function_to_office.Finance | Should -Be 'CFO'
    $cfg.function_to_office.DevOps | Should -Be 'DREW'
  }

  function Map-Route-To-Office($route, $cfg) {
    # try exact match on function keys
    foreach ($k in $cfg.function_to_office.PSObject.Properties) {
      if ($k.Name.ToLower() -eq $route.ToLower()) { return $k.Value }
    }
    # check segments
    $parts = $route -split '\.'
    foreach ($seg in $parts) {
      foreach ($k in $cfg.function_to_office.PSObject.Properties) {
        if ($k.Name.ToLower() -eq $seg.ToLower()) { return $k.Value }
      }
    }
    return $null
  }

  It 'maps Finance and Finance.* to CFO' {
    $cfg = Get-Content (Join-Path $naviRoot 'config\routing_config.json') -Raw | ConvertFrom-Json
    (Map-Route-To-Office -route 'Finance' -cfg $cfg) | Should -Be 'CFO'
    (Map-Route-To-Office -route 'Desk.Finance' -cfg $cfg) | Should -Be 'CFO'
  }

  It 'maps DevOps keywords to DREW' {
    $cfg = Get-Content (Join-Path $naviRoot 'config\routing_config.json') -Raw | ConvertFrom-Json
    (Map-Route-To-Office -route 'DevOps' -cfg $cfg) | Should -Be 'DREW'
    (Map-Route-To-Office -route 'Infra.DevOps' -cfg $cfg) | Should -Be 'DREW'
  }

  It 'verifies target inbox folders exist for mapped offices' {
    $cfg = Get-Content (Join-Path $naviRoot 'config\routing_config.json') -Raw | ConvertFrom-Json
    foreach ($p in $cfg.function_to_office.PSObject.Properties) {
      $office = $p.Value
      $inbox = Join-Path $naviRoot (Join-Path 'offices' (Join-Path $office 'inbox'))
      Test-Path $inbox | Should -BeTrue
    }
  }
}
