$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host '🤖 Setting up AI tools for the DTF Games workspace' -ForegroundColor Green
Write-Host '=================================================='

if (-not (Test-Path 'package.json')) { throw 'Run this from the dtfgenetics/Thc repository; package.json is missing.' }
if (-not (Test-Path 'package-lock.json')) { throw 'package-lock.json is required. This workspace is npm-based.' }
if (-not (Test-Path 'AGENTS.md')) { throw 'AGENTS.md is missing. Repository agent rules must exist before setup.' }
if (-not (Test-Path 'CLAUDE.md')) { throw 'CLAUDE.md is missing. Repository safety rules must exist before setup.' }
if (-not (Test-Path 'AI_CONTEXT.md')) { throw 'AI_CONTEXT.md is missing.' }

$nodeVersion = (& node --version)
if ($LASTEXITCODE -ne 0) { throw 'Node.js is required. Install Node.js 22 or newer.' }
$nodeMajor = [int](($nodeVersion -replace '^v','').Split('.')[0])
if ($nodeMajor -lt 22) { throw "Node.js 22 or newer is required; found $nodeVersion." }

$npmVersion = (& npm --version)
if ($LASTEXITCODE -ne 0) { throw 'npm is required.' }

Write-Host "✓ Node $nodeVersion" -ForegroundColor Green
Write-Host "✓ npm $npmVersion" -ForegroundColor Green
Write-Host '✓ Repository agent instructions found' -ForegroundColor Green

Write-Host '📦 Installing the committed dependency graph with npm ci...' -ForegroundColor Yellow
npm ci

Write-Host '🧭 Checking game ownership and deployment routes...' -ForegroundColor Yellow
npm run games:status

Write-Host '🧪 Running the unified game preflight...' -ForegroundColor Yellow
npm run games:preflight

Write-Host '✓ AI-friendly DTF workspace setup complete' -ForegroundColor Green
Write-Host ''
Write-Host 'Read first: AGENTS.md → CLAUDE.md → AI_CONTEXT.md → project source-of-truth docs'
Write-Host 'Before editing a game: npm run games:status -- --id <game-id>'
Write-Host 'Before opening a PR: npm run games:preflight'
