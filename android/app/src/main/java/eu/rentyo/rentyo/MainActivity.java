package eu.rentyo.rentyo;

import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.view.WindowInsetsController;
import android.graphics.Color;
import android.view.View; // ⭐ Dodano za View.OVER_SCROLL_NEVER
import android.webkit.WebView; // ⭐ Dodano za WebView

import androidx.core.view.WindowCompat;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

// ⭐ DODANO: Uvoz za FCM plugin
import com.getcapacitor.community.fcm.FCMPlugin;

public class MainActivity extends BridgeActivity {

    private boolean keepSplashOn = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        
        splashScreen.setKeepOnScreenCondition(() -> keepSplashOn);

        new Handler().postDelayed(() -> {
            keepSplashOn = false;
        }, 3000);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
             getWindow().getDecorView().setBackgroundColor(0xFF076B6A);
        }
        
        super.onCreate(savedInstanceState);

        registerPlugin(FCMPlugin.class);

        // --- NASTAVITVE WEBVIEW-JA ---
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            
            // Barva ozadja pod aplikacijo
            webView.setBackgroundColor(0xFF076B6A);

            // 🛑 ONEMOGOČI RAZTEGOVANJE (OVERSCROLL) 🛑
            // To prepreči tisti "elastični" učinek vsebine na Androidu
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }

        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF076B6A);
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                );
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(0);
        }
    }
}