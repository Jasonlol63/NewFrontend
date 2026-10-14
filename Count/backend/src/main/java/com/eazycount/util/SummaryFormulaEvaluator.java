package com.eazycount.util;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Data Capture Summary 公式求值，与前端 {@code summaryMath.js evalExpression} 同一套规则：
 * 支持 {@code + - * / ( )} 与数字（允许 "1,234.5"、"$12"）；相邻因子相乘（"(a)(b)"、"3(4)"）；
 * 结尾缺的 ")" 自动补；币种标签 "(USD)" 丢弃；"%" 只是装饰（"$8/3.1%" 就是 8 / 3.1）。
 * 无效表达式或除以 0 返回 null（调用方据此跳过校验）。除法精度与前端 decimal.js 一致：40 位有效数字、向零截断。
 */
public final class SummaryFormulaEvaluator {

    private static final MathContext DIVISION = new MathContext(40, RoundingMode.DOWN);
    private static final Pattern CURRENCY_TAG = Pattern.compile("\\s*\\([A-Za-z]{2,4}\\)\\s*");
    private static final Pattern TOKEN = Pattern.compile("\\d+\\.?\\d*|\\.\\d+|[-+*/()]|.", Pattern.DOTALL);
    private static final Pattern NUMBER = Pattern.compile("^(\\d|\\.\\d).*");

    private final List<String> tokens;
    private int pos;

    private SummaryFormulaEvaluator(List<String> tokens) {
        this.tokens = tokens;
    }

    /* 表达式的值；无效返回 null。 */
    public static BigDecimal evaluate(String text) {
        String source = (text == null ? "" : text).replace('−', '-');
        source = CURRENCY_TAG.matcher(source).replaceAll(" ").replaceAll("[$,%\\s]", "");
        List<String> tokens = new ArrayList<>();
        Matcher m = TOKEN.matcher(source);
        while (m.find()) {
            tokens.add(m.group());
        }
        if (tokens.isEmpty()) {
            return null;
        }
        try {
            SummaryFormulaEvaluator parser = new SummaryFormulaEvaluator(tokens);
            BigDecimal value = parser.expr();
            return parser.pos < tokens.size() ? null : value;
        } catch (IllegalStateException | ArithmeticException | NumberFormatException e) {
            return null;
        }
    }

    private String peek() {
        return pos < tokens.size() ? tokens.get(pos) : null;
    }

    private BigDecimal factor() {
        String t = pos < tokens.size() ? tokens.get(pos++) : null;
        if ("-".equals(t)) {
            return factor().negate();
        }
        if ("+".equals(t)) {
            return factor();
        }
        if ("(".equals(t)) {
            BigDecimal v = expr();
            if (pos < tokens.size() && !")".equals(tokens.get(pos++))) {
                throw new IllegalStateException("expected )");
            }
            return v;
        }
        if (t != null && NUMBER.matcher(t).matches()) {
            return new BigDecimal(t);
        }
        throw new IllegalStateException("unexpected token");
    }

    private BigDecimal term() {
        BigDecimal v = factor();
        for (;;) {
            String p = peek();
            if ("*".equals(p)) {
                pos++;
                v = v.multiply(factor());
            } else if ("/".equals(p)) {
                pos++;
                BigDecimal d = factor();
                if (d.signum() == 0) {
                    throw new IllegalStateException("divide by zero");
                }
                v = v.divide(d, DIVISION);
            } else if ("(".equals(p)) {
                v = v.multiply(factor());
            } else {
                return v;
            }
        }
    }

    private BigDecimal expr() {
        BigDecimal v = term();
        while ("+".equals(peek()) || "-".equals(peek())) {
            boolean plus = "+".equals(tokens.get(pos++));
            BigDecimal t = term();
            v = plus ? v.add(t) : v.subtract(t);
        }
        return v;
    }
}
