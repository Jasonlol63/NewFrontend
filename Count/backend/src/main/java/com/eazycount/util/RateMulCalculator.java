package com.eazycount.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.regex.Pattern;

/* RATE Middle-Man「Rate-Mul」解析与佣金计算，对齐前端 transactionSubmitHelpers.js 同名三个函数。 */
public final class RateMulCalculator {

    private static final Pattern SIMPLE_DIVISION = Pattern.compile("^/\\d*\\.?\\d+$");
    private static final Pattern PLAIN_POSITIVE = Pattern.compile("^\\+?\\d*\\.?\\d+$");
    private static final int WORK_SCALE = 20;

    public enum Mode { DIVIDE, MULTIPLY }

    public record ParsedRate(boolean valid, Mode mode, BigDecimal divisor, BigDecimal value) {
        static ParsedRate invalid() {
            return new ParsedRate(false, null, null, null);
        }
    }

    private RateMulCalculator() {
    }

    /* "/1.71" 形式取除数；空白/乘法/复合表达式返回 null。 */
    public static BigDecimal parseSimpleDivisionDivisor(String raw) {
        String normalized = normalize(raw);
        if (normalized == null || !SIMPLE_DIVISION.matcher(normalized).matches()) {
            return null;
        }
        try {
            BigDecimal divisor = new BigDecimal(normalized.substring(1));
            return divisor.compareTo(BigDecimal.ZERO) > 0 ? divisor : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /*
     * Rate-Mul 原始输入，两种互斥形态："/1.55"（除法写法）→ DIVIDE 模式，除数直接用；纯正数（如 0.05）→ MULTIPLY 模式。负数及其他表达式一律无效。
     */
    public static ParsedRate parseMiddlemanRateInput(String raw) {
        String cleaned = normalize(raw);
        if (cleaned == null) {
            return ParsedRate.invalid();
        }

        BigDecimal divisor = parseSimpleDivisionDivisor(cleaned);
        if (divisor != null) {
            return new ParsedRate(true, Mode.DIVIDE, divisor, null);
        }

        if (cleaned.indexOf('*') >= 0 || cleaned.indexOf('/') >= 0) {
            return ParsedRate.invalid();
        }
        if (!PLAIN_POSITIVE.matcher(cleaned).matches()
                || cleaned.equals(".") || cleaned.equals("+") || cleaned.equals("+.")) {
            return ParsedRate.invalid();
        }
        try {
            BigDecimal value = new BigDecimal(cleaned);
            if (value.compareTo(BigDecimal.ZERO) <= 0) {
                return ParsedRate.invalid();
            }
            return new ParsedRate(true, Mode.MULTIPLY, null, value);
        } catch (NumberFormatException e) {
            return ParsedRate.invalid();
        }
    }

    /* 佣金，第二币种，全精度（调用方自行截断入库）。可能为负（倒贴），是否入账由调用方决定。
     * DIVIDE：FX 也是 "/divisor" 时才生效，"from/divisor − from/newDivisor"（newDivisor 越大，
     * 客人拿到的越少，Middle-Man 抽得越多，与 MULTIPLY 分支方向相反）；
     * MULTIPLY 且 FX 是 "/divisor"：点数，"mul × 1000"；
     * MULTIPLY 且 FX 是乘法写法：新汇率做差，{(原汇率 − mul) × fromAmount}；
     * 模式与 FX 写法不匹配，或乘法分支下 FX 汇率解析失败：返回 0（忽略）。
     */
    public static BigDecimal computeCommission(
            BigDecimal fromAmount, String middlemanRateRaw, String fxRateExpression, BigDecimal fxRateValue) {
        if (fromAmount == null || fromAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        ParsedRate parsed = parseMiddlemanRateInput(middlemanRateRaw);
        if (!parsed.valid()) {
            return BigDecimal.ZERO;
        }

        BigDecimal baseDivisor = parseSimpleDivisionDivisor(fxRateExpression);

        if (parsed.mode() == Mode.DIVIDE) {
            if (baseDivisor == null) {
                return BigDecimal.ZERO;
            }
            BigDecimal base = fromAmount.divide(baseDivisor, WORK_SCALE, RoundingMode.HALF_UP);
            BigDecimal adjusted = fromAmount.divide(parsed.divisor(), WORK_SCALE, RoundingMode.HALF_UP);
            return base.subtract(adjusted);
        }

        // MULTIPLY 模式。
        if (baseDivisor != null) {
            return parsed.value().multiply(BigDecimal.valueOf(1000));
        }
        if (fxRateValue == null || fxRateValue.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal rateDiff = fxRateValue.subtract(parsed.value());
        return fromAmount.multiply(rateDiff);
    }

    /*
     * Markup 展示差值（仅用于 description 文案，不用于金额计算）：
     * DIVIDE：middleman 除数 − FX 除数（如 3.1 − 3 = 0.1）；
     * MULTIPLY：FX 汇率 − middleman 值（如 3 − 2.9 = 0.1）。
     * 模式与 FX 写法不匹配，或所需数值缺失时返回 null，由调用方 fallback。
     */
    public static BigDecimal computeMarkupDiff(
            ParsedRate middlemanParsed, String fxRateExpression, BigDecimal fxRateValue) {
        if (middlemanParsed == null || !middlemanParsed.valid()) {
            return null;
        }
        if (middlemanParsed.mode() == Mode.DIVIDE) {
            BigDecimal fxDivisor = parseSimpleDivisionDivisor(fxRateExpression);
            if (fxDivisor == null || middlemanParsed.divisor() == null) {
                return null;
            }
            return middlemanParsed.divisor().subtract(fxDivisor);
        }
        boolean fxIsDivide = parseSimpleDivisionDivisor(fxRateExpression) != null;
        if (fxIsDivide || fxRateValue == null || middlemanParsed.value() == null) {
            return null;
        }
        return fxRateValue.subtract(middlemanParsed.value());
    }

    /* computeMarkupDiff 的格式化包装：四舍五入到 scale 位小数，末尾 0 省略，返回 plain string；无法计算时返回 null。 */
    public static String formatMarkupDiffToken(
            ParsedRate middlemanParsed, String fxRateExpression, BigDecimal fxRateValue, int scale) {
        BigDecimal diff = computeMarkupDiff(middlemanParsed, fxRateExpression, fxRateValue);
        if (diff == null) {
            return null;
        }
        return diff.setScale(scale, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.replace('÷', '/').replaceAll("\\s+", "").trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
