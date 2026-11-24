# The model JSON against legend-engine 4.152.x (T4 and T5, 2026-11-23 and 24)

The evidence for register rows S424 to S428 and for T4 and T5 of
[`LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md`](../../LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md) (on the branch
`docs/legend-studio-integration-proposal`).

| File | What it is |
|---|---|
| `align.mjs` | Runs four checks on legend-studio's 133 grammar round-trip cases that both servers parse (see below) |
| `proxy.mjs` | A local HTTP proxy so that legend-studio's own round-trip suite can run against legend-lite. `protocol/pure/*` goes to the engine, since lite lacks those two routes (neema2/legend-lite#100); everything else goes to legend-lite. It counts the calls by route |

`align.mjs`'s four checks:
- **A.** Parse with `returnSourceInformation=true`: is lite's JSON the engine's?
- **B.** Compose the engine's JSON with lite, `PRETTY` and `STANDARD`: is the text the engine's?
- **C.** Compile lite's parse JSON on the engine.
- **D.** Compile the engine's parse JSON on lite.

## Setup

- **legend-engine:** a local build reporting 4.152.1-SNAPSHOT (`aa1c755`), on port 6500. The user ruled on 2026-11-23 that phase 1 aligns to 4.152.x.
- **legend-lite:** `bazel-bin/core/server 6799 --engine legend-engine`, built from this branch.
- **legend-studio:** `c40833edd`, its `packages/legend-manual-tests/src/__tests__/roundtrip-grammar/cases`.

```bash
node align.mjs <legend-studio>/packages/legend-manual-tests/src/__tests__/roundtrip-grammar/cases http://localhost:6500 http://localhost:6799
```

To run legend-studio's suite: start `node proxy.mjs 6300 http://localhost:6799 http://localhost:6500`, only while nothing else uses port 6300. Then run the suite from legend-studio with Node 25, 8 GB of heap, `TEST_GROUP=engine-roundtrip`, and `--modulePathIgnorePatterns '/\.claude/' 'packages/.*/lib/' 'packages/.*/build/'`. The last flag is needed because other sessions' worktrees under `legend-studio/.claude/worktrees` duplicate its packages.

## Results

| Check | Before (`0be02799d`) | After |
|---|---|---|
| A. Parse JSON, positions included | 124 of 133 | 128 of 133 |
| B. Engine JSON composed by lite | 126 of 133 cases (252 of 266) | 266 of 266 |
| C. Lite's JSON compiled by the engine | 132 of 133 | 133 of 133 |
| D. Engine JSON compiled by lite | not measured | 133 of 133 |

The five remaining A differences are all registered:
- **S428 (3 cases):** function-test data in 4.145.0's shape, which Studio itself writes.
- **S428 (1 case):** DQ's empty `additionalColumnsToPersist`.
- **S425 (1 case):** the end position of a multi-line string.

**legend-studio's own suite** (`c40833edd`), through the proxy: 263 of 266 pass, including its graph-hash and local-change checks. The three failures:
- `DSL_Service basic`, with and without extensions: S21, a Pure class mapping with no `~src`. legend-studio's copy of that case was not updated as S21's ruling asked. It is T3's RULED refusal.
- `DSL_DataQuality-relation-comparison-advanced`, with extensions: S428. Studio's own JSON comparison reads the empty list; no hash does.

**Which differences move a Studio hash** (read in legend-studio at finos `ce229d525`):
- **The connection's `timeZone`:** it moves a hash, because Studio hashes the zone's text. The edge now writes 4.152.x's form (S424).
- **Function-test data in either shape:** no hash moves. Studio builds the same resolver from both, and writes the older shape itself (`V1_serializeFunctionTestDataResolver`).
- **DQ's empty list:** no hash moves. Studio defaults it to `[]`.
