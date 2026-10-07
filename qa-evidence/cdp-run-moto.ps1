param([string]$Serial = "ZY32KGHHJ6")

adb -s $Serial shell setprop debug.webview.packages com.chesskingdom.adventure
adb -s $Serial reverse tcp:3000 tcp:3000
adb -s $Serial shell am force-stop com.chesskingdom.adventure
adb -s $Serial shell am start -n com.chesskingdom.adventure/.MainActivity
Start-Sleep -Seconds 8
$appPid = (adb -s $Serial shell pidof com.chesskingdom.adventure).Trim()
Write-Output "APP_PID=$appPid"
adb -s $Serial forward --remove tcp:9222 2>$null
adb -s $Serial forward tcp:9222 localabstract:webview_devtools_remote_$appPid
Start-Sleep -Seconds 1
node "$PSScriptRoot\cdp-signin-ws.js"
