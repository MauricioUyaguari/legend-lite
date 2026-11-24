// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import com.legend.json.Json;
import com.legend.server.LiteV1Api;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@code grammar/grammarToJson/model}'s parse error carries legend-engine's {@code sourceInformation} (T2 of Studio's
 * local mode, docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md, 2026-11-23; {@link ParseErrorPlace}). Each expected span
 * is a running legend-engine's answer to the same text (4.152.1-SNAPSHOT, {@code aa1c755}, measured 2026-11-23,
 * {@code docs/legend-studio-text-mode-homework/parse-errors/}), except the rows marked as the register's, where lite's
 * place is pinned beside the engine's (docs/SEMANTICS_REGISTER.md S423).
 */
class ParseErrorPlaceTest {

    /** The answer's span as {startLine, startColumn, endLine, endColumn}, or null; its status 400 PARSER. */
    private static int[] span(String text, boolean returnSourceInformation) {
        LiteV1Api.Answer a = PureV1Routes.grammarToJsonModel(text, returnSourceInformation);
        assertEquals(400, a.status(), a.json());
        Json.Obj body = (Json.Obj) Json.parse(a.json());
        assertEquals("PARSER", body.getString("errorType"));
        if (!body.has("sourceInformation")) {
            return null;
        }
        Json.Obj s = body.getObj("sourceInformation");
        assertEquals("", s.getString("sourceId"));
        return new int[] {s.getInt("startLine"), s.getInt("startColumn"), s.getInt("endLine"), s.getInt("endColumn")};
    }

    private static void placed(String text, int... expected) {
        for (boolean asked : new boolean[] {true, false}) {
            // the engine writes a parse error's place whatever returnSourceInformation asks
            assertEquals(java.util.Arrays.toString(expected), java.util.Arrays.toString(span(text, asked)),
                    "returnSourceInformation=" + asked);
        }
    }

    @Test
    void theOffendingToken_aOneCharacterOne() {
        // engine: "Unexpected token '}'. Valid alternatives: ['=', ';']"
        placed("Class a::A\n{\n  name: String[1]\n}\n", 4, 1, 4, 1);
        // engine: "Unexpected token '$'. Valid alternatives: ['=', ';']"
        placed("Class a::A { name: String[1] $ }\n", 1, 30, 1, 30);
    }

    @Test
    void theOffendingToken_aWordSpansItsLength() {
        // engine: "Unexpected token 'other'. Valid alternatives: ['=', ';']"
        placed("Class a::A\n{\n  name: String[1]\n  other: Integer[1];\n}\n", 4, 3, 4, 7);
    }

    @Test
    void aQuoteItsLineDoesNotClose_isOneCharacter() {
        // engine: "Unexpected token" (its lexer's catch-all reads the quote alone)
        placed("Class a::A\n{\n  name: String[1] = 'abc;\n}\n", 3, 21, 3, 21);
    }

    /** A long token is scanned in one pass (a pattern's alternation recursed per character and overflowed the module's
     *  stack on a 6,000-character string, 2026-11-24). */
    @Test
    void aLongToken_isScannedWithoutRecursion() {
        String big = "x".repeat(20_000);
        // engine (6,000 characters): "Unexpected token", the quote alone
        placed("Class a::A\n{\n  name: String[1] = '" + big + "\n}\n", 3, 21, 3, 21);
        // a string that closes spans all of it
        placed("Class a::A\n{\n  name: String[1] = '" + big + "'\n  other: Integer[1];\n}\n", 4, 3, 4, 7);
    }

    @Test
    void theEndOfTheText_isEofsFiveCharacters() {
        // engine: "Unexpected token '<EOF>'. Valid alternatives: ['import', 'Class', ...]"
        placed("Class a::A {} Class", 1, 20, 1, 24);
    }

    @Test
    void aSectionNoParserKnows_isItsOpeningToken_andOnlyWhenAsked() {
        // engine: "'Bogus' is not a known section parser" -- the line after the header, from the previous line's end
        String text = "###Pure\nClass a::A {}\n###Bogus\nfoo\n";
        assertEquals("[4, 14, 4, 22]", java.util.Arrays.toString(span(text, true)));
        assertNull(span(text, false));
        // a section opening the text: after the ###Pure the engine puts before it
        assertEquals("[2, 8, 2, 16]", java.util.Arrays.toString(span("###Bogus\nfoo\n", true)));
        assertEquals("[5, 1, 5, 9]", java.util.Arrays.toString(span("Class a::A {}\n\n\n###Bogus\nfoo\n", true)));
    }

    /** S423: at the end of the input the engine spells either {@code <EOF>}'s five characters or, where its parser
     *  recovers by a missing token, a one-column span a column to the left; lite writes the first. */
    @Test
    void register_theEndOfInputsOtherSpelling() {
        // engine: [6, 0, 6, 0], "Unexpected token"
        placed("###Mapping\nMapping m::M\n(\n  a::A: Pure {\n  }\n", 6, 1, 6, 5);
    }

    /** S423: inside a relational connection's authentication and specification the engine counts one line short;
     *  lite places the error on its own line. */
    @Test
    void register_aConnectionsEmbeddedBlock_isOnItsOwnLine() {
        // engine: [15, 31, 15, 37], "Unexpected token" -- the error is on line 16
        placed("""
                ###Connection
                RelationalDatabaseConnection c::C
                {
                  store: d::D;
                  type: Snowflake;
                  specification: Snowflake
                  {
                    name: 'db';
                    account: 'acc';
                    warehouse: 'wh';
                    region: 'EMEA';
                  };
                  auth: SnowflakePublic
                  {
                    publicUserName: 'user';
                    privateKeyVaultReference  'value';
                    passPhraseVaultReference: 'value';
                  };
                }
                """, 16, 31, 16, 37);
    }

    @Test
    void theMessageIsLitesSentence_andAParsedTextIsUntouched() {
        LiteV1Api.Answer a = PureV1Routes.grammarToJsonModel("Class a::A\n{\n  name: String[1]\n}\n", true);
        assertTrue(a.json().contains("\"message\":\"[4:1] expected SEMI_COLON"), a.json());
        assertEquals(200, PureV1Routes.grammarToJsonModel("Class a::A\n{\n  name: String[1];\n}\n", true).status());
        // the lambda route keeps its place in its message alone
        assertTrue(!PureV1Routes.grammarToJsonLambda("|$x $", true).json().contains("sourceInformation"));
    }
}
