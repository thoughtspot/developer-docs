# Review markup — user-api v2 change

**This branch (`user-api-review-markup`) must not be merged.** It exists only so
reviewers can see, in the rendered docs preview, which blocks changed as part of
the REST API v1 -> v2 user-api update.

Content on this branch is identical to `user-api`; the only additions are
`reviewChanged` roles and the stylesheet rule that draws them.

## What it looks like

Edited blocks get a purple bar in the left margin and a faint purple tint.
Changed section headings also get a small `CHANGED` badge. Works in light and
dark themes.

## What is highlighted

Blocks added since `773dbd06` (the last commit before this effort):

| File | Marked blocks |
|---|---|
| `modules/ROOT/pages/user-api.adoc` | 20 — the page deprecation banner + all 19 per-endpoint DEPRECATED notes |
| `modules/ROOT/pages/api-user-management.adoc` | 15 — new/rewritten sections, 2 admonitions, the restored v2 endpoint table |
| `modules/ROOT/pages/partials/user-api-list.adoc` | 1 — the deprecation banner above the table |

## What is NOT highlighted

Three kinds of edit cannot carry a block-level marker:

1. **The new "REST API v2 replacement" column** in `user-api-list.adoc`. A role
   applies to a whole table, not one column. The banner above it is marked
   instead; the column itself is self-evidently new.
2. **`roles-api.adoc` and `roles.adoc`** (4 lines). These are an anchor rename,
   `#_role_privileges` -> `#_role_categories_and_privileges`, inside existing
   xrefs. Nothing about the rendered page changes, so there is nothing to show.
3. **Prose reworded in place** inside otherwise-unchanged blocks — the marker is
   per block, so a block is either flagged or not.

For line-exact review, use the diff: `git diff 773dbd06..user-api -- '*.adoc'`

## Removing it

Preferred: delete the branch. Nothing here belongs in `user-api`.

    git branch -D user-api-review-markup

If you instead want to keep some of this branch, strip the markup first:

    ./scripts/strip-review-markup.sh
