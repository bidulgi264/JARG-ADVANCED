[CmdletBinding()]
param(
  [switch]$SkipEmail
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$runtimeDir = Join-Path $root ".runtime"
$toolsDir = Join-Path $root ".tools"
$stateFile = Join-Path $runtimeDir "processes.json"
$backendUrl = "http://127.0.0.1:3100"

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-EnvValue([string]$Path, [string]$Name) {
  if (-not (Test-Path -LiteralPath $Path)) { return "" }
  $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
  if (-not $line) { return "" }
  return ($line -split "=", 2)[1].Trim()
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^$([regex]::Escape($Name))=") {
      $found = $true
      "$Name=$Value"
    } else {
      $line
    }
  }
  if (-not $found) { $updated += "$Name=$Value" }
  Set-Content -LiteralPath $Path -Value $updated -Encoding utf8
}

function Test-Placeholder([string]$Value) {
  return [string]::IsNullOrWhiteSpace($Value) -or
    $Value -match "^(your-|use-the-same|change-me)" -or
    $Value -eq "your-account@gmail.com"
}

if (Test-Path -LiteralPath $stateFile) {
  $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
  $running = @($state.PSObject.Properties.Value | Where-Object {
    $_ -and (Get-Process -Id $_ -ErrorAction SilentlyContinue)
  })
  if ($running.Count -gt 0) {
    throw "JARG is already running. Run .\stop-public.ps1 first."
  }
  Remove-Item -LiteralPath $stateFile -Force
}

$node = Get-Command node -ErrorAction Stop
$nodeMajor = [int]((& $node.Source --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 24) {
  throw "Node.js 24 or newer is required. Current version: $(& $node.Source --version)"
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $toolsDir | Out-Null

$appEnv = Join-Path $root ".env"
if (-not (Test-Path -LiteralPath $appEnv)) {
  Copy-Item -LiteralPath (Join-Path $root ".env.example") -Destination $appEnv
}

$pepper = Get-EnvValue $appEnv "ANSWER_PEPPER"
if (Test-Placeholder $pepper) {
  Set-EnvValue $appEnv "ANSWER_PEPPER" (New-RandomSecret)
}

$emailSecret = Get-EnvValue $appEnv "EMAIL_WEBHOOK_SECRET"
if (Test-Placeholder $emailSecret) {
  $emailSecret = New-RandomSecret
  Set-EnvValue $appEnv "EMAIL_WEBHOOK_SECRET" $emailSecret
}

$workerDir = Join-Path $root "email-worker"
$workerEnv = Join-Path $workerDir ".env"
if (-not (Test-Path -LiteralPath $workerEnv)) {
  Copy-Item -LiteralPath (Join-Path $workerDir ".env.example") -Destination $workerEnv
}
Set-EnvValue $workerEnv "JARG_API_URL" $backendUrl
Set-EnvValue $workerEnv "JARG_EMAIL_SECRET" $emailSecret

$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflaredCommand) {
  $cloudflared = $cloudflaredCommand.Source
} else {
  $cloudflared = Join-Path $toolsDir "cloudflared.exe"
  if (-not (Test-Path -LiteralPath $cloudflared)) {
    Write-Output "[JARG] Downloading the Cloudflare Tunnel client (first run only)..."
    Invoke-WebRequest `
      -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
      -OutFile $cloudflared
  }
}

$processes = [ordered]@{}

try {
  $backendOut = Join-Path $runtimeDir "backend.log"
  $backendErr = Join-Path $runtimeDir "backend-error.log"
  Remove-Item -LiteralPath $backendOut, $backendErr -Force -ErrorAction SilentlyContinue
  $backend = Start-Process `
    -FilePath $node.Source `
    -ArgumentList @("--env-file-if-exists=.env", "server/index.js") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -PassThru
  $processes.backend = $backend.Id

  $healthy = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Uri "$backendUrl/api/health" -TimeoutSec 2
      if ($health.ok) { $healthy = $true; break }
    } catch {
      if ($backend.HasExited) { break }
    }
  }
  if (-not $healthy) {
    $detail = if (Test-Path $backendErr) { Get-Content $backendErr -Raw } else { "No log available" }
    throw "The backend did not start: $detail"
  }

  $emailReady = -not $SkipEmail
  foreach ($name in @("SMTP_USER", "SMTP_PASS", "IMAP_USER", "IMAP_PASS")) {
    if (Test-Placeholder (Get-EnvValue $workerEnv $name)) { $emailReady = $false }
  }

  if ($emailReady) {
    if (-not (Test-Path -LiteralPath (Join-Path $workerDir "node_modules"))) {
      Write-Output "[JARG] Installing email responder dependencies..."
      & npm.cmd ci --prefix $workerDir
      if ($LASTEXITCODE -ne 0) { throw "Email responder dependency installation failed." }
    }

    $emailOut = Join-Path $runtimeDir "email.log"
    $emailErr = Join-Path $runtimeDir "email-error.log"
    Remove-Item -LiteralPath $emailOut, $emailErr -Force -ErrorAction SilentlyContinue
    $email = Start-Process `
      -FilePath $node.Source `
      -ArgumentList @("src/poller.js") `
      -WorkingDirectory $workerDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $emailOut `
      -RedirectStandardError $emailErr `
      -PassThru
    $processes.email = $email.Id
  }

  $tunnelOut = Join-Path $runtimeDir "tunnel.log"
  $tunnelErr = Join-Path $runtimeDir "tunnel-error.log"
  Remove-Item -LiteralPath $tunnelOut, $tunnelErr -Force -ErrorAction SilentlyContinue
  $tunnel = Start-Process `
    -FilePath $cloudflared `
    -ArgumentList @("tunnel", "--url", $backendUrl, "--no-autoupdate") `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $tunnelOut `
    -RedirectStandardError $tunnelErr `
    -PassThru
  $processes.tunnel = $tunnel.Id

  $publicUrl = ""
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    $logs = @()
    if (Test-Path $tunnelOut) { $logs += Get-Content $tunnelOut -Raw }
    if (Test-Path $tunnelErr) { $logs += Get-Content $tunnelErr -Raw }
    $match = [regex]::Match(($logs -join "`n"), "https://[a-z0-9-]+\.trycloudflare\.com")
    if ($match.Success) { $publicUrl = $match.Value; break }
    if ($tunnel.HasExited) { break }
  }
  if (-not $publicUrl) {
    throw "Could not create a public tunnel. Check .runtime/tunnel-error.log."
  }

  $processes.publicUrl = $publicUrl
  $processes.startedAt = (Get-Date).ToString("o")
  $processes | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding utf8

  try { Set-Clipboard -Value $publicUrl } catch { }
  Write-Output ""
  Write-Output "[JARG] Public URL: $publicUrl"
  Write-Output "[JARG] The URL was copied to the clipboard."
  if ($emailReady) {
    Write-Output "[JARG] The email responder is running."
  } elseif ($SkipEmail) {
    Write-Output "[JARG] The email responder was skipped with -SkipEmail."
  } else {
    Write-Output "[JARG] The email responder is not configured yet."
    Write-Output "       Add the Gmail address and app password to email-worker/.env, then restart."
  }
  Write-Output "[JARG] Stop command: .\stop-public.ps1"
} catch {
  foreach ($id in @($processes.backend, $processes.email, $processes.tunnel)) {
    if ($id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  }
  throw
}
