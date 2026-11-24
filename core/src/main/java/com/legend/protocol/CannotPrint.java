// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.protocol;

/**
 * A model the printer cannot print, refused by name ({@code model printer: ...}): an element or a value lite reads but
 * does not print, or one legend-engine's own printer cannot print either. Its own type, so a caller can tell it from a
 * malformed request (T3 of Studio's local mode, 2026-11-24: legend-engine's API marks it an unsupported refusal).
 */
public final class CannotPrint extends IllegalArgumentException {

    private static final long serialVersionUID = 1L;

    public CannotPrint(String message) {
        super(message);
    }
}
