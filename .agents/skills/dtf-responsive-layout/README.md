# DTF Responsive Layout Skill

Use `SKILL.md` whenever a task changes visitor-facing layout, CSS, navigation, viewport behavior, mobile/tablet presentation, grids, overflow, sticky UI, dialogs, course layouts, tools, or game shells.

The durable responsive standard is documented in:

- `docs/RESPONSIVE_LAYOUT_STANDARD.md`

Run the deterministic guardrail after responsive work:

```bash
npm run verify:responsive
```

This skill exists to prevent conflicting breakpoint rules, page-level overflow, squeezed desktop layouts on tablets, unusable phone controls, and late-loaded CSS overrides from silently reversing shared responsive behavior.

Rendered QA is still required. The verifier protects the contract; it does not replace checking real layouts at the documented viewport matrix.
