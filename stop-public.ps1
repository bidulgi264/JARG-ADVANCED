$ErrorActionPreference = "Stop"
$stateFile = Join-Path $PSScriptRoot ".runtime\processes.json"

if (-not (Test-Path -LiteralPath $stateFile)) {
  Write-Host "[JARG] No tracked JARG processes are running."
  exit 0
}

$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($name in @("tunnel", "email", "backend")) {
  $id = $state.$name
  if (-not $id) { continue }
  $process = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $id -Force
    Write-Host "[JARG] Stopped $name."
  }
}

Remove-Item -LiteralPath $stateFile -Force
Write-Host "[JARG] Stopped. SQLite progress remains in the data directory."
