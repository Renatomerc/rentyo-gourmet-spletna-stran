package eu.rentyo.rentyo;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

// Ta import je KLJUČEN, da Java najde R.color
// Prepričajte se, da je paket "eu.rentyo.rentyo" pravilen!
import eu.rentyo.rentyo.R;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final Window window = getWindow();

        // KLJUČNO: Barvo pridobimo iz colors.xml/styles.xml
        // POZOR: Če R.color.turkizna_status_bar ne obstaja, bo prišlo do napake!
        int turkizna_barva = getResources().getColor(R.color.turkizna_status_bar);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11 (R) in novejši
            final int visibility = window.getDecorView().getSystemUiVisibility();

            window.getDecorView().setSystemUiVisibility(
                    visibility & ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
            // Nastavi barvo Status Bar-a neposredno v Native barvo
            window.setStatusBarColor(turkizna_barva);

        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            // Android 5 (Lollipop) do Android 10 (Q)

            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

            // Nastavi barvo Status Bar-a neposredno v Native barvo
            getWindow().setStatusBarColor(turkizna_barva);
        }
    }
}