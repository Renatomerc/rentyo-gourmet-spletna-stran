package eu.rentyo.rentyo;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import androidx.core.splashscreen.SplashScreen;
import android.graphics.Color;
import java.util.concurrent.TimeUnit;
import android.content.Intent;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final long MINIMUM_SPLASH_TIME = TimeUnit.SECONDS.toMillis(3);
    private long startTime;

    @Override
    public void onCreate(Bundle savedInstanceState) {

        // Splash screen
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        startTime = System.currentTimeMillis();

        splashScreen.setKeepOnScreenCondition(() -> {
            long elapsedTime = System.currentTimeMillis() - startTime;
            return elapsedTime < MINIMUM_SPLASH_TIME;
        });

        super.onCreate(savedInstanceState);

        // Inicializacija Firebase
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this);
        }

        // 🔥 Log FCM Token – da bo v Logcatu vedno prikazan!
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            Log.i("FCM_TOKEN", "Firebase Token: " + token);
        });

        // WebView barva (da ni bel fleš)
        this.getBridge().getWebView().setBackgroundColor(Color.parseColor("#20c0bd"));

        final Window window = getWindow();
        int turkiznaBarva = getResources().getColor(R.color.turkizna_status_bar);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            final int visibility = window.getDecorView().getSystemUiVisibility();
            window.getDecorView().setSystemUiVisibility(
                    visibility & ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
            window.setStatusBarColor(turkiznaBarva);

        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            window.setStatusBarColor(turkiznaBarva);
        }

        // Registracija dodatnega Capacitor plugina
        registerPlugin(MinimalistDatePickerPlugin.class);
    }

    // 👉 Ključno za push obvestila, ko klikneš na notification
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        if (intent != null) {
            getBridge().onNewIntent(intent);

            if (intent.getExtras() != null) {
                Log.d("PUSH_INTENT", "Prejel push obvestilo z extra podatki.");
            }
        }
    }
}
