# Enable process-creation auditing and include command line in events
# Requires Administrator privileges

Param(
  [int]$EnableCmdLine = 1
)

function Assert-Admin {
  if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Error "This script must be run as Administrator."; exit 1
  }
}

Assert-Admin

Write-Output "Setting registry key to include process command-line in event 4688..."
$regPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit'
if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
Set-ItemProperty -Path $regPath -Name ProcessCreationIncludeCmdLine -Value $EnableCmdLine -Type DWord -Force
Write-Output "Registry set: $regPath\ProcessCreationIncludeCmdLine = $EnableCmdLine"

Write-Output "Enabling Audit Policy for Process Creation (subcategory: 'Process Creation')..."
# Enable success auditing for Process Creation
cmd /c "auditpol /set /subcategory:\"Process Creation\" /success:enable /failure:enable" | Out-Null
Write-Output "Audit policy updated."

Write-Output "Done. To revert, run: cmd /c \"auditpol /set /subcategory:\"Process Creation\" /success:disable /failure:disable\" and set registry key to 0." 
Write-Output "Note: Changes affect Security log and may take effect immediately. Be mindful of Security log size."