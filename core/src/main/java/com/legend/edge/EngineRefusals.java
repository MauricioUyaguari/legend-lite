// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import com.legend.error.CompileKind;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A REFUSAL, MARKED IN LEGEND-ENGINE'S ERROR ANSWER (T3 of docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md, Studio's
 * local mode; the user's rulings of 2026-11-24: "A body key: refusal", "Every acceptance row"). Where legend-lite
 * answers a call with an error that is not the user's -- a construct lite does not implement, or a model lite rejects
 * where legend-engine accepts it, by a ruling of its register -- the error JSON carries, beside legend-engine's own
 * fields, {@code "refusal": {"kind": "UNSUPPORTED"}} or {@code {"kind": "RULED", "row": "S21"}}. Studio's local mode
 * reads it (legend-lite's plugin, {@code isRefusal}) and reruns the call on the engine server. legend-engine never writes
 * the key, and Studio's error readers ignore it (docs/SEMANTICS_REGISTER.md S429).
 *
 * <p>Read off the error's type and code, never its words:
 * <ul>
 *   <li>UNSUPPORTED: {@code NotImplementedException}, a dialect's {@code DialectCapability}, a protocol {@code _type}
 *       with no reader rule ({@code NoReaderRule}), a model the printer cannot print ({@code CannotPrint}), and a
 *       section no parser of lite's knows (the one marker read off the parser's words: its refusal has no code);</li>
 *   <li>RULED: the codes of {@link #RULED}, and a protocol field no reader rule takes ({@code UnreadJson}, S29).</li>
 * </ul>
 * An acceptance row whose refusal has no code of its own yet (a generic throw site, or a refusal a query meets at its
 * plan, not at compile) is not marked: S429 lists them.
 */
final class EngineRefusals {

    private EngineRefusals() {
    }

    /** The compile codes of the register's acceptance rows: lite refuses what legend-engine accepts, each ruled. A code
     *  may be wider than its row (S91's: any non-class supertype, where the engine accepts a primitive one): a refusal
     *  the engine shares is rerun there and refused there too, never answered wrongly. Each row is in
     *  docs/refusal-rows.tsv (EngineRefusalsTest). */
    static final Map<CompileKind, String> RULED = Map.of(
            CompileKind.PURE_MAPPING_WITHOUT_SOURCE, "S21",
            CompileKind.DEFAULT_ON_OPTIONAL, "S90",
            CompileKind.INVALID_SUPERTYPE, "S91",
            CompileKind.DUPLICATE_PROPERTY, "S395",
            CompileKind.DUPLICATE_ENUM_VALUE, "S395");

    /** The rule of a field no reader takes, older or unknown JSON. */
    static final String UNREAD_JSON_ROW = "S29";

    /** {@code e}'s marker, or null where it is the user's error (or lite's defect). */
    static @com.legend.base.Nullable Map<String, Object> of(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof com.legend.error.NotImplementedException || t instanceof com.legend.sql.DialectCapability
                    || t instanceof com.legend.protocol.NoReaderRule || t instanceof com.legend.protocol.CannotPrint) {
                return marker("UNSUPPORTED", null);
            }
            if (t instanceof com.legend.parser.ParseException p
                    && String.valueOf(p.getMessage()).endsWith(ParseErrorPlace.UNKNOWN_SECTION)) {
                // a section no parser of lite's knows: one the deployment's engine may parse (T9 of the plan). The one
                // marker read off words: the parser's refusal has no code, and its one spelling is ParseErrorPlace's
                return marker("UNSUPPORTED", null);
            }
            if (t instanceof com.legend.protocol.UnreadJson) {
                return marker("RULED", UNREAD_JSON_ROW);
            }
            if (t instanceof com.legend.error.LegendCompileException c && c.kind() != null && RULED.containsKey(c.kind())) {
                return marker("RULED", RULED.get(c.kind()));
            }
        }
        return null;
    }

    private static Map<String, Object> marker(String kind, @com.legend.base.Nullable String row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind);
        if (row != null) {
            out.put("row", row);
        }
        return out;
    }
}
