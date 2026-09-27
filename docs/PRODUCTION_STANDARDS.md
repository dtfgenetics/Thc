# DTF / THC Production Standard

Status: **Mandatory for production-facing work**

Applies to: dtfseeds.com, THC education, tools, atlases, diagnostics, games, genetics surfaces, shared navigation, responsive layouts, public-route artifacts, and future production apps.

## 1. Product-wide quality bar

Production work must feel like one connected product, not independent pages or experiments. Shared navigation, spacing, typography, interaction patterns, responsive behavior, accessibility, loading behavior, image treatment, and error states must remain consistent across surfaces.

Incomplete, placeholder, fake, or nonfunctional UI must not be exposed in primary public navigation.

## 2. Required page hierarchy

Every production page must have a clear information hierarchy:

1. Page title and concise purpose
2. Primary action or core content
3. Supporting explanation or education
4. Related references, tools, or next steps
5. Consistent global navigation and footer

Avoid competing hero blocks, repeated page titles, excessive card grids, and walls of text.

## 3. Responsive standard

Mobile is a first-class layout, not a shrunken desktop page.

Required:
- No unintended horizontal scrolling
- Touch targets remain usable
- Tables/charts/tools adapt without clipping
- Navigation remains understandable on mobile/tablet/desktop
- Long content uses progressive disclosure when appropriate
- Interactive controls remain operable at common breakpoints
- Images preserve intended focal points and captions

Any shared component introduced into production must be checked at representative narrow, medium, and wide widths.

## 4. Navigation and information architecture

The major user paths must remain obvious:

- Learn -> Courses -> Certification
- Tools -> Cultivation Tools
- Plant Science -> Atlas / Encyclopedia
- Genetics / Seeds
- Games
- Community

Required conventions:
- Consistent header behavior across routes
- Breadcrumbs or equivalent location context on deep pages
- Related-content navigation
- Clear next-step actions
- No dead, duplicate, hidden, or contradictory route ownership

## 5. Tools UX standard

Every cultivation tool should follow the same user journey:

**Learn -> Input / interact -> Result -> Interpretation -> Why it matters -> Next action**

Tool controls should share common field labeling, units, reset behavior, help affordances, warnings, result cards, educational explanations, and related-tool links.

Tools must live on dedicated routes when their interaction or educational depth exceeds a simple inline calculator.

## 6. Course standard

Every complete lesson should contain, where applicable:

- Learning objectives
- Prerequisite knowledge
- Core instruction
- Scientific explanation of cause/effect
- High-quality visual support
- Applied example or demonstration
- Knowledge check
- Summary
- References / evidence
- Next lesson or related tool

Public course pages must not rely on placeholder lessons, thin article-style copy, or repeated titles.

## 7. Educational content standard

Teach both **what** to do and **why** it works.

Content should connect cultivation practice to plant physiology, chemistry, root-zone behavior, photosynthesis, transpiration, stomatal behavior, environmental response, nutrient movement, and other relevant mechanisms.

Important claims should distinguish:
- Established evidence
- Strong horticultural practice
- Preliminary findings
- Anecdotal or breeder/grower observations

## 8. Educational visual standard

Visuals must teach, not merely decorate.

Preferred:
- Annotated plant photography
- Comparison images
- Stage progressions
- Cutaways
- Diagnostic progressions
- Root morphology
- Trichome development
- Lighting / PPFD maps
- Environmental diagrams
- Nutrient availability references
- Pest / pathogen identification
- Equipment examples

Do not reintroduce previously rejected low-quality infographic styles.

Production instructional assets should be high-resolution raster assets such as PNG, WebP, or JPEG unless a specific technical requirement justifies another format.

## 9. Media consistency

Every production image should have:
- Predictable aspect ratio for its component type
- Stable dimensions to reduce layout shift
- Descriptive filename
- Appropriate optimized format
- Alt text when meaningful
- Caption/source/attribution when needed
- Valid repository or managed-media path

Broken-image prevention is a release requirement.

## 10. Certification and assessment standard

Certification tests must behave like real assessments.

Required:
- Student selects answers independently
- Answers persist during the attempt
- Submission locks the attempt
- Automatic grading occurs after submission
- Time limit is enforced where required
- Attempt records retain user/test/reference identity
- Passing threshold is explicit
- Certificates are generated only after successful completion

Question banks should support randomized pools, appropriate difficulty, scenario/application questions, attempt rules, and post-completion explanations where appropriate.

## 11. User progress

Education surfaces should make progress visible:
- Current course
- Lessons completed
- Completion percentage
- Quizzes passed
- Certifications earned
- Resume / continue state

## 12. Search and discovery

As content grows, search must span appropriate content types such as:
- Courses
- Encyclopedia
- Glossary
- Plant Atlas
- Terpene Atlas
- Tools
- SOPs
- Troubleshooting

Search results should be categorized rather than presented as an undifferentiated list.

## 13. Cross-linking standard

Connected content should be intentionally connected.

Examples:
- VPD lesson -> VPD tool
- Lighting lesson -> PPFD tool
- Terpene lesson -> Terpene Atlas
- Nutrient lockout content -> pH / EC tools
- Diagnostic result -> relevant encyclopedia and lesson content

Users should not have to rediscover related features manually.

## 14. Diagnostic UX standard

A usable plant photo must remain sufficient to begin analysis.

Optional grow context may improve confidence but must not block analysis.

Results should clearly separate:
- Visual observations
- Differential possibilities
- Likely interpretation
- Confidence / limitations
- Corrective actions
- Relevant references and follow-up education

## 15. Progressive disclosure

Dense information should use the right interaction pattern:
- Tabs
- Accordions
- Expandable reference panels
- Dedicated detail pages
- Comparisons
- Contextual modals

Do not hide critical primary actions, but do not force every detail into the first viewport.

## 16. Accessibility

Production work must include:
- Semantic heading order
- Keyboard-operable controls
- Visible focus states
- Sufficient contrast
- Proper form labels
- Meaningful alt text
- Screen-reader-compatible controls
- Readable text sizing
- Reduced-motion considerations for nonessential animation

## 17. Performance

Visual quality must not create avoidable performance regressions.

Use:
- Responsive image sizing
- Lazy loading where appropriate
- Optimized raster formats
- Stable dimensions
- Route-level loading where useful
- Caching
- Code splitting
- Controlled font use

Avoid unnecessarily shipping heavy assets or scripts to unrelated routes.

## 18. Terminology and units

Normalize terms and units across the product.

Examples:
- EC / PPM labeling
- µmol·m⁻²·s⁻¹ for PPFD
- DLI
- RH
- VPD
- Photoperiod notation
- Substrate terminology
- Nutrient element notation

Definitions should not change from tool to tool or lesson to lesson.

## 19. Design-system requirement

Shared production components should use common:
- Typography scale
- Spacing rhythm
- Content widths
- Cards
- Buttons
- Tabs
- Accordions
- Forms
- Warning / success states
- Educational callouts
- Data visualization rules
- Image ratios
- Header / footer behavior

One-off page-specific styling should be the exception.

## 20. Empty and unfinished states

Do not expose:
- Placeholder copy
- Fake interactions
- Dead buttons
- Empty cards
- Broken assets
- Unfinished routes
- “Coming soon” clutter in primary navigation

Incomplete work should be hidden from production navigation until it reaches the minimum production standard.

## 21. Required deterministic QA

Routine QA must remain deterministic and repository-based.

Do not add Playwright to the standard validation path.

Production verification should include, where applicable:
- Build
- Type checking
- Linting
- Internal-route validation
- Broken-link checks
- Asset/path validation
- Missing-image detection
- Public-route registry validation
- Responsive-structure checks
- Content integrity checks
- Release artifact parity
- Component/unit tests
- Game-specific deterministic tests

## 22. Definition of done

A production-facing change is not complete merely because it renders.

It is complete only when:
- Content is final enough for public use
- Layout works across supported widths
- Navigation is correct
- Assets resolve
- Accessibility basics are present
- Relevant deterministic checks pass
- Related content is connected
- No placeholders or broken states remain
- Release ownership is known
- Production route behavior is verified

## 23. Priority order for systemic fixes

When multiple defects exist, prefer fixing shared systems before isolated symptoms:

1. Site shell and responsive system
2. Navigation / information architecture
3. Design system
4. Tools hub and tool conventions
5. Course template
6. Educational imagery
7. Certification system
8. Atlas systems
9. Cross-linking and search
10. Performance and QA hardening

The goal is to fix a class of problems once rather than repair the same failure page by page.
