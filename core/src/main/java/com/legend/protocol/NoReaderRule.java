// Copyright 2026 Legend Contributors
// SPDX-License-Identifier: Apache-2.0

package com.legend.protocol;

/**
 * A protocol JSON {@code _type} lite has no reader rule for: an element or value kind lite does not implement, refused
 * by name. Its own type, so a caller can tell a kind lite does not support from a malformed request (T3 of Studio's
 * local mode, 2026-11-24: legend-engine's API marks it an unsupported refusal).
 */
public final class NoReaderRule extends IllegalArgumentException {

    private static final long serialVersionUID = 1L;

    NoReaderRule(String message) {
        super(message);
    }
}
