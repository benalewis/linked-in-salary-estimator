#Requires -Version 5.1
<#
.SYNOPSIS
  Builds the extension and opens Chrome with the unpacked MV3 build loaded.

.NOTES
  This script cannot programmatically click Reload on chrome://extensions for an
  already-open Chrome profile (Chrome does not expose that to plain PowerShell).

  What it does instead: each run starts a new Chrome process with
  --load-extension pointing at .output\chrome-mv3. Chrome reads that folder at
  process startup, so you do not need Reload for this test window—only rebuild
  and run the script again (or use -SkipBuild after a successful build).

  If you installed the extension via Load unpacked in your main browser, you
  still need manual Reload there after each build, or test only via this script.

.USAGE
  .\test-chrome.ps1
  .\test-chrome.ps1 -SkipBuild
  .\test-chrome.ps1 -Url 'https://www.linkedin.com/feed/'
  .\test-chrome.ps1 -Dev
#>
param(
  [switch]$SkipBuild,
  [switch]$Dev,
  [string]$Url = 'https://www.linkedin.com/in/ben-l-b46521230/'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location -LiteralPath $root

if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json'))) {
  Write-Error 'Run this script from the repository root (same folder as package.json).'
}

if ($Dev) {
  npm run dev
  exit $LASTEXITCODE
}

if (-not $SkipBuild) {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$extDir = Join-Path $root '.output\chrome-mv3'
if (-not (Test-Path -LiteralPath $extDir)) {
  Write-Error "Missing build output: $extDir - run without -SkipBuild first."
}

$candidates = @(
  (Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe')
)

$chrome = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $chrome) {
  $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    $chrome = $cmd.Source
  }
}

if (-not $chrome) {
  Write-Error 'Google Chrome not found. Install Chrome or ensure chrome.exe is on PATH.'
}

# New Chrome reads .output\chrome-mv3 at startup—no chrome://extensions Reload for this window.
Start-Process -FilePath $chrome -ArgumentList @(
  "--load-extension=$extDir",
  $Url
)

Write-Host 'Chrome opened with --load-extension (latest build from disk for this process). Re-run this script after npm run build to pick up changes; use -Dev for watch mode.'
