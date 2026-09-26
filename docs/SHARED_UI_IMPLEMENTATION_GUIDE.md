# DTF / THC Shared UI Implementation Guide

This guide implements `docs/PRODUCTION_STANDARDS.md`. It is the default construction pattern for new production-facing work.

## Shared layout tokens

Use the existing shared tokens before inventing page-local values:

- `--dtf-layout-max` — primary content maximum
- `--dtf-reading-max` — readable prose width
- `--dtf-layout-gutter` — responsive side gutter
- `--dtf-layout-section` — section rhythm
- `--dtf-layout-gap` — common grid gap
- `--dtf-layout-touch` — minimum interactive target
- `--dtf-global-header-height` — sticky-offset contract

Do not hard-code alternate global container widths or touch targets unless a documented component requires them.

## Breakpoint contract

The shared system currently defines four practical states:

- Wide desktop: above 1120px
- Tablet / compact desktop: 701–1120px
- Mobile: 421–700px
- Narrow mobile: 420px and below

Do not design only at desktop and one phone width. A production component must remain usable in all four states.

## Page container

Prefer an existing product wrapper:

- `.dtf-page .dtf-wrap`
- `.v3 .wrap`
- `.game-hub-page .wrap`
- Tools shell `.wrap`
- Course shell `.lhv3-wrap`

New surfaces should align to the same gutter/max-width system.

## Section hierarchy

Default section anatomy:

1. Eyebrow / context only when useful
2. H1 or H2
3. Short explanatory copy
4. Primary content / interaction
5. Supporting detail
6. Related action or next step

Avoid stacking multiple title blocks that communicate the same thing.

## Content width

Long-form prose should not span the entire layout. Keep reading copy near the shared reading width and let diagrams, tables, tools, galleries, and comparisons use wider space only when they benefit from it.

## Cards

A card must represent a meaningful grouped object or action.

Do not turn every paragraph, heading, or navigation item into a card.

Preferred uses:
- course / lesson summaries
- tool launchers
- comparable records
- diagnostic results
- game entries
- genetics records

Avoid nested cards unless the nested element is a genuinely separate interactive object.

## Actions

Primary actions:
- remain obvious
- meet the shared minimum target size
- become comfortably full-width on mobile when appropriate
- use clear verbs

Do not expose dead buttons or fake controls.

## Tool pages

Use this order:

1. Purpose / what the tool measures
2. Input or interactive control
3. Result
4. Interpretation
5. Why the result matters
6. Limits / assumptions / safety where needed
7. Related education
8. Related tools

A tool result without interpretation is incomplete.

## Course pages

Use the course shell rather than inventing a new lesson layout.

The main lesson should remain the reading focus. Course outline and lesson context may become side rails on wide screens but must collapse cleanly on mobile without trapping content in narrow columns.

## Images

Instructional imagery should have an explicit job.

For production images:
- include width/height when practical
- preserve meaningful crops
- provide useful alt text
- use captions/source notes when required
- avoid layout shift
- prefer optimized raster delivery
- do not reuse rejected low-quality educational infographic styles

Decorative imagery must not displace instructional content.

## Tables and dense data

Tables must remain readable without breaking the page.

On narrow screens:
- use an intentional horizontal scroll container, or
- transform the information into another accessible representation

Never solve overflow by globally hiding the page overflow while leaving clipped content unreachable.

## Progressive disclosure

Use disclosure for secondary detail, not critical controls.

Good candidates:
- deeper scientific explanation
- reference material
- long source lists
- advanced configuration
- supporting definitions

Required actions, safety information, results, and primary lesson content must remain easy to discover.

## Accessibility defaults

Every new interactive component must account for:
- keyboard access
- visible focus
- semantic element choice
- programmatic labels
- expanded/collapsed state
- error messaging
- useful alt text
- reduced motion when animation is nonessential

Do not replace native controls with generic divs unless there is a strong reason and equivalent semantics are restored.

## Global navigation

Canonical primary navigation:

1. Home
2. Seeds
3. Learn
4. Courses
5. Tools
6. Games
7. Community
8. Shop

`/tools/` is the Tools hub. Diagnostics is one capability within the Tools ecosystem, not the label for the whole hub.

Do not create route-local copies with different labels.

## Empty, loading, and error states

A production interaction must define what users see when:
- data is loading
- there is no data
- input is invalid
- a request fails
- the feature is unavailable

Do not use a blank container as an error state.

## Shared QA before release

At minimum run the checks relevant to the changed surface, including:

```bash
npm run verify:production-standards
npm run verify:shared-ui-standard
npm run verify:navigation
npm run verify:release-integrity
```

Then run the feature-specific deterministic test/build path.

Routine QA must not depend on Playwright.

## Anti-patterns

Do not:
- create a new site header for one page
- create a new navigation vocabulary for one app
- use arbitrary container widths across pages
- hide overflow to mask broken responsive layouts
- shrink desktop controls until they barely fit mobile
- publish placeholder sections to make a page look fuller
- add decorative images where instructional imagery is required
- duplicate existing shared components without a documented reason
- treat a locally rendering page as definition of done

## Change strategy

When a defect appears on multiple pages, fix the shared source first.

Preferred order:

1. Shared shell
2. Shared token / component
3. Generator or canonical source
4. Validation
5. Generated/public artifacts
6. Live verification

This prevents repeated repair work and keeps production surfaces converged.
