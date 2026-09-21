# DTFSeeds Visual Structure Work Order

Generated for the next website visual/structure pass.

## Goal

Make dtfseeds.com easier to understand in the first 10 seconds, more visually consistent across pages, and easier to audit before each publish.

## Current public structure to preserve

Primary routes stay organized around:

1. Genetics
2. Teaching Healthy Cultivation / Learn
3. Tools / Diagnostics
4. Games
5. Community
6. Shop

The public homepage should continue to prioritize genetics, education, tools, games, and community in that order.

## Visual structure standards

Every core route should have:

- One clear H1.
- One hero section with the page's job explained in plain language.
- Two to three primary CTAs above the first major scroll.
- A visible second section that answers what the visitor should do next.
- Card-based scanning for collections, tools, games, subjects, and releases.
- Large raster visuals with useful alt text.
- Lazy-loaded images below the hero.
- No placeholder language, fake contacts, draft labels, or owner-facing staging copy.

## Page-specific fixes

### Home

- Strengthen the first viewport around three visitor paths: genetics, learn, tools.
- Keep games and community visible, but secondary to the main site jobs.
- Add a compact event/community strip for active campaigns such as From Freebie to Fire when there is a live event.
- Make the homepage feel less like a text sitemap and more like a guided front door.

### Seeds

- Make the current releases visually obvious before deeper breeding context.
- Use consistent strain-card crops and generation badges.
- Keep lineage, generation, seed type, and release route readable without opening every card.

### Learn

- Keep the learning path visible before deep encyclopedia content.
- Separate beginner paths, subject library, academy courses, visual library, and diagnostics.
- Add more photographic or chart-based raster visuals where current sections feel text-heavy.

### Tools / Diagnostic

- Put the tool action first: upload photo, start Grow Doc, open GrowLens.
- Keep optional information clearly optional.
- Show the evidence workflow visually: observe, measure, compare, track.

### Games

- Separate playable now, prototype, needs fix, and coming soon.
- Each game card should show status, short goal, device support, and launch CTA.
- Avoid burying game links under long explanations.

### Community

- Add clear active event cards.
- Add Discord CTA and event rules one click away.
- Add grow-off assets, update templates, and certificates as downloadable/support graphics when ready.

## Audit gates before deploy

Run these checks before pushing a public visual update:

1. Live route audit: `node scripts/audit-dtfseeds-live.mjs`
2. Visual structure audit: `node scripts/audit-dtfseeds-visual-structure.mjs`
3. Public route/navigation validation already present in the workspace.
4. Manual mobile scan of home, learn, seeds, tools, games, and community.

## Acceptance criteria

A visual pass is done only when:

- Core routes pass live content checks.
- Core routes pass visual structure checks.
- No route relies on draft/staging placeholder language.
- Mobile first viewport is readable without pinching or hunting.
- Main CTAs are visible and unambiguous.
- Images support the page purpose instead of acting as filler.
