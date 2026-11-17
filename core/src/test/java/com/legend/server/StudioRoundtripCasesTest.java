package com.legend.server;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Cases of legend-studio's manual grammar roundtrip suite (packages/legend-manual-tests/src/__tests__/roundtrip-grammar
 * /cases), each as Studio runs it: the text parsed to JSON without source information, the JSON printed back in the
 * STANDARD style byte for byte, and the JSON compiled, as legend-engine 4.145.0 answers all three (neema2/legend-lite#113,
 * the fork's studio-compatibility-dev). Each case is the suite's file, verbatim.
 */
class StudioRoundtripCasesTest {

    private static void roundtrips(String text) {
        PureV1Api.Answer json = PureV1Api.grammarToJsonModel(text, false);
        assertEquals(200, json.status(), json.json());
        PureV1Api.Answer printed = PureV1Api.jsonToGrammarModel(json.json(), "STANDARD");
        assertEquals(200, printed.status(), printed.json());
        assertEquals(text, printed.json());
        PureV1Api.Answer compiled = PureV1Api.compile(json.json());
        assertEquals("{\"message\":\"OK\",\"defects\":[]}", compiled.json());
        assertEquals(200, compiled.status());
    }

    /**
     * A relational property mapping's {@code if(c, 'LARGE', sqlNull())}: the engine types the store's NULL literal as
     * {@code Other}, absorbed by the other branch's type. Lite failed at the compile, "property 'sizeBucket' of
     * 'model::domain::Trade': expected String, got meta::pure::metamodel::type::Any" (2026-11-16).
     */
    @Test
    void relationalMappingJoinChainsAndDistinct() {
        roundtrips("""
###Relational
Database model::store::TradeDB
(
  Schema trading
  (
    Table TradeTable
    (
      ID INTEGER PRIMARY KEY,
      ACCOUNT_ID INTEGER,
      QUANTITY INTEGER,
      STATUS_CODE VARCHAR(10),
      PRODUCT_NAME VARCHAR(200)
    )
    Table AccountTable
    (
      ID INTEGER PRIMARY KEY,
      FIRM_ID INTEGER,
      ACCOUNT_NAME VARCHAR(200),
      ACTIVE_FLAG VARCHAR(1)
    )
    Table FirmTable
    (
      ID INTEGER PRIMARY KEY,
      LEGAL_NAME VARCHAR(200),
      REGION VARCHAR(20)
    )
  )

  Join TradeAccount(trading.TradeTable.ACCOUNT_ID = trading.AccountTable.ID)
  Join AccountFirm(trading.AccountTable.FIRM_ID = trading.FirmTable.ID)

  Filter ActiveAccountFilter(trading.AccountTable.ACTIVE_FLAG = 'Y')
)


###Pure
Enum model::domain::TradeStatus
{
  OPEN,
  CLOSED,
  UNKNOWN
}

Class model::domain::Trade
{
  id: Integer[1];
  quantity: Integer[1];
  description: String[0..1];
  accountName: String[0..1];
  firmName: String[0..1];
  firmRegion: String[0..1];
  status: model::domain::TradeStatus[0..1];
  sizeBucket: String[0..1];
}

Class model::domain::ActiveTrade
{
  id: Integer[1];
  accountName: String[0..1];
}


###Mapping
Mapping model::mapping::TradeMapping
(
  *model::domain::Trade[trade]: Relational
  {
    ~distinct
    ~primaryKey
    (
      [model::store::TradeDB]trading.TradeTable.ID
    )
    ~mainTable [model::store::TradeDB]trading.TradeTable
    +accountId: Integer[0..1]: [model::store::TradeDB]trading.TradeTable.ACCOUNT_ID,
    id: [model::store::TradeDB]trading.TradeTable.ID,
    quantity: [model::store::TradeDB]trading.TradeTable.QUANTITY,
    description: concat([model::store::TradeDB]trading.TradeTable.PRODUCT_NAME, ' - ', [model::store::TradeDB]trading.TradeTable.STATUS_CODE),
    accountName: [model::store::TradeDB]@TradeAccount | [model::store::TradeDB]trading.AccountTable.ACCOUNT_NAME,
    firmName: [model::store::TradeDB]@TradeAccount > (OUTER) [model::store::TradeDB]@AccountFirm | [model::store::TradeDB]trading.FirmTable.LEGAL_NAME,
    firmRegion: [model::store::TradeDB]@TradeAccount > (INNER) [model::store::TradeDB]@AccountFirm | [model::store::TradeDB]trading.FirmTable.REGION,
    status: EnumerationMapping TradeStatusMapping: case(equal([model::store::TradeDB]trading.TradeTable.STATUS_CODE, 'OPEN'), 'O', equal([model::store::TradeDB]trading.TradeTable.STATUS_CODE, 'CLOSED'), 'C', 'U'),
    sizeBucket: if(greaterThan([model::store::TradeDB]trading.TradeTable.QUANTITY, 1000), 'LARGE', sqlNull())
  }
  *model::domain::ActiveTrade[activeTrade]: Relational
  {
    ~filter [model::store::TradeDB] (INNER) @TradeAccount | [model::store::TradeDB]ActiveAccountFilter
    ~primaryKey
    (
      [model::store::TradeDB]trading.TradeTable.ID
    )
    ~mainTable [model::store::TradeDB]trading.TradeTable
    id: [model::store::TradeDB]trading.TradeTable.ID,
    accountName: [model::store::TradeDB]@TradeAccount | [model::store::TradeDB]trading.AccountTable.ACCOUNT_NAME
  }

  model::domain::TradeStatus: EnumerationMapping TradeStatusMapping
  {
    OPEN: ['O'],
    CLOSED: ['C'],
    UNKNOWN: ['U']
  }
)
                """);
    }
}
