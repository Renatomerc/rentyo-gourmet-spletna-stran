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
import eu.rentyo.rentyo.R;

import com.google.firebase.FirebaseApp; // 🔥 DODANO: UVOZ ZA FIREBASE

public class MainActivity extends BridgeActivity {
    
    // ⭐ POPRAVEK: Vračamo zadrževanje na 5 sekund (5000ms), da preprečimo bliskanje. ⭐
    private static final long MINIMUM_SPLASH_TIME = TimeUnit.SECONDS.toMillis(5);
    private long startTime;


    @Override
    public void onCreate(Bundle savedInstanceState) {
        
        // KLJUČNO POPRAVLJENO: NAMESTO SAMO INSTALACIJE, UPORABIMO POGOJ ZA ZADRŽANJE 
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        startTime = System.currentTimeMillis();
        
        // Native Splash ostane viden, dokler ne poteče MINIMUM_SPLASH_TIME
        splashScreen.setKeepOnScreenCondition(() -> {
            long elapsedTime = System.currentTimeMillis() - startTime;
            // Drži Native Splash, dokler naš čas (5000ms) ni dosežen.
            return elapsedTime < MINIMUM_SPLASH_TIME; 
        });

        super.onCreate(savedInstanceState);

        // 🔥 KLJUČNO: ROČNA INICIALIZACIJA FIREBASE
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseApp.initializeApp(this);
        }

        // KLJUČNO: NASTAVITEV OZADJA WEBVIEW-JA, DA PREPREČI BELI BLISK 
        this.getBridge().getWebView().setBackgroundColor(Color.parseColor("#20c0bd"));

        final Window window = getWindow();

        // KLJUČNO: Barvo pridobimo iz colors.xml/styles.xml
        int turkizna_barva = getResources().getColor(R.color.turkizna_status_bar);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // Android 11+
            
            // ... (Koda za Android 11+ ostane enaka) ...

            // TIPKARSKA NAPAKA (getDecorView) JE POPRAVLJENA
            final int visibility = window.getDecorView().getSystemUiVisibility();

            window.getDecorView().setSystemUiVisibility(
                    visibility & ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
            // Nastavi barvo Status Bar-a neposredno v Native barvo
            window.setStatusBarColor(turkizna_barva);

        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) { // POPRAVEK JE TUKAJ: VERSION.SDK_INT 
            // Android 5 (Lollipop) do Android 10 (Q)

            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

            // Nastavi barvo Status Bar-a neposredno v Native barvo
            getWindow().setStatusBarColor(turkizna_barva);
        }

        // ***************************************************************
        // REGISTRACIJA CAPACITOR VTIČNIKA
        // ***************************************************************
        registerPlugin(MinimalistDatePickerPlugin.class);
    }

    // 🔥 KLJUČNO POPRAVILO: Dodatek onNewIntent metode za prestrezanje PUSH obvestil
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getExtras() != null) {
            // Posreduje Intent nazaj v Capacitor, ki ga obdela PushNotifications
            getBridge().onNewIntent(intent);
        }
    }
}