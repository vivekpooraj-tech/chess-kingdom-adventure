param(
  [string]$Serial,
  [string]$Name,
  [string]$Orientation = "portrait",
  [string]$QaDir
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

$reportFile = Join-Path $QaDir "$Name-$Orientation-report.json"
$env:QA_REPORT_FILE = $reportFile
node "$PSScriptRoot\cdp-home-qa.js" | Out-Null

# Screenshots while session should be on Home
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

# Routing taps via uiautomator after back to top
for ($i = 1; $i -le 2; $i++) { adb -s $Serial shell input swipe 500 400 500 1400 600; Start-Sleep -Milliseconds 800 }

Write-Output "REPORT=$reportFile"
