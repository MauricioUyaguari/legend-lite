// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.edge;

import com.legend.server.LiteV1Api;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * legend-lite's model JSON against legend-engine 4.152.x's, and legend-engine's read and printed back (T4 and T5 of
 * Studio's local mode, docs/LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md; phase 1 aligns to 4.152.x, the user's ruling of
 * 2026-11-23, and the rulings of 2026-11-24: the edge re-spells the time zone, S424; the JSON no Studio hash reads keeps
 * the pin's bytes, S428). Each expected fragment is a running legend-engine's answer to the same text (4.152.1-SNAPSHOT,
 * {@code aa1c755}, measured 2026-11-23), except where a row says otherwise.
 */
class EngineJsonAlignmentTest {

    private static String json(String text) {
        LiteV1Api.Answer a = PureV1Routes.grammarToJsonModel(text, false);
        assertEquals(200, a.status(), a.json());
        return a.json();
    }

    private static String standard(String json) {
        LiteV1Api.Answer a = PureV1Routes.jsonToGrammarModel(json, "STANDARD");
        assertEquals(200, a.status(), a.json());
        return a.json();
    }

    private static final String SIGNED = """
            function model::Add(a: Integer[1], b: Float[*]): Float[1]
            {
              $a + $b->sum()
            }
            {
              t1 | Add(-1, [-1.5, 2, +3]) => -3.5;
              t2 | Add(+2, []) => +2.0;
              t3 | Add(- 4, [1]) => -3;
            }
            """;

    /** A function test's value is legend-engine's primitiveValue: a signed Integer or Float is one literal spanning the
     *  sign, never minus(n), whose JSON legend-engine's compiler refuses (a ClassCastException, 500). */
    @Test
    void aSignedNumberInAFunctionTest_isOneLiteral() {
        String json = json(SIGNED);
        assertTrue(json.contains("{\"name\":\"a\",\"value\":{\"_type\":\"integer\",\"sourceInformation\":{\"endColumn\":13,"
                + "\"endLine\":6,\"sourceId\":\"\",\"startColumn\":12,\"startLine\":6},\"value\":-1}}"), json);
        assertTrue(json.contains("{\"_type\":\"float\",\"sourceInformation\":{\"endColumn\":20,\"endLine\":6,"
                + "\"sourceId\":\"\",\"startColumn\":17,\"startLine\":6},\"value\":-1.5}"), json);
        assertTrue(json.contains("{\"_type\":\"integer\",\"sourceInformation\":{\"endColumn\":27,\"endLine\":6,"
                + "\"sourceId\":\"\",\"startColumn\":26,\"startLine\":6},\"value\":3}"), json);
        assertTrue(json.contains("\"expected\":{\"_type\":\"float\",\"sourceInformation\":{\"endColumn\":37,\"endLine\":6,"
                + "\"sourceId\":\"\",\"startColumn\":34,\"startLine\":6},\"value\":-3.5}"), json);
        assertFalse(json.contains("\"function\":\"minus\""), json);
        String printed = standard(json);
        assertTrue(printed.contains("  t1 | Add(-1,[-1.5, 2, 3]) => -3.5;\n  t2 | Add(2,[]) => 2.0;\n"
                + "  t3 | Add(-4,[1]) => -3;\n"), printed);
        // a sign in the function's body stays the call it is, as legend-engine reads a body
        assertTrue(json(SIGNED.replace("$a + $b->sum()", "-$a")).contains("\"function\":\"minus\""));
    }

    private static final String DATA = """
            ###Data
            Data data::PersonData
            {
              ExternalFormat
              #{
                contentType: 'application/json';
                data: '{}';
              }#
            }

            ###Pure
            function model::Greet(name: String[1]): String[1]
            {
              'Hello ' + $name
            }
            {
              data::PersonData;
              (dataspace) ModelStore: (JSON) '{"name":"John"}';
              testA | Greet('John') => 'Hello John';
            }
            """;

    /** A function test's data: a bare reference to a Data element is legend-engine 4.151.4's reference resolver, its
     *  only spelling; the store form keeps the pinned 4.145.0's bytes, which Studio writes too (S428). */
    @Test
    void aFunctionTestsData_aReferenceIsAResolver_theStoreFormThePinsShape() {
        String json = json(DATA);
        assertTrue(json.contains("\"testData\":[{\"_type\":\"referenceDataResolver\",\"elementPointer\":{\"path\":"
                + "\"data::PersonData\"}},{\"data\":{\"_type\":\"externalFormat\","
                + "\"contentType\":\"application/json\",\"data\":\"{\\\"name\\\":\\\"John\\\"}\"},"
                + "\"packageableElementPointer\":{\"path\":\"ModelStore\",\"type\":\"DATASPACE\"}}]"), json);
        String printed = standard(json);
        assertTrue(printed.contains("{\n  data::PersonData;\n  (dataspace) ModelStore: (JSON) '{\"name\":\"John\"}';\n"
                + "  testA | Greet('John') => 'Hello John';\n}"), printed);
    }

    /** 4.151.4's base resolver, as legend-engine writes it, is read (and printed as the engine prints it). */
    @Test
    void aFunctionTestsDataAsABaseResolver_isRead() {
        String engines = json(DATA).replace("{\"data\":{\"_type\":\"externalFormat\"",
                "{\"_type\":\"baseDataResolver\",\"data\":{\"_type\":\"externalFormat\"")
                .replace("\"packageableElementPointer\":{\"path\":\"ModelStore\"", "\"elementPointer\":{\"path\":\"ModelStore\"");
        assertTrue(engines.contains("\"_type\":\"baseDataResolver\""), engines);
        assertEquals(standard(json(DATA)), standard(engines));
    }

    private static final String CONNECTION = """
            ###Connection
            RelationalDatabaseConnection c::C
            {
              store: d::D;
              type: H2;
              timezone: 'America/New_York';
              specification: LocalH2
              {
              };
              auth: DefaultH2;
            }
            """;

    /** A connection's time zone on grammarToJson/model is the grammar's token, quotes and all, as 4.152.x writes it
     *  (cbc6b6ce43 reverted 4.145.0's stripping), and printed as written (S424: the edge re-spells it, the product
     *  keeps the pin's bare id). */
    @Test
    void aConnectionsTimeZone_onTheRoute_keepsItsQuotes() {
        String json = json(CONNECTION);
        assertTrue(json.contains("\"timeZone\":\"'America/New_York'\""), json);
        assertEquals(CONNECTION, standard(json));
        assertTrue(PureV1Routes.grammarToJsonModel(CONNECTION, true).json().contains("\"timeZone\":\"'America/New_York'\""));
        // an offset is bare, both ways
        String offset = CONNECTION.replace("'America/New_York'", "+0700");
        assertTrue(json(offset).contains("\"timeZone\":\"+0700\""));
        assertEquals(offset, standard(json(offset)));
        // the product writes the pin's bare id
        assertTrue(com.legend.door.Parse.engineDocumentJson(CONNECTION).contains("\"timeZone\":\"America/New_York\""));
    }

    /** S424: a bare id (4.145.0's JSON, a form-mode edit) is printed quoted, where 4.152.x prints it bare, a text its
     *  own parser refuses. */
    @Test
    void aConnectionsTimeZone_bare_isPrintedQuoted() {
        assertEquals(CONNECTION, standard(json(CONNECTION).replace("\"'America/New_York'\"", "\"America/New_York\"")));
    }

    /** S422 (1), S428: an empty additionalColumnsToPersist keeps the pin's bytes, no key; 4.148.0 and later write []. */
    @Test
    void aRelationComparisonsEmptyAdditionalColumns_keepThePinsBytes() {
        String json = json("""
                ###DataQualityValidation
                DataQualityRelationComparison model::KeysOnlyRecon
                {
                   source: #>{store::ReconDb.SourceTable}#;
                   target: #>{store::ReconDb.TargetTable}#;
                   keys: [ID];
                   columnsToCompare: [AMOUNT];
                   strategy: MD5Hash
                   {
                     sourceHashColumn: SRC_HASH;
                     targetHashColumn: TGT_HASH;
                   };
                }
                """);
        assertTrue(json.contains("{\"_type\":\"dataQualityRelationComparison\",\"columnsToCompare\":[\"AMOUNT\"]"), json);
    }
}
