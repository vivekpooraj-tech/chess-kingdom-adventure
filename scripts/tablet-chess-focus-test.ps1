# Physical tablet Chess Focus validation helper
# Requires: adb device connected, dev server on :3000, adb reverse tcp:3000 tcp:3000

$ErrorActionPreference = "Stop"
$Device = "HA1QEERL"
$Pkg = "com.chesskingdom.adventure"
$Activity = "$Pkg/.MainActivity"
$OutDir = Join-Path (Split-Path $PSScriptRoot -Parent) "tablet-test-screenshots"

function Invoke-Adb([string[]]$Args) {
  & adb -s $Device @Args
}

function Set-TabletRotation([int]$Rotation) {
  # 0=portrait, 1=landscape, 2=reverse portrait, 3=reverse landscape
  Invoke-Adb @("shell", "settings", "put", "system", "user_rotation", "$Rotation") | Out-Null
  Start-Sleep -Seconds 2
}

function Capture-Screen([string]$Name) {
  $path = Join-Path $OutDir "$Name.png"
  $bytes = Invoke-Adb @("exec-out", "screencap", "-p")
  [IO.File]::WriteAllBytes($path, $bytes)
  $item = Get-Item $path
  Write-Output "CAPTURED $Name -> $($item.FullName) ($($item.Length) bytes)"
}

function Tap([int]$X, [int]$Y) {
  Invoke-Adb @("shell", "input", "tap", "$X", "$Y") | Out-Null
  Start-Sleep -Seconds 1
}

function Get-OrientationLabel() {
  $size = (Invoke-Adb @("shell", "wm", "size")).Trim()
  if ($size -match "(\d+)x(\d+)") {
    $w = [int]$Matches[1]; $h = [int]$Matches[2]
    if ($w -gt $h) { return "landscape ${w}x${h}" } else { return "portrait ${w}x${h}" }
  }
  return "unknown"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Output "=== Tablet Chess Focus Test ==="
Write-Output "Device orientation/size: $(Get-OrientationLabel)"

Invoke-Adb @("reverse", "tcp:3000", "tcp:3000") | Out-Null
Invoke-Adb @("shell", "am", "force-stop", $Pkg) | Out-Null
Start-Sleep -Seconds 1

# Portrait home -> puzzles
Set-TabletRotation 0
Invoke-Adb @("shell", "am", "start", "-n", $Activity) | Out-Null
Start-Sleep -Seconds 8
Capture-Screen "01-home-portrait"

# Tap Puzzles tab (~2nd of 5 tabs on 1200x2000)
Tap 360 1920
Start-Sleep -Seconds 5
Capture-Screen "02-puzzle-portrait"

# Landscape puzzle
Set-TabletRotation 1
Start-Sleep -Seconds 4
Capture-Screen "03-puzzle-landscape"

# Portrait again (rotation test)
Set-TabletRotation 0
Start-Sleep -Seconds 4
Capture-Screen "04-puzzle-portrait-after-rotate"

# Play -> Computer
Tap 600 1920
Start-Sleep -Seconds 3
Tap 600 1100
Start-Sleep -Seconds 2
Capture-Screen "05-play-portrait"

# Start free play if visible - tap center area for first difficulty
Tap 600 900
Start-Sleep -Seconds 6
Capture-Screen "06-computer-portrait"

Set-TabletRotation 1
Start-Sleep -Seconds 4
Capture-Screen "07-computer-landscape"

# Exit to home
Set-TabletRotation 0
Tap 120 80
Start-Sleep -Seconds 3
Tap 120 80
Start-Sleep -Seconds 2
Tap 120 1920
Start-Sleep -Seconds 4
Capture-Screen "08-home-after-exit"

Write-Output "=== Done. Screenshots in $OutDir ==="
