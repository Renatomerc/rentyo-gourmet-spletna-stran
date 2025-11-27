package eu.rentyo.rentyo;

import android.app.DatePickerDialog;
import android.widget.DatePicker;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Calendar;

@CapacitorPlugin(name = "MinimalistDatePicker")
public class MinimalistDatePickerPlugin extends Plugin {

    @PluginMethod()
    public void show(PluginCall call) {
        getBridge().getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                showCustomDatePicker(call);
            }
        });
    }

    private void showCustomDatePicker(final PluginCall call) {
        final Calendar calendar = Calendar.getInstance();
        int year = calendar.get(Calendar.YEAR);
        int month = calendar.get(Calendar.MONTH);
        int day = calendar.get(Calendar.DAY_OF_MONTH);

        DatePickerDialog.OnDateSetListener dateSetListener = new DatePickerDialog.OnDateSetListener() {
            @Override
            public void onDateSet(DatePicker view, int selectedYear, int monthOfYear, int dayOfMonth) {
                String selectedDate = dayOfMonth + "." + (monthOfYear + 1) + "." + selectedYear;
                JSObject result = new JSObject();
                result.put("selectedDate", selectedDate);
                call.resolve(result);
            }
        };

        // *****************************************************************
        // KLJUČNA TOČKA: PRISILNA UPORABA TEME IZ XML
        // Ta koda uporablja ID stila, ki smo ga definirali v styles.xml,
        // ki vsebuje turkizno barvo #20c0bd.
        // *****************************************************************
        int themeId = 0;
        try {
            // Poskušamo najti temo Rentyo_DatePickerDialog_Theme
            themeId = getContext().getResources().getIdentifier(
                    "Rentyo_DatePickerDialog_Theme",
                    "style",
                    getContext().getPackageName()
            );
        } catch (Exception e) {
            // Če pride do napake pri iskanju vira, themeId ostane 0
        }

        // Rezerva: Če naša custom tema ni najdena (themeId je 0),
        // namesto stare modre teme uporabimo Theme_DeviceDefault_Light_Dialog,
        // ki je čista in nevsiljiva.
        if (themeId == 0) {
            themeId = android.R.style.Theme_DeviceDefault_Light_Dialog;
            // Če želite turkizno barvo, mora tema najti ID iz styles.xml
        }


        DatePickerDialog datePickerDialog = new DatePickerDialog(
                getContext(),
                themeId,      // TUKAJ SE APLICIRA NAŠA TEMA
                dateSetListener,
                year,
                month,
                day
        );

        datePickerDialog.show();
    }
}