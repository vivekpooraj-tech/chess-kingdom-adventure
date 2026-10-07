param([string]$Serial)

adb -s $Serial reverse tcp:3000 tcp:3000
adb -s $Serial shell am force-stop com.chesskingdom.adventure
Start-Sleep -Seconds 1
adb -s $Serial shell am start -n com.chesskingdom.adventure/.MainActivity
Start-Sleep -Seconds 7

# Welcome -> Sign in (portrait center-ish; works for phone + tablet)
adb -s $Serial shell input tap 600 1265
Start-Sleep -Seconds 4

adb -s $Serial shell uiautomator dump /sdcard/ui.xml
$xml = adb -s $Serial shell cat /sdcard/ui.xml
if ($xml -notmatch 'resource-id="email"') {
  adb -s $Serial shell input tap 360 1086
  Start-Sleep -Seconds 3
  adb -s $Serial shell uiautomator dump /sdcard/ui.xml
  $xml = adb -s $Serial shell cat /sdcard/ui.xml
}

# Find email field bounds
if ($xml -match 'resource-id="email"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
  $ex = [int](($matches[1] + $matches[3]) / 2)
  $ey = [int](($matches[2] + $matches[4]) / 2)
} else {
  $ex = 360; $ey = 621
}
adb -s $Serial shell input tap $ex $ey
Start-Sleep -Seconds 1
# Clear field
for ($i = 0; $i -lt 40; $i++) { adb -s $Serial shell input keyevent 67 | Out-Null }
Start-Sleep -Seconds 1
cmd /c "adb -s $Serial shell input text rajyam141502@gmail.com"
Start-Sleep -Seconds 1

if ($xml -match 'resource-id="password"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
  $px = [int](($matches[1] + $matches[3]) / 2)
  $py = [int](($matches[2] + $matches[4]) / 2)
} else {
  $px = 360; $py = 784
}
adb -s $Serial shell input tap $px $py
Start-Sleep -Seconds 1
for ($i = 0; $i -lt 40; $i++) { adb -s $Serial shell input keyevent 67 | Out-Null }
Start-Sleep -Seconds 1
adb -s $Serial shell input text QaTest1234
Start-Sleep -Seconds 2
adb -s $Serial shell input keyevent 66
Start-Sleep -Seconds 15
