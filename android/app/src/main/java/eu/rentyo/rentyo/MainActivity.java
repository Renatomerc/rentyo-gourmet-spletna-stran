package eu.rentyo.rentyo;

import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowInsetsController;
// ⭐ Potrebna uvoza
import android.graphics.Color; // Dodajte, če ga še nimate

import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        
        // ⭐ 1. Nastavitev barve DECOR VIEW (to že imate in je pravilno) ⭐
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
             getWindow().getDecorView().setBackgroundColor(0xFF076B6A);
        }
        
        super.onCreate(savedInstanceState); // Inicializacija Capacitorjevega 'bridge'

        // ⭐ 2. KLJUČNA NOVITETA: NASTAVITEV BARVE OZADJA SAMEMU WebViewu ⭐
        // Ta koda se izvede po inicializaciji mostu (bridge).
        // 0xFF076B6A je ARGB koda za vašo turkizno barvo.
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(0xFF076B6A);
        }

        // 1. Izklopi edge-to-edge, da app NE gre pod status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        // 2. Nastavi barvo status bara na #076B6A
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(0xFF076B6A);
        }
        // ... ostala koda ...
        
        // 3. Nastavi BELE ikone v status baru
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                );
            }
        } else {
            // Na starejših Android verzijah odstrani LIGHT_STATUS_BAR flag (bele ikone)
            getWindow().getDecorView().setSystemUiVisibility(0);
        }
    }
}
