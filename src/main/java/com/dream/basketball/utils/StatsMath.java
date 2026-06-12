package com.dream.basketball.utils;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Null- and zero-safe arithmetic for the career-summary computation (P3-1).
 *
 * The old savePlayerStats divided weighted sums by total appearances and rank
 * sums by season count with no guard: a player with no real season rows made
 * {@code total/0 = NaN}, and {@code BigDecimal.valueOf(NaN)} threw
 * NumberFormatException (the live 500 at PlayerController:346). Null stat fields
 * on freshly-inserted empty rows were an NPE waiting to happen too.
 */
public final class StatsMath {

    private StatsMath() {
    }

    /** null BigDecimal -> 0.0 */
    public static double nz(BigDecimal v) {
        return v == null ? 0.0 : v.doubleValue();
    }

    /** null Integer -> 0 */
    public static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    /**
     * Weighted average rounded HALF_UP to {@code scale} decimals, guarded against
     * zero games (returns 0 instead of NaN). Matches the old arithmetic exactly
     * when games &gt; 0.
     */
    public static BigDecimal avg(double weightedSum, int games, int scale) {
        if (games <= 0) {
            return BigDecimal.ZERO.setScale(scale, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(weightedSum / games).setScale(scale, RoundingMode.HALF_UP);
    }

    /** Integer average guarded against a zero divisor. */
    public static int avgInt(int sum, int count) {
        return count <= 0 ? 0 : sum / count;
    }
}
