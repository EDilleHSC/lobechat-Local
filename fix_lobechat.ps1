$ErrorActionPreference = "Stop"
$projectPath = "D:\04_PROJECTS-Active\LobeChat_Dev"

Write-Host "🔧 Fixing LobeChat Setup..."

# 1. Check for pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing pnpm..."
    npm install -g pnpm
}

# 2. Install Dependencies with pnpm
Write-Host "📦 Installing dependencies with pnpm (this is the correct way)..."
Set-Location $projectPath
pnpm install

# 3. Start Dev Server
Write-Host "🚀 Starting LobeChat..."
Write-Host "👉 If it asks to install 'bun', say yes or install it manually."
pnpm run dev
