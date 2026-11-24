// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import com.legend.protocol.SourceInfo;

import java.util.List;

/**
 * WHERE A TEXT FAILS TO PARSE, AS LEGEND-ENGINE SAYS IT (T2 of docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md, phase
 * 0 of Studio's local mode, 2026-11-23): legend-engine answers {@code grammar/grammarToJson/model}'s parse error with a
 * {@code sourceInformation} beside its message, which Studio reads to place the cursor ({@code V1_buildParserError}).
 * Measured on a running legend-engine (4.152.1-SNAPSHOT, {@code aa1c755}, 2026-11-23; its {@code ParserErrorListener}
 * and its lexer's rules read beside it):
 * <ul>
 *   <li>the span is the offending token's, on its first line: from its first column to its first column plus its
 *       text's length less one;</li>
 *   <li>at the end of the input, the span is {@code <EOF>}'s five characters where the section's text ends: the end of
 *       the text, or the start of the next section's header line (the engine's other spelling of an end of input, a
 *       one-column span a column to the left, is not told apart: S423);</li>
 *   <li>the {@code sourceId} is the request's, empty for a text;</li>
 *   <li>it is written whatever {@code returnSourceInformation} asks, except a section no parser knows, whose span is
 *       the section's opening token ({@code \n###Name}) and is written only when asked: from the column after the
 *       previous line's last character (the eighth, after the {@code ###Pure} the engine puts before the text, when
 *       the section opens the text) on the line after the header -- the engine's own reckoning, followed here.</li>
 * </ul>
 * The position is lite's parser's ({@link com.legend.parser.ParseException#line()}, {@code column()}): the start of the
 * token it stopped at, spelled here as the engine's span, the token's length by the engine's lexer rules. Where lite's
 * parser stops at another token than the engine's ANTLR grammar does, the place differs (docs/SEMANTICS_REGISTER.md
 * S423). An error lite places nowhere is answered with no {@code sourceInformation}, never a guessed one.
 */
final class ParseErrorPlace {

    private ParseErrorPlace() {
    }

    /** legend-engine's {@code ParserErrorListener} names the end of the input {@code <EOF>}. */
    private static final int EOF_LENGTH = "<EOF>".length();

    private static final String UNKNOWN_SECTION = "' is not a known section parser";

    /** {@code e}'s place in {@code text} as legend-engine writes a parse error's {@code sourceInformation}, or null
     *  where lite's parser placed it nowhere (or, for a section no parser knows, where none was asked). */
    static @com.legend.base.Nullable SourceInfo of(Throwable e, String text, boolean returnSourceInformation) {
        if (!(e instanceof com.legend.parser.ParseException p) || p.line() <= 0 || p.column() <= 0) {
            return null;
        }
        int line = p.line();
        int column = p.column();
        String message = String.valueOf(p.getMessage());
        int open = message.indexOf('\'');
        if (message.endsWith(UNKNOWN_SECTION) && open >= 0 && open + 1 <= message.length() - UNKNOWN_SECTION.length()) {
            if (!returnSourceInformation) {
                return null;
            }
            // lite's place is the line after the header, column 1; the engine's span starts at the newline before
            // the header: the previous line's length plus one, its ### and its name after
            String name = message.substring(open + 1, message.length() - UNKNOWN_SECTION.length());
            int header = line - 1;
            int start = header <= 1 ? "###Pure".length() + 1 : lineLength(text, header - 1) + 1;
            return new SourceInfo("", line, start, line, start + "\n###".length() + name.length() - 1);
        }
        int offset = offset(text, line, column);
        int end = endOfSection(text, offset < 0 ? text.length() : offset);
        if (end >= 0) {
            // the section's text ends here (lite stops after its last token): the engine's end of input is where the
            // section's text ends, after the last token's trailing space -- the end of the text, or the start of the
            // next section's header line
            int eofLine = 1 + count(text, end);
            int eofColumn = end - (text.lastIndexOf('\n', end - 1) + 1) + 1;
            return new SourceInfo("", eofLine, eofColumn, eofLine, eofColumn + EOF_LENGTH - 1);
        }
        return new SourceInfo("", line, column, line, column + tokenLength(text, offset) - 1);
    }

    /** Where the section's text ends, when only space and comments lie between {@code offset} and it: the end of the
     *  text, or the start of the line of the next {@code ###} header; -1 where a token comes first. */
    private static int endOfSection(String text, int offset) {
        int i = offset;
        while (i < text.length()) {
            char c = text.charAt(i);
            if (text.startsWith("//", i)) {
                int nl = text.indexOf('\n', i);
                i = nl < 0 ? text.length() : nl;
            } else if (text.startsWith("/*", i)) {
                int close = text.indexOf("*/", i + 2);
                i = close < 0 ? text.length() : close + 2;
            } else if (Character.isWhitespace(c)) {
                i++;
            } else {
                boolean lineStart = i == 0 || text.charAt(i - 1) == '\n';
                return lineStart && text.startsWith("###", i) ? i : -1;
            }
        }
        return text.length();
    }

    private static int count(String text, int end) {
        int n = 0;
        for (int i = 0; i < end; i++) {
            if (text.charAt(i) == '\n') {
                n++;
            }
        }
        return n;
    }

    /** The offset of 1-based {@code line} and {@code column} in {@code text}, or -1 at or past its end. */
    private static int offset(String text, int line, int column) {
        int at = 0;
        for (int l = 1; l < line; l++) {
            int nl = text.indexOf('\n', at);
            if (nl < 0) {
                return -1;
            }
            at = nl + 1;
        }
        int offset = at + column - 1;
        return offset < text.length() ? offset : -1;
    }

    /** 1-based {@code line}'s length in {@code text}, its line break not counted. */
    private static int lineLength(String text, int line) {
        int at = 0;
        for (int l = 1; l < line; l++) {
            int nl = text.indexOf('\n', at);
            if (nl < 0) {
                return 0;
            }
            at = nl + 1;
        }
        int nl = text.indexOf('\n', at);
        int end = nl < 0 ? text.length() : nl;
        return end > at && text.charAt(end - 1) == '\r' ? end - at - 1 : end - at;
    }

    /**
     * The length of legend-engine's token at {@code offset} in {@code text}: the longest of its lexer's rules that
     * matches there, as ANTLR's lexer chooses ({@code CoreLexerGrammar.g4}, {@code CoreFragmentGrammar.g4}; a section's
     * own tokens, a mapping's {@code ~mainTable} say, are not read) -- a word, a number, a date, a string (a quote its
     * line does not close is no string: the catch-all {@code INVALID} reads the quote alone), an island's opening, a
     * two-character operator -- or one character. Scanned by hand, in one pass: a pattern's repeated alternation
     * recurses once per character, which a long token (a string kilobytes long) overflows, in the browser's module
     * above all.
     */
    private static int tokenLength(String text, int offset) {
        int n = text.length();
        char c = text.charAt(offset);
        int end = offset + 1;
        if (c == '\'') {
            end = Math.max(end, textBlockEnd(text, offset));
            end = Math.max(end, quotedEnd(text, offset, '\''));
        } else if (c == '"') {
            // ###Relational's quoted name (RelationalLexerGrammar.g4's QUOTED_STRING)
            end = Math.max(end, quotedEnd(text, offset, '"'));
        } else if (c == '%') {
            if (text.startsWith("%latest", offset)) {
                end = Math.max(end, offset + "%latest".length());
            }
            end = Math.max(end, dateEnd(text, offset));
            end = Math.max(end, timeEnd(text, offset + 1));
        } else if (c == '#') {
            // ISLAND_OPEN: '#' (~[#{])* '{'
            int j = offset + 1;
            while (j < n && text.charAt(j) != '#' && text.charAt(j) != '{') {
                j++;
            }
            if (j < n && text.charAt(j) == '{') {
                end = j + 1;
            }
        } else if (word(c) || c == '.') {
            if (word(c)) {
                // ValidString: (Letter | Digit | '_') (Letter | Digit | '_' | '$')*
                int j = offset + 1;
                while (j < n && (word(text.charAt(j)) || text.charAt(j) == '$')) {
                    j++;
                }
                end = j;
            }
            end = Math.max(end, numberEnd(text, offset));
        }
        if (text.startsWith("PRIMARY KEY", offset)) {
            // ###Relational's own
            end = Math.max(end, offset + "PRIMARY KEY".length());
        }
        for (String op : OPERATORS) {
            if (text.startsWith(op, offset)) {
                end = Math.max(end, offset + op.length());
            }
        }
        return end - offset;
    }

    /** The two-character operators, and ISLAND_END. */
    private static final List<String> OPERATORS = List.of("::", "->", "==", "!=", "<=", ">=", "&&", "||", "..", "}#");

    private static boolean word(char c) {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_';
    }

    private static boolean digit(String text, int i) {
        return i < text.length() && text.charAt(i) >= '0' && text.charAt(i) <= '9';
    }

    /** The index after the digits at {@code i}, or -1 where there is none. */
    private static int digits(String text, int i) {
        if (!digit(text, i)) {
            return -1;
        }
        int j = i;
        while (digit(text, j)) {
            j++;
        }
        return j;
    }

    /** A string between two {@code quote}s on one line, its escapes read: the index after it, or -1. */
    private static int quotedEnd(String text, int offset, char quote) {
        int j = offset + 1;
        while (j < text.length()) {
            char d = text.charAt(j);
            if (d == '\\') {
                j += 2;
            } else if (d == quote) {
                return j + 1;
            } else if (d == '\n' || d == '\r') {
                return -1;
            } else {
                j++;
            }
        }
        return -1;
    }

    /** TextBlock: three quotes, spaces or tabs, a line break, then anything up to the next three quotes: the index
     *  after them, or -1. */
    private static int textBlockEnd(String text, int offset) {
        String three = "'''";
        if (!text.startsWith(three, offset)) {
            return -1;
        }
        int j = offset + 3;
        while (j < text.length() && (text.charAt(j) == ' ' || text.charAt(j) == '\t')) {
            j++;
        }
        if (j < text.length() && text.charAt(j) == '\r') {
            j++;
        }
        if (j >= text.length() || text.charAt(j) != '\n') {
            return -1;
        }
        int close = text.indexOf(three, j + 1);
        return close < 0 ? -1 : close + 3;
    }

    /** Float ({@code [0-9]* '.' [0-9]+ exponent? [fF]?}) or Decimal (that, or digits, then {@code [dD]}): the index
     *  after it, or -1. */
    private static int numberEnd(String text, int offset) {
        int j = offset;
        while (digit(text, j)) {
            j++;
        }
        boolean whole = j > offset;
        boolean fraction = false;
        if (j < text.length() && text.charAt(j) == '.' && digit(text, j + 1)) {
            j = digits(text, j + 1);
            fraction = true;
        }
        if (!whole && !fraction) {
            return -1;
        }
        if (j < text.length() && (text.charAt(j) == 'e' || text.charAt(j) == 'E')) {
            int k = j + 1;
            if (k < text.length() && (text.charAt(k) == '+' || text.charAt(k) == '-')) {
                k++;
            }
            int e = digits(text, k);
            if (e > 0) {
                j = e;
            }
        }
        if (j < text.length() && (text.charAt(j) == 'd' || text.charAt(j) == 'D')) {
            return j + 1;
        }
        if (!fraction) {
            return -1;
        }
        return j < text.length() && (text.charAt(j) == 'f' || text.charAt(j) == 'F') ? j + 1 : j;
    }

    /** Date: {@code '%' '-'? digits ('-' digits ('-' digits ('T' time zone?)?)?)?}: the index after it, or -1. */
    private static int dateEnd(String text, int offset) {
        int j = offset + 1;
        if (j < text.length() && text.charAt(j) == '-') {
            j++;
        }
        j = digits(text, j);
        if (j < 0) {
            return -1;
        }
        int month = text.startsWith("-", j) ? digits(text, j + 1) : -1;
        if (month < 0) {
            return j;
        }
        int day = text.startsWith("-", month) ? digits(text, month + 1) : -1;
        if (day < 0) {
            return month;
        }
        int time = text.startsWith("T", day) ? timeEnd(text, day + 1) : -1;
        if (time < 0) {
            return day;
        }
        int zone = text.startsWith("'", time) ? quotedEnd(text, time, '\'') : -1;
        if (zone < 0 && time < text.length() && (text.charAt(time) == '+' || text.charAt(time) == '-')
                && digits(text, time + 1) == time + 5) {
            zone = time + 5;
        }
        return zone < 0 ? time : zone;
    }

    /** DateTime, and a StrictTime after its '%': {@code digits (':' digits (':' digits ('.' digits)?)?)?}: the index
     *  after it, or -1. */
    private static int timeEnd(String text, int i) {
        int j = digits(text, i);
        if (j < 0) {
            return -1;
        }
        int minutes = text.startsWith(":", j) ? digits(text, j + 1) : -1;
        if (minutes < 0) {
            return j;
        }
        int seconds = text.startsWith(":", minutes) ? digits(text, minutes + 1) : -1;
        if (seconds < 0) {
            return minutes;
        }
        int fraction = text.startsWith(".", seconds) ? digits(text, seconds + 1) : -1;
        return fraction < 0 ? seconds : fraction;
    }
}
