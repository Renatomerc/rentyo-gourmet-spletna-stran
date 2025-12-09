package com.crypho.plugins;

import android.util.Base64;
import org.json.JSONObject;

import java.security.Key;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.KeyGenerator;

public class AES {
    private static final String CIPHER_MODE = "GCM";
    private static final int KEY_SIZE = 256;
    private static final int VERSION = 1;
    private static final Cipher GLOBAL_CIPHER = getCipher(CIPHER_MODE);

    public static JSONObject encrypt(byte[] msg, byte[] adata) throws Exception {
        byte[] iv, ct, secretKeySpec_enc;
        synchronized (GLOBAL_CIPHER) {
            SecretKeySpec secretKeySpec = generateKeySpec();
            secretKeySpec_enc = secretKeySpec.getEncoded();
            initCipher(Cipher.ENCRYPT_MODE, secretKeySpec, null, adata, GLOBAL_CIPHER);
            iv = GLOBAL_CIPHER.getIV();
            ct = GLOBAL_CIPHER.doFinal(msg);
        }

        JSONObject value = new JSONObject();
        value.put("iv", Base64.encodeToString(iv, Base64.DEFAULT));
        value.put("v", Integer.toString(VERSION));
        value.put("ks", Integer.toString(KEY_SIZE));
        value.put("cipher", "AES");
        value.put("mode", CIPHER_MODE);
        value.put("adata", Base64.encodeToString(adata, Base64.DEFAULT));
        value.put("ct", Base64.encodeToString(ct, Base64.DEFAULT));

        JSONObject result = new JSONObject();
        result.put("key", Base64.encodeToString(secretKeySpec_enc, Base64.DEFAULT));
        result.put("value", value);
        result.put("native", true);

        return result;
    }

    public static String decrypt(byte[] buf, byte[] key, byte[] iv, byte[] adata, String cipherMode) throws Exception {
        Cipher cipher;
        if ( CIPHER_MODE.equals(cipherMode) ) {
            cipher = GLOBAL_CIPHER;
        } else {
            cipher = getCipher(cipherMode);
        }

        SecretKeySpec secretKeySpec = new SecretKeySpec(key, "AES");
        synchronized (cipher) {
            initCipher(Cipher.DECRYPT_MODE, secretKeySpec, iv, adata, cipher);
            return new String(cipher.doFinal(buf));
        }
    }

    private static SecretKeySpec generateKeySpec() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance("AES");
        keyGenerator.init(KEY_SIZE, new SecureRandom());
        SecretKey sc = keyGenerator.generateKey();
        return new SecretKeySpec(sc.getEncoded(), "AES");
    }

    private static void initCipher(int cipherMode, Key key, byte[] iv, byte[] adata, Cipher cipher) throws Exception {
        if (iv != null) {
            cipher.init(cipherMode, key, new IvParameterSpec(iv));
        } else {
            cipher.init(cipherMode, key);
        }
        cipher.updateAAD(adata);
    }

    private static Cipher getCipher(String cipherMode) {
        if ( cipherMode == null ) {
            cipherMode = CIPHER_MODE;
        }

        try {
            return Cipher.getInstance("AES/" + cipherMode + "/NoPadding");
        } catch (Exception e) {
            return null;
        }
    }
}
