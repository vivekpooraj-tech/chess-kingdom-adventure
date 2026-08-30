package com.chesskingdom.adventure;

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    Bridge bridge = getBridge();
    if (bridge == null) {
      return;
    }
    WebView webView = bridge.getWebView();
    if (webView == null) {
      return;
    }
    WebSettings settings = webView.getSettings();
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(true);

    // Do NOT force LOAD_NO_CACHE or clearCache() here. This runs on every
    // foreground (returning from background included), and wiping the cache
    // every time meant every launch/navigation re-downloaded the whole JS
    // bundle over the network before auth could even resolve — which
    // widened the window for a cold-radio token refresh to fail and bounce
    // a genuinely signed-in user to the sign-in screen. Stale HTML between
    // deploys is already handled the right way: the server sends
    // `Cache-Control: no-cache, must-revalidate` on every HTML document
    // (see next.config.mjs) and all JS/CSS is content-hashed, so the
    // default cache mode is both correct and fast.
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);

    // Persist cookies to disk now rather than whenever the WebView next
    // decides to. The Supabase auth session lives in cookies and the
    // refresh token rotates on every refresh; without an explicit flush, a
    // force-kill shortly after a rotation could leave only the old,
    // already-consumed refresh token on disk — which then fails to refresh
    // on next launch and logs the user out. flush() is also called in
    // onPause() below to cover the normal "user leaves the app" path.
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().flush();
  }

  @Override
  public void onPause() {
    super.onPause();
    // Checkpoint the auth cookies every time the app leaves the foreground,
    // so a later force-stop can't lose a freshly rotated refresh token.
    CookieManager.getInstance().flush();
  }
}
