param(
  [string]$Serial,
  [string]$Name,
  [string]$Orientation = "portrait",
  [string]$QaDir,
  [switch]$Routing
)

if ($Orientation -eq "portrait") {
  adb -s $Serial shell settings put system accelerometer_rotation 0
  adb -s $Serial shell settings put system user_rotation 0
} else {
  adb -s $Serial shell settings put system accelerometer_rotation 0
  adb -s $Serial shell settings put system user_rotation 1
}
Start-Sleep -Seconds 2

adb -s $Serial shell setprop debug.webview.packages com.chesskingdom.adventure
adb -s $Serial reverse tcp:3000 tcp:3000
adb -s $Serial shell am force-stop com.chesskingdom.adventure
adb -s $Serial shell am start -n com.chesskingdom.adventure/.MainActivity
Start-Sleep -Seconds 8

$appPid = (adb -s $Serial shell pidof com.chesskingdom.adventure).Trim()
adb -s $Serial forward --remove tcp:9222 2>$null
adb -s $Serial forward tcp:9222 localabstract:webview_devtools_remote_$appPid
Start-Sleep -Seconds 1

$suffix = if ($Routing) { "-routing-report.json" } else { "-report.json" }
$reportFile = Join-Path $QaDir "$Name-$Orientation$suffix"
$env:QA_REPORT_FILE = $reportFile
if ($Routing) {
  node "$PSScriptRoot\cdp-routing-qa.js" | Out-Null
} else {
  node "$PSScriptRoot\cdp-home-qa.js" | Out-Null
}

# Screenshots
adb -s $Serial shell screencap -p /sdcard/qa.png
adb -s $Serial pull /sdcard/qa.png (Join-Path $QaDir "$Name-$Orientation-top.png")
adb -s $Serial shell input swipe 500 1400 500 400 600
Start-Sleep -Seconds 2
adb -s $Serial shell screencap -p /sdcard/qa.png
adb -s $Serial pull /sdcard/qa.png (Join-Path $QaDir "$Name-$Orientation-mid.png")
adb -s $Serial shell input swipe 500 1400 500 400 600
Start-Sleep -Seconds 2
adb -s $Serial shell screencap -p /sdcard/qa.png
adb -s $Serial pull /sdcard/qa.png (Join-Path $QaDir "$Name-$Orientation-bottom.png")

Write-Output "REPORT=$reportFile"
