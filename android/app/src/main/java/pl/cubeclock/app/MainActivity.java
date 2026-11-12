package pl.cubeclock.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * CubeClock na Androida: strona timera wczytywana z plików aplikacji (działa bez internetu).
 */
public class MainActivity extends Activity {

    private WebView web;
    private static final int REQ_NOTIF = 7;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // ekran nie gaśnie podczas układania
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0B0C);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // zapis czasów (localStorage)
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false); // dźwięki inspekcji
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " CubeClockApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) return false;
                // linki zewnętrzne otwieramy w przeglądarce
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                }
                return true;
            }
        });

        // most dla strony: przypomnienia i stan treningu
        web.addJavascriptInterface(new Bridge(), "CCNative");

        setContentView(web);

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl("file:///android_asset/www/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    // przycisk "wstecz": najpierw zamyka okna i panel na stronie, dopiero potem wychodzi z aplikacji
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.ccBack && window.ccBack()) ? 'y' : 'n'", (result) -> {
            if (result == null || !result.contains("y")) MainActivity.super.onBackPressed();
        });
    }

    /** Metody wywoływane ze strony przez window.CCNative. */
    public class Bridge {
        @JavascriptInterface
        public void setReminder(boolean enabled, int hour, int minute) {
            Reminders.prefs(MainActivity.this).edit()
                    .putBoolean("enabled", enabled)
                    .putInt("hour", hour)
                    .putInt("minute", minute)
                    .apply();
            Reminders.schedule(MainActivity.this);
        }

        @JavascriptInterface
        public void setStatus(String lastDay, int streak) {
            Reminders.prefs(MainActivity.this).edit()
                    .putString("lastDay", lastDay)
                    .putInt("streak", streak)
                    .apply();
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return Reminders.allowed(MainActivity.this);
        }

        @JavascriptInterface
        public void requestNotifications() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
                } else {
                    notifResult(Reminders.allowed(MainActivity.this));
                }
            });
        }
    }

    private void notifResult(boolean granted) {
        web.evaluateJavascript("window.ccNotifResult && window.ccNotifResult(" + granted + ")", null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF) {
            notifResult(grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED);
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
