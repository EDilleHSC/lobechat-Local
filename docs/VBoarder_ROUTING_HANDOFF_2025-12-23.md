# VBoarder Routing Handoff (Updated 2025-12-26)

**Status:** Production Ready  
**Updated:** 2025-12-26  
**Previous Version:** 2025-12-23 (12 offices → now 9 offices)

---

## CHANGE SUMMARY (v2.1)

| Change | Old | New |
|--------|-----|-----|
| Office count | 12 | **9** |
| COS | Routing destination | **Orchestrator only** (no inbox) |
| NAVI | Had inbox | **Mail room system** (no inbox) |
| DREW | Had inbox | **Sub-agent under CTO** (no inbox) |
| DESK function | Routed to COS | **Routes to EXEC** |
| DevOps function | Routed to DREW | **Routes to CTO** |
| Insurance docs | AI-determined | **ALWAYS CFO** (override) |
| AI normalization | None | **Invalid depts → EXEC fallback** |

---

## 9 ROUTING DESTINATIONS ✅

| Office | Agent | Function | Notes |
|--------|-------|----------|-------|
| CFO | Finn | Finance, **Insurance** | Insurance override forces CFO |
| CLO | Luca | Legal | |
| COO | Omar | Operations | |
| CSO | Sage | Sales | |
| CMO | Maya | Marketing | |
| CTO | Tara | Tech, **DevOps** | Drew is sub-agent |
| AIR | Air | Knowledge | |
| EXEC | Clara | Executive, **Triage, DESK** | Handles escalations |
| GYFOLE | Gyfole | Strategic | |

## NOT ROUTING DESTINATIONS

| Code | Role | Reason |
|------|------|--------|
| COS | Orchestrator | Alex coordinates agents, doesn't receive mail |
| NAVI | Mail Room | Processes mail, doesn't receive it |
| DREW | Sub-agent | Reports to CTO; Tara delegates DevOps tasks |

---

## SETUP: CREATE 9 OFFICE FOLDERS

```powershell
$offices = @('CFO','CLO','COO','CSO','CMO','CTO','AIR','EXEC','GYFOLE')
$naviRoot = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI'

# Remove old orchestrator folders if they exist
@('COS','NAVI','DREW') | ForEach-Object {
    $path = Join-Path $naviRoot "offices\$_"
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force
        Write-Host "Removed: $_" -ForegroundColor Yellow
    }
}

# Create 9 offices
foreach ($office in $offices) {
    $path = Join-Path $naviRoot "offices\$office\inbox"
    if (!(Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "Created: $office" -ForegroundColor Green
    } else {
        Write-Host "Exists:  $office" -ForegroundColor Cyan
    }
}

Write-Host "`n9 offices ready" -ForegroundColor Green
```

---

## ROUTING CONFIG REQUIREMENTS

### function_to_office mapping

```json
{
  "function_to_office": {
    "Finance": "CFO",
    "Legal": "CLO",
    "Ops": "COO",
    "Sales": "CSO",
    "Marketing": "CMO",
    "Tech": "CTO",
    "DevOps": "CTO",
    "Knowledge": "AIR",
    "Exec": "EXEC",
    "DESK": "EXEC",
    "Strategic": "GYFOLE"
  }
}
```

### Key changes from v1:
- `DevOps` → `CTO` (not DREW)
- `DESK` → `EXEC` (not COS)

---

## VERIFICATION SCRIPT

```powershell
# 1. Check all 9 offices exist
$offices = @('CFO','CLO','COO','CSO','CMO','CTO','AIR','EXEC','GYFOLE')
$naviRoot = 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\offices'

Write-Host "=== Office Status ===" -ForegroundColor Yellow
foreach ($office in $offices) {
    $exists = Test-Path "$naviRoot\$office\inbox"
    if ($exists) {
        Write-Host "  ✓ $office" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $office (MISSING)" -ForegroundColor Red
    }
}

# 2. Check orchestrator folders are GONE
Write-Host "`n=== Orchestrator Folders (should NOT exist) ===" -ForegroundColor Yellow
@('COS','NAVI','DREW') | ForEach-Object {
    $exists = Test-Path "$naviRoot\$_"
    if ($exists) {
        Write-Host "  ✗ $_ EXISTS (should be removed)" -ForegroundColor Red
    } else {
        Write-Host "  ✓ $_ correctly absent" -ForegroundColor Green
    }
}

# 3. Check config mappings
Write-Host "`n=== Config Mappings ===" -ForegroundColor Yellow
$config = Get-Content 'D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\config\routing_config.json' -Raw | ConvertFrom-Json
Write-Host "  DESK   → $($config.function_to_office.DESK)" -ForegroundColor Cyan
Write-Host "  DevOps → $($config.function_to_office.DevOps)" -ForegroundColor Cyan
```

---

## INSURANCE OVERRIDE BEHAVIOR

Insurance documents **ALWAYS** route to CFO regardless of AI classification.

**Triggers:**
- Filename contains: `insurance`, `ins`, `policy`, `premium`, `progressive`, `geico`, `allstate`, `coverage`
- Extracted text contains insurance keywords
- AI reasoning mentions insurance

**Result:** CFO with 95% confidence, auto-route enabled

**Test:**
```powershell
# Drop insurance test file
"Progressive Insurance Policy #12345" | Out-File -Encoding utf8 "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\inbox\Test_Insurance.pdf"

# Process
curl -sS -X POST http://127.0.0.1:8005/process -H "Content-Type: application/json" -d "{}"

# Verify landed in CFO
Get-ChildItem "D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI\offices\CFO\inbox" -Recurse -Filter "*Insurance*"
```

---

## AI NORMALIZATION

AI may return invalid department names. The system normalizes:

| AI Returns | Normalized To |
|------------|---------------|
| `legal/finance` | CFO |
| `Classification/*` | EXEC |
| `none`, `unknown` | EXEC |
| Invalid strings | EXEC |

**Valid departments:** CFO, CLO, CMO, CTO, COO, CSO, EXEC, AIR, GYFOLE

---

## FULL VERIFICATION CHECKLIST

- [ ] 9 office folders exist (CFO, CLO, COO, CSO, CMO, CTO, AIR, EXEC, GYFOLE)
- [ ] 3 orchestrator folders removed (COS, NAVI, DREW)
- [ ] Config: `DESK` → `EXEC`
- [ ] Config: `DevOps` → `CTO`
- [ ] Insurance test file → CFO
- [ ] Server running on port 8005
- [ ] Unit tests pass: `npm run test:unit`

---

*Updated: 2025-12-26*
