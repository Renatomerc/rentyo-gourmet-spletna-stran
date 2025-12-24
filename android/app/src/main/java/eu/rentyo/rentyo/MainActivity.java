package eu.rentyo.rentyo;

import android.os.Bundle;
import android.os.Build;
import android.os.Handler;
import android.view.WindowInsetsController;
import android.graphics.Color;

import androidx.core.view.WindowCompat;
import androidx.core.splashscreen.SplashScreen; // ⭐ Potrebno za nadzor logotipa
import com.getcapacitor.BridgeActivity;

// ⭐ DODANO: Uvoz za FCM plugin
import com.getcapacitor.community.fcm.FCMPlugin;

public class MainActivity extends BridgeActivity {

    // Spremenljivka, ki pove Androidu, ali naj še kaže logotip
    private boolean keepSplashOn = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 1. Inicializacija novega Android 12+ Splash Screen API-ja
        // Ta vrstica MORA biti pred super.onCreate
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        
        // Nastavimo pogoj: dokler je keepSplashOn true, logotip NE izgine
        splashScreen.setKeepOnScreenCondition(() -> keepSplashOn);

        // Po 3 sekundah (3000ms) spremenimo v false, da se logotip umakne
        new Handler().postDelayed(() -> {
            keepSplashOn = false;
        }, 3000);

        // Nastavitev ozadja
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
             getWindow().getDecorView().setBackgroundColor(0xFF076B6A);
        }
        
        super.onCreate(savedInstanceState);

        // ⭐ DODANO: Ročna registracija FCM plugina
        registerPlugin(FCMPlugin.class);

        // Barva za WebView pod aplikacijo
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(0xFF076B6A);
        }

        // Status bar nastavitve
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF076B6A);
        }
        
        // Bele ikone v status baru
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
