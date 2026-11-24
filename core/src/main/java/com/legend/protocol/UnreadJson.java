// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.protocol;

/**
 * A protocol JSON field no reader rule takes: a field lite does not know, or an older field with a value no record
 * carries. Refused by name, never dropped (docs/SEMANTICS_REGISTER.md S29: legend-engine ignores what it does not know
 * on its ignore-unknown classes). Its own type, so a caller can tell this refusal from a malformed request (T3 of
 * Studio's local mode, 2026-11-24: legend-engine's API marks it a ruled refusal).
 */
public final class UnreadJson extends IllegalArgumentException {

    private static final long serialVersionUID = 1L;

    UnreadJson(String message) {
        super(message);
    }
}
