param(
  [string]$Task = ":app:assembleDebug",
  [ValidatePattern('^[A-Z]$')]
  [string]$DriveLetter = "M"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$driveRoot = "${DriveLetter}:"
$substed = $false

try {
  $existing = (& subst) | Where-Object { $_ -like "$driveRoot*" }
  if ($existing) {
    $mappedTarget = (($existing -split '=>', 2)[1] | ForEach-Object { $_.Trim() })
    if ($mappedTarget -ne $projectRoot) {
      & subst $driveRoot /d | Out-Null
      $existing = $null
    }
  }

  if (-not $existing) {
    & subst $driveRoot "$projectRoot"
    $substed = $true
  }

  $androidPath = "$driveRoot\android"
  $ready = $false
  for ($i = 0; $i -lt 10; $i++) {
    if (Test-Path $androidPath) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 300
  }

  if (-not $ready) {
    throw "SUBST mapping failed for $androidPath"
  }

  Push-Location $androidPath
  & .\gradlew --stop | Out-Null
  & .\gradlew $Task
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location -ErrorAction SilentlyContinue
  if ($substed) {
    & subst $driveRoot /d | Out-Null
  }
}
