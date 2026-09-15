# Miami-Dade County Help Desk
# Optional helper. The Help Desk browser can run this tool in memory with
# no file on disk. If you keep a copy, store it in the folder configured in
# Settings (default: %LOCALAPPDATA%\MDCHelpDesk\Scripts).
# The browser supplies -UserId and pipes the password on stdin.
# Never paste a password into this file.
# Double-clicking still works: you will be prompted for User ID and password.

param(
  [string]$UserId,
  [string]$ComputerName
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

function Find-CmRcViewer {
  $candidates = @(
    "${env:ProgramFiles(x86)}\Microsoft Configuration Manager\AdminConsole\bin\i386\CmRcViewer.exe",
    "$env:ProgramFiles\Microsoft Configuration Manager\AdminConsole\bin\i386\CmRcViewer.exe",
    "${env:ProgramFiles(x86)}\ConfigMgr\AdminConsole\bin\i386\CmRcViewer.exe",
    "$env:ProgramFiles\Microsoft Configuration Manager\AdminConsole\bin\i386\CmRcViewer.exe"
  )
  foreach ($path in $candidates) {
    if ($path -and (Test-Path $path)) { return $path }
  }
  $cmd = Get-Command "CmRcViewer.exe" -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "CmRcViewer.exe was not found. Install the ConfigMgr console tools on this image."
}

if (-not $UserId) {
  $UserId = Read-Host "User ID (DOMAIN\id)"
}
if ([string]::IsNullOrWhiteSpace($UserId)) {
  throw "User ID is required."
}
if (-not $ComputerName -and -not [Console]::IsInputRedirected) {
  $ComputerName = Read-Host "Target computer (blank to open the viewer only)"
}

$secure = Read-LaunchPassword -UserId $UserId
$cred = New-Object System.Management.Automation.PSCredential ($UserId, $secure)

$exe = Find-CmRcViewer
$argList = @()
if ($ComputerName) { $argList += $ComputerName }

Start-Process -FilePath $exe -ArgumentList $argList -Credential $cred -LoadUserProfile
