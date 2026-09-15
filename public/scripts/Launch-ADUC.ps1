# Miami-Dade County Help Desk
# Optional helper. The Help Desk browser can run this tool in memory with
# no file on disk. If you keep a copy, store it in the folder configured in
# Settings (default: %LOCALAPPDATA%\MDCHelpDesk\Scripts).
# The browser supplies -UserId and pipes the password on stdin.
# Never paste a password into this file.
# Double-clicking still works: you will be prompted for User ID and password.

param(
  [string]$UserId
)

$ErrorActionPreference = "Stop"

function Read-LaunchPassword {
  param([string]$UserId)
  if ([Console]::IsInputRedirected) {
    $line = [Console]::In.ReadLine()
    if ([string]::IsNullOrWhiteSpace($line)) {
      throw "No password was supplied on stdin."
    }
    $secure = ConvertTo-SecureString -String $line -AsPlainText -Force
    $line = $null
    return $secure
  }
  return Read-Host "Password for $UserId" -AsSecureString
}

if (-not $UserId) {
  $UserId = Read-Host "User ID (DOMAIN\id)"
}
if ([string]::IsNullOrWhiteSpace($UserId)) {
  throw "User ID is required."
}

$secure = Read-LaunchPassword -UserId $UserId
$cred = New-Object System.Management.Automation.PSCredential ($UserId, $secure)

$mmc = Join-Path $env:SystemRoot "System32\mmc.exe"
if (-not (Test-Path $mmc)) {
  throw "mmc.exe was not found at $mmc"
}

Start-Process -FilePath $mmc -ArgumentList "dsa.msc" -Credential $cred -LoadUserProfile -WorkingDirectory $env:SystemRoot
