package com.eazycount.util;

import com.eazycount.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/*
 * Encrypts the report-website passwords / PINs of Process > Auto Fetch (AES-256-GCM, a fresh IV per value).
 * The key is app.autofetch.secret-key (env AUTOFETCH_SECRET_KEY): base64 of 32 random bytes, kept outside the repo and the
 * database, so a database dump alone never reveals the passwords. Stored form: "v1:" + base64(iv || ciphertext+tag).
 * Losing or changing the key makes the saved passwords unreadable: they then have to be typed in again.
 */
@Component
public class CredentialCipher {

    private static final String PREFIX = "v1:";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;
    static final String KEY_MISSING = "Auto Fetch is not set up on the server (AUTOFETCH_SECRET_KEY is missing)";

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public CredentialCipher(@Value("${app.autofetch.secret-key:}") String base64Key) {
        this.key = parseKey(base64Key);
    }

    private static SecretKeySpec parseKey(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return null;
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("app.autofetch.secret-key is not valid base64", e);
        }
        if (bytes.length != 32) {
            throw new IllegalStateException("app.autofetch.secret-key must be 32 bytes (base64 of 32 random bytes)");
        }
        return new SecretKeySpec(bytes, "AES");
    }

    public String encrypt(String plain) {
        SecretKeySpec k = requireKey();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return PREFIX + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt the Auto Fetch credential", e);
        }
    }

    public String decrypt(String stored) {
        SecretKeySpec k = requireKey();
        if (stored == null || !stored.startsWith(PREFIX)) {
            throw new BusinessException("The saved Auto Fetch password cannot be read: enter it again in Process > Auto Fetch");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // Another key (or a damaged value): the user has to save the password again.
            throw new BusinessException("The saved Auto Fetch password cannot be read: enter it again in Process > Auto Fetch");
        }
    }

    private SecretKeySpec requireKey() {
        if (key == null) {
            throw new BusinessException(KEY_MISSING);
        }
        return key;
    }
}
