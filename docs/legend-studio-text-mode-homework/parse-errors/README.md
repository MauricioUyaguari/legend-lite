# A parse error's place: legend-lite against legend-engine (T2, 2026-11-23)

The evidence for register row S423 and for T2 of
[`LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md`](../../LEGEND_STUDIO_TEXT_MODE_PLAN_2026_11_23.md) (on the branch
`docs/legend-studio-integration-proposal`).

| File | What it is |
|---|---|
| `mutants.mjs` | Breaks each of legend-studio's 135 grammar round-trip cases up to nine deterministic ways: a `;`, a closing bracket or a `:` deleted at 30% and 70% of the text, a `$` inserted before a word at 30% and 70%, the text cut at 60%. 1,171 texts |
| `cmp.mjs` | Sends each text to `grammar/grammarToJson/model` on both servers and compares the status and the `sourceInformation`. Caches the engine's answers |
| `results-4.152.1.tsv` | Each text's verdict and both spans (`returnSourceInformation=true`) |

## Setup

- **legend-engine:** a local build reporting 4.152.1-SNAPSHOT (`aa1c755`), on port 6500. The user ruled on 2026-11-23
  that phase 1 aligns to 4.152.x.
- **legend-lite:** this branch's `//core:server`, run as `bazel-bin/core/server 6799 --engine legend-engine`.
- **legend-studio:** `c40833edd`, `packages/legend-manual-tests/src/__tests__/roundtrip-grammar/cases`.

```bash
node mutants.mjs <legend-studio>/packages/legend-manual-tests/src/__tests__/roundtrip-grammar/cases mut.json
node cmp.mjs mut.json engine-cache.json http://localhost:6500 http://localhost:6799 true
```

Node 25 was used.

## Results

Before the change, legend-lite gave no `sourceInformation` on any of the 1,071 texts both servers refuse.

| Verdict | `true` | `false` |
|---|---|---|
| Both refuse, the same span | 787 | 787 |
| The same start, another end | 7 | 7 |
| The same line, another column | 147 | 147 |
| Another line | 130 | 129 |
| The engine writes no span (a section no parser knows, not asked) | | 1 |
| Both parse | 91 | 91 |
| The engine refuses, legend-lite parses | 6 | 6 |
| The engine parses, legend-lite refuses | 3 | 3 |

What the remaining differences are:

- **The same start, another end (7).** A section's own token the edge does not read, a mapping's `~mainTable` say.
- **The same line, another column (147).** 79 are one column off. Most are the end of the input: the engine spells it as
  `<EOF>`'s five characters or as a zero-width span a column to the left, depending on its parser's recovery. legend-lite
  writes the first.
- **Another line (130).**
  - 39 are the engine's one-line-short count inside a relational connection's `specification` and `auth` blocks, and in
    a few other embedded grammars. legend-lite gives the line the error is on.
  - The rest are places where legend-lite's parser stops at another token than the engine's grammar does: a missing `)`
    noticed sooner or later, or a section's end.
- **Acceptance (9).** The engine and legend-lite disagree on whether the text parses at all. That is not T2. It is listed
  as a follow-up.

The engine writes a parse error's `sourceInformation` whatever `returnSourceInformation` asks, except for a section no
parser knows. legend-lite does the same.

The lambda route, `grammar/grammarToJson/lambda`, is unchanged. The engine parses a lambda inside a text of its own, so
its end of input is a line below the lambda's.
