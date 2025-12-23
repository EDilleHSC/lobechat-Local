param(
  [string]$Path,
  [int]$Skip,
  [int]$Count
)
$i = $Skip + 1
Get-Content $Path | Select-Object -Skip $Skip -First $Count | ForEach-Object {
  Write-Output ("$i`: $_")
  $i += 1
}