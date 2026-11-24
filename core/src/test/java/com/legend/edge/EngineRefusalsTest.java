// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import com.legend.error.CompileKind;
import com.legend.json.Json;
import com.legend.server.LiteV1Api;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * legend-lite's refusals marked in legend-engine's error answer (T3 of Studio's local mode,
 * docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md; the user's rulings of 2026-11-24, {@link EngineRefusals};
 * docs/SEMANTICS_REGISTER.md S429): {@code "refusal": {"kind": "UNSUPPORTED"}} or {@code {"kind": "RULED", "row": ...}}
 * beside the engine's fields, and nothing on the user's own errors.
 */
class EngineRefusalsTest {

    private static Json.Obj body(LiteV1Api.Answer a) {
        return (Json.Obj) Json.parse(a.json());
    }

    private static String refusal(LiteV1Api.Answer a) {
        Json.Obj b = body(a);
        if (!b.has("refusal")) {
            return null;
        }
        Json.Obj r = b.getObj("refusal");
        return r.getString("kind") + (r.has("row") ? " " + r.getString("row") : "");
    }

    private static LiteV1Api.Answer compileText(String code) {
        return PureV1Routes.compile(Json.toCompact(Map.of("_type", "text", "code", code)));
    }

    /** The register's acceptance rows marked, each by its compile code (the table the edge reads). */
    @Test
    void theRuledCodes_areTheRegistersAcceptanceRows() {
        assertEquals(Map.of(
                CompileKind.PURE_MAPPING_WITHOUT_SOURCE, "S21",
                CompileKind.DEFAULT_ON_OPTIONAL, "S90",
                CompileKind.INVALID_SUPERTYPE, "S91",
                CompileKind.DUPLICATE_PROPERTY, "S395",
                CompileKind.DUPLICATE_ENUM_VALUE, "S395"), EngineRefusals.RULED);
        assertEquals("S29", EngineRefusals.UNREAD_JSON_ROW);
    }

    @Test
    void s21_aPureClassMappingWithNoSource_isARuledRefusal() {
        LiteV1Api.Answer a = compileText("Class a::A { x: String[1]; }\n###Mapping\nMapping a::M\n(\n  a::A: Pure\n  {\n"
                + "    x: 1\n  }\n)\n");
        assertEquals(400, a.status(), a.json());
        assertEquals("RULED S21", refusal(a), a.json());
        // the engine's fields as they were, the marker after the message
        assertTrue(a.json().matches("\\{\"code\":-1,\"errorType\":\"COMPILATION\",\"message\":\"[^\"]*declares no ~src[^\"]*\","
                + "\"refusal\":\\{\"kind\":\"RULED\",\"row\":\"S21\"},\"sourceInformation\":.*"), a.json());
    }

    @Test
    void s90_aDefaultOnAnOptionalProperty_isARuledRefusal() {
        assertEquals("RULED S90", refusal(compileText("Class a::A { x: String[0..1] = 'a'; }")));
    }

    @Test
    void s395_aDuplicateProperty_isARuledRefusal() {
        assertEquals("RULED S395", refusal(compileText("Class a::A { x: String[1]; x: Integer[1]; }")));
    }

    @Test
    void s29_aJsonFieldNoReaderTakes_isARuledRefusal_itsWordsUnchanged() {
        LiteV1Api.Answer a = PureV1Routes.jsonToGrammarModel("{\"_type\":\"data\",\"elements\":[{\"_type\":\"class\","
                + "\"name\":\"A\",\"package\":\"a\",\"properties\":[],\"bogusField\":1}]}", "STANDARD");
        assertEquals(500, a.status(), a.json());
        assertEquals("RULED S29", refusal(a), a.json());
        assertEquals("IllegalArgumentException: protocol JSON: element 'class' has a field no reader rule takes:"
                + " 'bogusField'", body(a).getString("message"));
    }

    @Test
    void anElementKindLiteHasNoReaderFor_isUnsupported() {
        LiteV1Api.Answer a = PureV1Routes.jsonToGrammarModel("{\"_type\":\"data\",\"elements\":[{\"_type\":"
                + "\"someNewElement\",\"name\":\"A\",\"package\":\"a\"}]}", "STANDARD");
        assertEquals("UNSUPPORTED", refusal(a), a.json());
        assertTrue(body(a).getString("message").startsWith("IllegalArgumentException: protocol JSON: no reader rule"));
    }

    @Test
    void aConstructLiteDoesNotImplement_isUnsupported() {
        assertEquals(Map.of("kind", "UNSUPPORTED"),
                EngineRefusals.of(new com.legend.error.NotImplementedException("a construct")));
        // through a wrapper too
        assertEquals(Map.of("kind", "UNSUPPORTED"), EngineRefusals.of(
                new IllegalStateException("wrapped", new com.legend.error.NotImplementedException("a construct"))));
    }

    @Test
    void theUsersOwnErrors_carryNoMarker() {
        assertFalse(body(compileText("Class a::A { x: Strin[1]; }")).has("refusal"));
        assertFalse(body(PureV1Routes.grammarToJsonModel("Class a::A { x: String[1] }", true)).has("refusal"));
        assertFalse(body(PureV1Routes.jsonToGrammarModel("not json", "STANDARD")).has("refusal"));
    }
}
