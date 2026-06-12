package com.dream.basketball.utils;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * P2-3 unit tests. The legacy vectors below are GOLDEN VALUES captured from the
 * real SaltMD5Util.generateSaltPassword() before it was deleted — they pin
 * PasswordUtil's legacy-verify path to the exact historical algorithm, so
 * every pre-migration user keeps logging in.
 */
class PasswordUtilTest {

    // golden vectors: generateSaltPassword(raw) outputs captured 2026-06-12 via jshell
    private static final String LEGACY_123456 = "0fcbs65kbbq7cw5be8cvb4x57c9ej62f66s40h6efdej16h8";
    private static final String LEGACY_ASCII = "ffc7s19k46qfbw71e58v8cxdac96jb5f4asf8hfcf7bj69h7"; // "epoch@2026!"
    private static final String LEGACY_CJK = "5f5bs8ekc6qdaw0ce1av95x74c33j3ef5ds68he9feej6dh1";   // "中文密码test"

    // ---------- BCrypt path ----------

    @Test
    void hash_producesBcryptWithRandomSalt() {
        String h1 = PasswordUtil.hash("123456");
        String h2 = PasswordUtil.hash("123456");
        assertTrue(h1.startsWith("$2"), "BCrypt hashes start with $2x$");
        assertEquals(60, h1.length());
        assertNotEquals(h1, h2, "random per-user salt: same password must hash differently");
        assertTrue(PasswordUtil.matches("123456", h1));
        assertTrue(PasswordUtil.matches("123456", h2));
        assertFalse(PasswordUtil.matches("wrong", h1));
    }

    @Test
    void bcryptHash_doesNotNeedUpgrade() {
        assertFalse(PasswordUtil.needsUpgrade(PasswordUtil.hash("x")));
    }

    @Test
    void cjkPassword_roundTripsThroughBcrypt() {
        String hash = PasswordUtil.hash("中文密码test");
        assertTrue(PasswordUtil.matches("中文密码test", hash));
        assertFalse(PasswordUtil.matches("中文密码Test", hash));
    }

    // ---------- legacy salted-MD5 path (migration) ----------

    @Test
    void legacyGoldenVectors_stillMatch() {
        assertTrue(PasswordUtil.matches("123456", LEGACY_123456));
        assertTrue(PasswordUtil.matches("epoch@2026!", LEGACY_ASCII));
        assertTrue(PasswordUtil.matches("中文密码test", LEGACY_CJK));
    }

    @Test
    void legacyHash_rejectsWrongPassword() {
        assertFalse(PasswordUtil.matches("1234567", LEGACY_123456));
        assertFalse(PasswordUtil.matches("", LEGACY_123456));
    }

    @Test
    void legacyHash_needsUpgrade() {
        assertTrue(PasswordUtil.needsUpgrade(LEGACY_123456));
    }

    // ---------- robustness ----------

    @Test
    void matches_isNullAndGarbageSafe() {
        assertFalse(PasswordUtil.matches(null, LEGACY_123456));
        assertFalse(PasswordUtil.matches("123456", null));
        assertFalse(PasswordUtil.matches("123456", ""));
        assertFalse(PasswordUtil.matches("123456", "   "));
        // wrong length / garbage stored values must return false, not throw
        assertFalse(PasswordUtil.matches("123456", "abc"));
        assertFalse(PasswordUtil.matches("123456", "x".repeat(48)));
    }
}
