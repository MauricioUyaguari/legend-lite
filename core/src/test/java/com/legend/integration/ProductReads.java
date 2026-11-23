// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.integration;

import com.legend.Compiler;
import com.legend.Execution;
import com.legend.exec.PlanSessions;
import com.legend.exec.ProductRun;
import com.legend.exec.SessionSource;
import com.legend.model.ConnectionDefinition.DatabaseType;
import com.legend.result.Collector;
import com.legend.result.Output;
import com.legend.testbackend.TestBackend;
import com.legend.testbackend.TestBackends;
import com.legend.testbackend.TestSessions;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;

/**
 * A product test's read of a model on each in-process database: the query planned and run through the product's door
 * ({@code Execution.run}), its rows as strings. The product half of {@link DataDeliveryMatrixTest}'s helpers -- its
 * {@code DATABASES}, {@code Data}, {@code read} and {@code connection}, copied unchanged -- for the product tests that
 * used them (the Studio roundtrip's mapping tests on the fork's studio-compatibility-dev), since that class became an
 * edge test (core/edge_tests.bzl: it also drives the edge's {@code ServiceTestRunner}) and a product test cannot reach
 * it (the sync of studio-compatibility-dev with neema2's main, 2026-11-23). Not a test class: it holds no test.
 */
final class ProductReads {

    private ProductReads() {
    }

    /** The in-process databases a product test reads on. */
    static final List<DatabaseType> DATABASES = List.of(DatabaseType.DuckDB, DatabaseType.H2, DatabaseType.SQLite);

    /** A model, a query, the rows it answers and the runtime it reads through. */
    record Data(String model, String query, List<List<String>> rows, @com.legend.base.Nullable String runtime) {
    }

    /** A relational connection {@code x::Conn} to {@code x::DB} on {@code db}, its specification {@code spec}. */
    static String connection(DatabaseType db, String spec) {
        return "RelationalDatabaseConnection x::Conn { store: x::DB; type: " + db + "; " + spec + " }\n";
    }

    /** {@code query} over {@code data}'s model and runtime on {@code db}: its rows, each cell as its string. */
    static List<List<String>> read(Data data, String query, DatabaseType db) throws Exception {
        try (Connection c = session(db)) {
            Collector collector = new Collector();
            Execution.run(Compiler.query(Compiler.compileModel(data.model()), query), data.runtime(),
                    SessionSource.given(TestSessions.over(c)), PlanSessions.of(TestSessions.over(c)),
                    ProductRun.Establish.DECLARED_SETUP, new Output.Rows(collector));
            return strings(collector);
        }
    }

    private static Connection session(DatabaseType db) throws java.sql.SQLException {
        TestBackend backend = TestBackends.of(db);
        return backend.inProcess() ? backend.open() : backend.openWorkspace();
    }

    private static List<List<String>> strings(Collector collector) {
        List<List<String>> out = new ArrayList<>();
        for (List<Object> row : collector.collected().rows()) {
            List<String> cells = new ArrayList<>();
            for (Object cell : row) {
                cells.add(String.valueOf(cell));
            }
            out.add(cells);
        }
        return out;
    }
}
