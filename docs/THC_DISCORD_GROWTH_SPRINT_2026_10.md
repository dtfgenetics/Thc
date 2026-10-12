# THC Discord growth sprint — operational foundation

**Started:** 2026-10-11 · **Owner:** THC community admins · **Scope:** adult education / community only. No sales, trades, sourcing, or unsolicited messages.

## Preflight: existing implementation, not greenfield

- Source-managed community page: `site/wordpress/pages/community.html`; currently contains THC-first Discord CTAs, GrowLens, Grow Doc, games, and learning paths.
- Official invite documented in `README.md`, `docs/THC_DISCORD_FREE_DISTRIBUTION.md`, and `docs/THC_SOCIAL_CONTENT_FUNNEL.md`: `https://discord.gg/ZzYTUWKKW` (**documented; reconfirm in Discord UI before promotions**).
- **Invite conflict to resolve:** `scripts/build-public-learning-center.mjs` references `https://discord.gg/xJbUeHFPMt`. Verify both in Discord admin, identify ownership/expiry, then consolidate canonical source; do not replace blindly.
- `docs/THC_SOCIAL_CONTENT_FUNNEL.md` reports a previously prepared Facebook queue; **pending is not published**. Inspect current Metricool state before adding posts.
- This repository alone cannot establish Discord channel/role permissions, member count, active user counts, invite uses, or actual join conversions.

## Week 1 administrator audit sheet

| Area | Verification to collect | Acceptance |
| --- | --- | --- |
| Server identity | screenshot of server settings / invite destination | Name and destination match THC — Teaching Healthy Cultivation |
| Channels | channel list, purpose, latest meaningful activity (30 days) | Every public channel has a purpose, owner, and active destination |
| Roles | role names, privilege hierarchy, admin/mod counts | Least-privilege bot/mod roles; no unnecessary elevated permissions |
| Rules | rules and safety/reporting flow | Adults-only focus, laws, respectful science debate, no sales/trades, no unsolicited DMs |
| Onboarding | new-member path from invitation through first post | Rules acknowledged; obvious introduction and first helpful action |
| Invites | name, campaign, Discord-created code, expiry, uses, last verified | Distinct links per campaign, checked with an authorized admin |
| Baseline | timestamp, total members, joins/leaves, 7-day active posters, event participation | One dated snapshot with no invented values |

**Recommended channels (only after audit):** `#start-here`, `#rules`, `#introductions`, `#plant-science`, `#grow-observations`, `#events`, `#resources`, `#feedback`, and a private mod channel. Do not auto-create duplicate channels.

## Campaign tracking contract

Use website-origin tracking URLs pointing to **our own** community page, e.g.:

- `https://dtfseeds.com/community/?utm_source=encyclopedia&utm_medium=internal&utm_campaign=thc_2026_10&utm_content=lesson_cta_a`
- `https://dtfseeds.com/community/?utm_source=tools&utm_medium=internal&utm_campaign=thc_2026_10&utm_content=tool_cta_a`
- `https://dtfseeds.com/community/?utm_source=instagram&utm_medium=social&utm_campaign=thc_2026_10&utm_content=science_short_01`

Do **not** add query parameters to a `discord.gg` invite and claim campaign attribution. Site analytics measure visits and CTA clicks; actual joins need unique Discord-created invite codes or authorized server records. Obtain consent and minimize personal data; no user-identifying tracking in public datasets. Use an explicit page-event name `thc_discord_cta_click`, with allowed source, placement, experiment variant and date only. Verify tracking instrumentation before making any conversion claim.

**Daily baseline CSV header:**
```csv
date,source,landing_sessions,cta_clicks,discord_invite_uses,joins,leaves,total_members,active_posters_7d,first_posts_7d,event_attendees,notes
```
Keep blank cells for unavailable counts (never substitute zero). Define `active_posters_7d` as unique humans posting in public educational channels during preceding seven days, excluding bots. Define 7-day retained joiners as joiners from the cohort still in server at day 7, and 7-day activated joiners as those who made a meaningful first post by day 7. Do not equate visits, invite uses, and unique joins.

**KPIs:** click-through = CTA clicks / landing sessions; tracked join conversion = verified joins / attributable invite uses (report attribution gaps); net growth = joins − leaves; cohort retention = retained / joiners eligible for 7-day follow-up; activation = new joiners posting within 7 days / eligible new joiners. Always report denominators and measurement windows.

## Ready-to-use onboarding copy

**Welcome (to post after rules are configured):**

> Welcome to THC — Teaching Healthy Cultivation! 🌱 This is an adults-only, education-first space for plant science, observations, cultivation measurements, genetics, and evidence-based questions. Start with #rules, then introduce yourself in #introductions: what topic are you learning, and what would you like to understand better? No buying, selling, trading, sourcing, unsolicited DMs, or medical advice. Protect your privacy and follow applicable laws.

**First action prompt:**

> This week's discussion: When a leaf changes color, what three measurements or observations would you record before proposing a cause? Share your reasoning, not just a diagnosis. You can use the learning center for reference: https://dtfseeds.com/learn/.

## Repeatable community calendar (proposed; times unconfirmed)

| Day | Activity | First-week preparation |
| --- | --- | --- |
| Monday | Measurement Monday: VPD / lighting / water-quality Q&A | Publish one sourced question |
| Tuesday | Tool Tuesday: GrowLens or Grow Doc walkthrough | Provide one example and feedback form |
| Wednesday | Plant-Science Wednesday: anatomy or physiology | One diagram and a source citation |
| Thursday | Observation challenge check-in | Ask for context, not product links |
| Friday | Myth vs Evidence | Moderator-reviewed claim and reference |
| Saturday | Community projects / feedback | Surface helpful member contributions |
| Sunday | THC Science Sunday, 30–45 min | Schedule only after moderator confirms time, host, and channel |

## Four-week gate

- **Week 1 / Oct 11–17:** Audit server (admin), verify invite codes, implement baseline sheet, approve onboarding and Science Sunday time, audit website source and landing-page copy.
- **Week 2 / Oct 18–24:** Deploy contextual CTAs after tests and review; publish seven verified short lessons (not necessarily seven videos without actual rendered media); hold first confirmed Science Sunday; launch measurement challenge; send 10 respectful, individually researched partner invitations.
- **Week 3 / Oct 25–31:** Compare campaign data, test two page CTA variants with consistent attribution, ship second educational batch; collaborate only if a partner agrees.
- **Week 4 / Nov 1–7:** Audit joins, retention and activation; retire channels only after moderation review; choose highest-converting source using joins rather than clicks; prepare a 30-day calendar and scale compliant sources.

## Landing-page product specification

**Existing route:** `/community/` (enhance, do not duplicate). Page hierarchy: THC education-first headline → concrete benefits (plant science, evidence-based Q&A, study sessions) → primary invite CTA → three-step arrival guide (rules, introduction, first discussion) → upcoming **confirmed** event → links to encyclopedia, GrowLens, Grow Doc → plain rules/privacy/safety note. Keep DTF Genetics as related parent brand, THC as community identity. Never show fabricated social-proof counts or event times.

**Quality checks:** visible CTA and keyboard focus on 360px mobile and desktop; responsive spacing; accessible labels; page text accurate for THC; valid external link `target="_blank" rel="noopener noreferrer"`; internal links resolve; no analytics fires without appropriate consent; no production release claim before a deployed page and actual browser verification.

## Current verification status (2026-10-11)

- Repository documentation and page source inspected: **yes**.
- Actual Discord server channels, roles, invite health and analytics: **not verified** (requires authorized Discord access).
- Website production rendering and campaign event instrumentation: **not verified**.
- Live events, video publication, educator outreach: **not done**.
- Existing social queue is documented, but **not independently rechecked in this audit**.

**Next engineering action:** reconcile conflicting invite strings; review any active community page PRs and deployment pipeline; implement a minimal testable tracking-link change on `/community/` and high-traffic education pages without disrupting canonical WordPress reconciliation.
