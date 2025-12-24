param(
  [string]$RouteFolder = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\HOLDING\review\unknown",
  [string]$PackagesRoot = "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\packages",
  [int]$Limit = 0,            # 0 = all available
  [switch]$Zip,              # add -Zip to create a zip archive
  [string]$Department       # Optional department name for package naming
)

# Prepare
$now = Get-Date
$timestamp = $now.ToString("yyyy-MM-dd_HH-mm-ss")

function Sanitize-Name($n) {
    return ($n -replace '[\\/\s]+', '_') -replace '[^A-Za-z0-9_\-]', '' -replace '\s+', '_' | ForEach-Object { $_.ToUpper() }
}

New-Item -ItemType Directory -Path $PackagesRoot -Force | Out-Null
if ($Department) {
    $dept = Sanitize-Name $Department
    $pkgName = "${dept}_$timestamp"
} else {
    $pkgName = "package_$timestamp"
}
$pkgDir = Join-Path $PackagesRoot $pkgName
New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null

# Find candidate files (only files, skip sidecars)
$files = Get-ChildItem -Path $RouteFolder -File | Where-Object { $_.Name -notlike "*.navi.json" -and $_.Name -notlike "*.meta.json" } | Sort-Object LastWriteTime

if ($Limit -gt 0) { $files = $files | Select-Object -First $Limit }

$manifest = @()
foreach ($f in $files) {
    $base = $f.FullName
    $navi = Join-Path $RouteFolder ($f.Name + ".navi.json")
    $meta = Join-Path $RouteFolder ($f.Name + ".meta.json")

    # Skip if already packaged flag set
    $packaged = $false
    if (Test-Path $navi) {
        try {
            $jn = Get-Content $navi -Raw | ConvertFrom-Json
            # Only treat as already-packaged when sidecar is an object with packaged==true
            if (-not ($jn -is [System.Array]) -and -not ($jn -is [System.String]) -and ($jn.packaged -eq $true)) { $packaged = $true }
        } catch {}
    }

    if ($packaged) {
        Write-Host "Skipping (already packaged): $($f.Name)"
        continue
    }

    # Copy file and sidecars
    Copy-Item -Path $f.FullName -Destination $pkgDir -Force
    if (Test-Path $navi) { Copy-Item -Path $navi -Destination $pkgDir -Force }
    if (Test-Path $meta) { Copy-Item -Path $meta -Destination $pkgDir -Force }

    # Update .navi.json packaged flag (write back to source where safe)
    if (Test-Path $navi) {
        try {
            $raw = Get-Content $navi -Raw
            $convError = $false
            try {
                $j = $raw | ConvertFrom-Json
            } catch {
                # not JSON or primitive
                $convError = $true
                $j = $raw
            }

            $isObject = -not ($j -is [System.Array]) -and -not ($j -is [System.String]) -and -not ($j -is [System.ValueType])
            $pkgNavi = Join-Path $pkgDir ($f.Name + ".navi.json")

            if ($isObject -and -not $convError) {
                # Try adding the packaged flag safely
                $added = $false
                try {
                    Add-Member -InputObject $j -NotePropertyName 'packaged' -NotePropertyValue $true -Force
                    $json = $j | ConvertTo-Json -Depth 10
                    $tmp = "$navi.tmp"
                    $json | Set-Content -Path $tmp -Encoding UTF8
                    Move-Item -Path $tmp -Destination $navi -Force
                    $json | Set-Content -Path $pkgNavi -Encoding UTF8
                    $added = $true
                } catch {
                    # Fallback: merge properties into a new object
                    try {
                        $merged = @{}
                        $j | Get-Member -MemberType NoteProperty | ForEach-Object { $name = $_.Name; $merged[$name] = $j.$name }
                        $merged['packaged'] = $true
                        $json = $merged | ConvertTo-Json -Depth 10
                        $json | Set-Content -Path $navi -Encoding UTF8
                        $json | Set-Content -Path $pkgNavi -Encoding UTF8
                        $added = $true
                    } catch {
                        Write-Warning "Could not add packaged to original .navi.json for $($f.Name); writing wrapper only"
                    }
                }

                if (-not $added) {
                    $wrapper = [PSCustomObject]@{
                        packaged = $true
                        note = 'could not modify original .navi.json; wrapper created'
                    }
                    $wrapper | ConvertTo-Json -Depth 10 | Set-Content -Path $pkgNavi -Encoding UTF8
                }
            } else {
                # Original sidecar not modifiable or invalid JSON; write wrapper to package folder
                $wrapper = [PSCustomObject]@{
                    packaged = $true
                    note = 'original .navi.json had non-object shape or invalid JSON; original left unchanged'
                    original_shape = if ($convError) { 'invalid_json' } else { $j.GetType().FullName }
                }
                $wrapper | ConvertTo-Json -Depth 10 | Set-Content -Path $pkgNavi -Encoding UTF8
            }
        } catch { Write-Warning "Failed to update navi for $($f.Name): $_" }
    }

    $manifest += [PSCustomObject]@{
        filename = $f.Name
        route = "mail_room.review_required"
        applied_at = $f.LastWriteTimeUtc.ToString("o")
        navi = if (Test-Path $navi) { (Join-Path $pkgDir ($f.Name + ".navi.json")) } else { "" }
        meta = if (Test-Path $meta) { (Join-Path $pkgDir ($f.Name + ".meta.json")) } else { "" }
        packaged_at = $now.ToString("o")
    }
}

# Write manifest.csv
$manifestPath = Join-Path $pkgDir "manifest.csv"
$manifest | Export-Csv -Path $manifestPath -NoTypeInformation -Encoding UTF8

# Write README.md
$readmePath = Join-Path $pkgDir "README.md"
$summary = @()
$summary += "# NAVI Package - $timestamp"
$summary += ""
$summary += "Created: $($now.ToString('o'))"
$summary += ""
$summary += "Files packaged: $($manifest.Count)"
$summary += ""
$summary += "## Contents"
foreach ($m in $manifest) {
    $summary += "- $($m.filename) — $($m.route) — applied_at: $($m.applied_at)"
}
$summary | Out-File -FilePath $readmePath -Encoding utf8

if ($Zip) {
    $zipPath = "$pkgDir.zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($pkgDir, $zipPath)
    Write-Host "Created zip: $zipPath"
}

Write-Host "Package created: $pkgDir"
Write-Host "Manifest: $manifestPath"