package com.eazycount.util;

import com.eazycount.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Process > Auto Fetch: the report-site passwords / PINs are stored encrypted and come back unchanged. */
class CredentialCipherTest {

    private static String newKey() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static CredentialCipher cipherWithOwnKey() {
        return new CredentialCipher(newKey());
    }

    @Test
    void whatGoesInComesBackOut() {
        CredentialCipher cipher = cipherWithOwnKey();
        for (String secret : new String[]{"AAss1122@", "8888", "", " spaces kept ", "密码带中文", "a".repeat(200)}) {
            assertEquals(secret, cipher.decrypt(cipher.encrypt(secret)), secret);
        }
    }

    @Test
    void theStoredFormRevealsNothingAndIsNeverTheSameTwice() {
        CredentialCipher cipher = cipherWithOwnKey();
        String first = cipher.encrypt("AAss1122@");
        String second = cipher.encrypt("AAss1122@");
        // A fresh IV per value, so the same password never has the same ciphertext.
        assertNotEquals(first, second);
        assertFalse(first.contains("AAss1122@"));
        assertTrue(first.startsWith("v1:"));
        assertEquals("AAss1122@", cipher.decrypt(first));
        assertEquals("AAss1122@", cipher.decrypt(second));
    }

    // The stored value fits process_auto_fetch.login_password_enc (VARCHAR(512)).
    @Test
    void theStoredFormFitsItsColumn() {
        CredentialCipher cipher = cipherWithOwnKey();
        assertTrue(cipher.encrypt("a".repeat(100)).length() <= 512);
    }

    @Test
    void anotherKeyCannotReadIt() {
        String sealed = cipherWithOwnKey().encrypt("AAss1122@");
        CredentialCipher other = cipherWithOwnKey();
        // Says to enter it again rather than handing back nonsense.
        assertThrows(BusinessException.class, () -> other.decrypt(sealed));
    }

    @Test
    void aDamagedOrUnmarkedValueIsRefused() {
        CredentialCipher cipher = cipherWithOwnKey();
        assertThrows(BusinessException.class, () -> cipher.decrypt("plaintext-password"));
        assertThrows(BusinessException.class, () -> cipher.decrypt(null));
        assertThrows(BusinessException.class, () -> cipher.decrypt("v1:not-base64!!"));
        // One flipped character of the ciphertext fails the GCM tag instead of decrypting to something wrong.
        String sealed = cipher.encrypt("AAss1122@");
        String flipped = sealed.substring(0, sealed.length() - 2) + (sealed.endsWith("A=") ? "B=" : "A=");
        assertThrows(BusinessException.class, () -> cipher.decrypt(flipped));
    }

    // Without the key the server says Auto Fetch is not set up, instead of failing somewhere deeper.
    @Test
    void withNoKeyItSaysAutoFetchIsNotSetUp() {
        CredentialCipher none = new CredentialCipher("");
        BusinessException thrown = assertThrows(BusinessException.class, () -> none.encrypt("x"));
        assertEquals(CredentialCipher.KEY_MISSING, thrown.getMessage());
        assertThrows(BusinessException.class, () -> none.decrypt("v1:anything"));
    }

    @Test
    void aKeyOfTheWrongSizeIsRefusedAtStartup() {
        assertThrows(IllegalStateException.class, () -> new CredentialCipher("dGhpcyBpcyBzaG9ydA=="));
        assertThrows(IllegalStateException.class, () -> new CredentialCipher("not base64 at all !!"));
    }
}
