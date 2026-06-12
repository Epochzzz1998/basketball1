package com.dream.basketball.utils;

import org.apache.commons.lang3.StringUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Password hashing (P2-3): BCrypt for everything new, with read-only support for
 * the legacy salted-MD5 format so existing users keep logging in and get
 * transparently re-hashed to BCrypt on their next successful login.
 *
 * Legacy format (was SaltMD5Util, now removed): md5Hex(password + STATIC_SALT)
 * interleaved with the first 16 chars of the salt into a 48-char string. It is
 * deterministic (same password -> same hash), which is exactly why it had to go:
 * no per-user salt means rainbow tables and equal-password detection work.
 */
public final class PasswordUtil {

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    /** The old global static salt — kept ONLY to verify legacy hashes during migration. */
    private static final String LEGACY_SALT = "fskqwevxcjfshfjhsad4354%@!@#%3";

    private static final int LEGACY_HASH_LENGTH = 48;

    private PasswordUtil() {
    }

    /** Hash a raw password with BCrypt (random per-user salt, ~60 chars, starts with $2a$). */
    public static String hash(String rawPassword) {
        return ENCODER.encode(rawPassword);
    }

    /** Verify a raw password against either a BCrypt or a legacy salted-MD5 stored hash. */
    public static boolean matches(String rawPassword, String storedHash) {
        if (rawPassword == null || StringUtils.isBlank(storedHash)) {
            return false;
        }
        if (isBCrypt(storedHash)) {
            return ENCODER.matches(rawPassword, storedHash);
        }
        return storedHash.equals(legacyHash(rawPassword));
    }

    /** True when the stored hash is still legacy and should be re-hashed after a successful login. */
    public static boolean needsUpgrade(String storedHash) {
        return !isBCrypt(storedHash);
    }

    private static boolean isBCrypt(String hash) {
        // $2a$ / $2b$ / $2y$ revisions
        return hash != null && hash.length() > 3 && hash.charAt(0) == '$' && hash.charAt(1) == '2';
    }

    /**
     * Re-implementation of the removed SaltMD5Util.generateSaltPassword, frozen for
     * verification only: md5 hex of (password + full salt), then each hex pair gets
     * one of the salt's first 16 chars spliced between its two digits.
     */
    private static String legacyHash(String password) {
        String md5 = md5Hex(password + LEGACY_SALT);
        if (md5 == null) {
            return null;
        }
        char[] cs = new char[LEGACY_HASH_LENGTH];
        for (int i = 0; i < LEGACY_HASH_LENGTH; i += 3) {
            cs[i] = md5.charAt(i / 3 * 2);
            cs[i + 1] = LEGACY_SALT.charAt(i / 3);
            cs[i + 2] = md5.charAt(i / 3 * 2 + 1);
        }
        return new String(cs);
    }

    private static String md5Hex(String src) {
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            byte[] bs = md5.digest(src.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bs.length * 2);
            for (byte b : bs) {
                int val = b & 0xff;
                if (val < 16) {
                    hex.append('0');
                }
                hex.append(Integer.toHexString(val));
            }
            return hex.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
