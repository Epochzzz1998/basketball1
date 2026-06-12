package com.dream.basketball.utils;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/** P3-1: the divide-by-zero / NaN / NPE guards behind the savePlayerStats career-summary fix. */
class StatsMathTest {

    @Test
    void avg_zeroGames_returnsZeroNotNaN() {
        // the live 500 was BigDecimal.valueOf(sum/0 = NaN); now it's a clean 0
        assertEquals(0, StatsMath.avg(123.4, 0, 1).compareTo(new BigDecimal("0.0")));
        assertEquals(0, StatsMath.avg(0.0, 0, 3).compareTo(BigDecimal.ZERO));
        assertEquals(0, StatsMath.avg(50.0, -1, 1).compareTo(BigDecimal.ZERO));
    }

    @Test
    void avg_matchesLegacyArithmeticWhenGamesPositive() {
        // weighted sum 27.0*80 = 2160 over 80 games -> 27.0
        assertEquals(0, StatsMath.avg(27.0 * 80, 80, 1).compareTo(new BigDecimal("27.0")));
        // scale 3 with HALF_UP rounding
        assertEquals(0, StatsMath.avg(0.5235 * 100, 100, 3).compareTo(new BigDecimal("0.524")));
        assertEquals(new BigDecimal("29.7"), StatsMath.avg(29.7 * 76, 76, 1));
    }

    @Test
    void avgInt_zeroDivisor_returnsZero() {
        assertEquals(0, StatsMath.avgInt(40, 0));
        assertEquals(0, StatsMath.avgInt(40, -3));
        assertEquals(13, StatsMath.avgInt(40, 3)); // integer division, matches old mvpRank/seasonNum
    }

    @Test
    void nz_handlesNulls() {
        assertEquals(0.0, StatsMath.nz((BigDecimal) null));
        assertEquals(0, StatsMath.nz((Integer) null));
        assertEquals(2.3, StatsMath.nz(new BigDecimal("2.3")));
        assertEquals(7, StatsMath.nz(Integer.valueOf(7)));
    }
}
