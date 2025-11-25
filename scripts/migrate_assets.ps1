#Requires -Version 5.0
$ErrorActionPreference = 'Stop'

function Ensure-Dir($path) {
  if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# If the script is run from repository root, adjust $root accordingly
if (Test-Path -LiteralPath (Join-Path $root 'assets')) {
  $repoRoot = $root
} else {
  $repoRoot = (Get-Location).Path
}

$assetsImages = Join-Path $repoRoot 'assets\images'
$oldImagesDir = Join-Path $repoRoot 'imges'

Ensure-Dir $assetsImages

Write-Host "Moving images from '$oldImagesDir' to '$assetsImages'..."

if (Test-Path -LiteralPath $oldImagesDir) {
  # Move subfolders preserving structure
  Get-ChildItem -LiteralPath $oldImagesDir -Directory | ForEach-Object {
    $src = $_.FullName
    $rel = $_.Name
    $dest = Join-Path $assetsImages $rel
    Ensure-Dir $dest
    Get-ChildItem -LiteralPath $src -File -Recurse | ForEach-Object {
      $target = Join-Path $dest ($_.FullName.Substring($src.Length).TrimStart('\\'))
      Ensure-Dir (Split-Path -Parent $target)
      Move-Item -LiteralPath $_.FullName -Destination $target -Force
    }
  }

  # Move files in root of imges to assets/images
  Get-ChildItem -LiteralPath $oldImagesDir -File | ForEach-Object {
    Move-Item -LiteralPath $_.FullName -Destination (Join-Path $assetsImages $_.Name) -Force
  }
}
else {
  Write-Host "Old images directory not found: $oldImagesDir" -ForegroundColor Yellow
}

Write-Host "Updating code references from 'assets/images/' to 'assets/images/'..."

$files = Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Include *.html, *.js
foreach ($file in $files) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  $updated = $content -replace 'assets/images/', 'assets/images/'
  if ($updated -ne $content) {
    Set-Content -LiteralPath $file.FullName -Value $updated -Encoding UTF8
    Write-Host "Updated paths in: $($file.FullName)"
  }
}

Write-Host "Done. Images moved and references updated." -ForegroundColor Green

