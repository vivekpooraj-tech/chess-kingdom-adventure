param(
  [string]$Serial,
  [string]$Name,
  [string]$Orientation = "portrait",
  [string]$QaDir
)

function Sign-In-Device {
  param([string]$S)
  adb -s $S shell am force-stop com.chesskingdom.adventure
  Start-Sleep -Seconds 1
  adb -s $S reverse tcp:3000 tcp:3000
  adb -s $S shell am start -n com.chesskingdom.adventure/.MainActivity
  Start-Sleep -Seconds 6
  adb -s $S shell input tap 360 1086
  Start-Sleep -Seconds 3
  adb -s $S shell input tap 360 621
  Start-Sleep -Seconds 1
  adb -s $S shell input text "rajyam141502%40gmail.com"
  Start-Sleep -Seconds 1
  adb -s $S shell input tap 360 784
  Start-Sleep -Seconds 1
  adb -s $S shell input text "ChessMind-QA-Local-Only"
  Start-Sleep -Seconds 1
  adb -s $S shell input tap 360 994
  Start-Sleep -Seconds 10
}

function Capture-Ui {
  param([string]$S, [string]$PathPrefix)
  adb -s $S shell screencap -p /sdcard/qa.png
  adb -s $S pull /sdcard/qa.png "$QaDir\$PathPrefix.png"
  adb -s $S shell uiautomator dump /sdcard/ui.xml
  adb -s $S pull /sdcard/ui.xml "$QaDir\$PathPrefix-ui.xml"
}

if ($Orientation -eq "portrait") {
  adb -s $Serial shell settings put system accelerometer_rotation 0
  adb -s $Serial shell settings put system user_rotation 0
} else {
  adb -s $Serial shell settings put system accelerometer_rotation 0
  adb -s $Serial shell settings put system user_rotation 1
}
Start-Sleep -Seconds 2

Sign-In-Device -S $Serial
Capture-Ui -S $Serial -PathPrefix "$Name-$Orientation-home-top"

# Scroll down 3 times
for ($i = 1; $i -le 3; $i++) {
  adb -s $Serial shell input swipe 500 1400 500 400 500
  Start-Sleep -Seconds 2
  Capture-Ui -S $Serial -PathPrefix "$Name-$Orientation-scroll$i"
}

# Scroll back up
for ($i = 1; $i -le 3; $i++) {
  adb -s $Serial shell input swipe 500 400 500 1400 500
  Start-Sleep -Seconds 1
}

Write-Output "DONE $Name $Orientation"
