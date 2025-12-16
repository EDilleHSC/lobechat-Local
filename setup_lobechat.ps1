$ErrorActionPreference = "Stop"

$url = "https://github.com/lobehub/lobe-chat/archive/refs/heads/main.zip"
$zipPath = "D:\07_DOWNLOADS_TEMP-Process\lobe-chat-main.zip"
$destPath = "D:\04_PROJECTS-Active\LobeChat_Dev"

Write-Host "🚀 Setting up LobeChat Development Environment..."

# 1. Create Directories
New-Item -ItemType Directory -Force -Path "D:\07_DOWNLOADS_TEMP-Process" | Out-Null
New-Item -ItemType Directory -Force -Path $destPath | Out-Null

# 2. Download Source Code
if (-not (Test-Path $zipPath)) {
    Write-Host "📥 Downloading LobeChat source code..."
    Invoke-WebRequest -Uri $url -OutFile $zipPath
}

# 3. Extract
Write-Host "📦 Extracting files..."
Expand-Archive -Path $zipPath -DestinationPath "D:\07_DOWNLOADS_TEMP-Process" -Force

# 4. Move to Project Folder
Write-Host "📂 Moving to project folder..."
Copy-Item -Path "D:\07_DOWNLOADS_TEMP-Process\lobe-chat-main\*" -Destination $destPath -Recurse -Force

# 5. Install Dependencies
Write-Host "📦 Installing dependencies (this may take a few minutes)..."
Set-Location $destPath
npm install

Write-Host "✅ Setup Complete!"
Write-Host "👉 To start LobeChat, run: npm run dev"
