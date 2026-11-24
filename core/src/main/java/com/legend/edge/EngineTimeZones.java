// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import java.util.ArrayList;
import java.util.List;

/**
 * A RELATIONAL CONNECTION'S TIME ZONE AS LEGEND-ENGINE 4.152.x WRITES IT (T5 of
 * docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md, Studio's local mode; the user's ruling of 2026-11-24, "Edge
 * re-spells"): legend-engine writes a {@code ###Connection}'s {@code timezone} as its grammar token, quotes and all
 * ({@code RelationalDatabaseConnectionParseTreeWalker}: {@code TIMEZONE().getText()}; 4.145.0 to 4.150.x stripped the
 * quotes, which {@code cbc6b6ce43}, "Revert time-zone fixes", undid). Studio hashes the zone's text, so a model stored
 * from 4.152.x's JSON shows a local change after a text-mode round trip unless the route writes the same text. The
 * product writes the pinned 4.145.0's bare id; {@code grammarToJson/model} writes it here as the grammar spelled it: a
 * zone id between quotes, an offset ({@code +0700}) bare. Only a {@code RelationalDatabaseConnection}'s own
 * {@code timeZone} member is touched, and only its value: every other byte is the product's.
 */
final class EngineTimeZones {

    private EngineTimeZones() {
    }

    /** {@code json} with each relational connection's {@code timeZone} written as legend-engine 4.152.x writes it. */
    static String asWritten(String json) {
        if (!json.contains("\"timeZone\"")) {
            return json;
        }
        StringBuilder out = new StringBuilder(json.length() + 16);
        List<Frame> stack = new ArrayList<>();
        boolean atKey = false;
        String key = null;
        int i = 0;
        while (i < json.length()) {
            char c = json.charAt(i);
            if (c == '{' || c == '[') {
                stack.add(new Frame(c == '{'));
                atKey = c == '{';
                key = null;
                out.append(c);
                i++;
            } else if (c == '}' || c == ']') {
                stack.remove(stack.size() - 1);
                atKey = false;
                key = null;
                out.append(c);
                i++;
            } else if (c == ',') {
                atKey = !stack.isEmpty() && stack.get(stack.size() - 1).object;
                key = null;
                out.append(c);
                i++;
            } else if (c == '"') {
                int end = stringEnd(json, i);
                Frame top = stack.isEmpty() ? null : stack.get(stack.size() - 1);
                if (atKey) {
                    key = json.substring(i + 1, end - 1);
                    out.append(json, i, end);
                } else if (top != null && top.object && java.util.Objects.equals(key, "_type") && top.type == null) {
                    top.type = json.substring(i + 1, end - 1);
                    out.append(json, i, end);
                } else if (top != null && java.util.Objects.equals(key, "timeZone")
                        && java.util.Objects.equals(top.type, "RelationalDatabaseConnection")) {
                    String zone = ((com.legend.json.Json.Str) com.legend.json.Json.parse(json.substring(i, end))).value();
                    out.append(com.legend.json.Json.toCompact(token(zone)));
                } else {
                    out.append(json, i, end);
                }
                atKey = false;
                i = end;
            } else {
                out.append(c);
                i++;
            }
        }
        return out.toString();
    }

    /** The zone as the grammar's {@code TIMEZONE} token spells it: an offset bare, an id between quotes, escaped. */
    private static String token(String zone) {
        if (zone.matches("[+-][0-9]{4}") || (zone.length() >= 2 && zone.startsWith("'") && zone.endsWith("'"))) {
            return zone;
        }
        return "'" + zone.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    /** The index after the string literal that opens at {@code start}. */
    private static int stringEnd(String json, int start) {
        int j = start + 1;
        while (json.charAt(j) != '"') {
            j += json.charAt(j) == '\\' ? 2 : 1;
        }
        return j + 1;
    }

    /** An open object or array, and an object's {@code _type} once read (its first member, where the emitter writes
     *  it). */
    private static final class Frame {
        final boolean object;
        @com.legend.base.Nullable String type;

        Frame(boolean object) {
            this.object = object;
        }
    }
}
