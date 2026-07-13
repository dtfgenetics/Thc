# DTF Seeds Overview

This project owns the review and rebuild of `dtfseeds.com` as the DTF Genetics
home for genetics, Teaching Healthy Cultivation, community, commerce, and the
browser game hub.

## Current architecture finding

The public root is served by custom static HTML/CSS while WordPress and
WooCommerce remain active under the same domain. WordPress still supplies media,
REST endpoints, plugins, robots rules, and the XML sitemap. This split means
WordPress/Elementor changes do not necessarily change the visible pages, and the
SEO sitemap can disagree with the public static site.

## Required architecture

- WordPress/WooCommerce owns editorial pages, genetics records, education,
  community, store functions, metadata, sitemap, and policies.
- Static game applications remain isolated under `/games/<game>/` and are built
  from GitHub.
- Google Drive is the source for approved original art and print masters.
- GitHub is the source for code and optimized web copies.
- Staging, tests, review, backup, and rollback precede every production change.

## Immediate priorities

1. Import the missing public root-site source into a GitHub-managed application
   or WordPress child theme.
2. Correct the homepage hero word fragmentation and mixed image hierarchy.
3. Remove public development language such as “reserved,” “slot,” “foundation,”
   and “being rebuilt.”
4. Align WordPress sitemap, canonical URLs, navigation, and live routes.
5. Create structured genetics records with verified lineage, generation, sex,
   availability, observations, images, and review date.
6. Audit plugin versions and settings in staging; resolve caching, image,
   analytics, AI-builder, SEO, and form overlaps.
7. Deploy High Land from a tested GitHub artifact instead of manual loose files.

## Plugin boundary

Public WordPress namespaces indicate WooCommerce, Elementor, AIOSEO, Jetpack,
Jetpack Boost, LiteSpeed, Hostinger tools/AI/image optimization, MonsterInsights,
Mailchimp for WooCommerce, OptinMonster, and WordPress MCP-related components.
This is not enough evidence to update or remove plugins. An authenticated plugin
inventory, versions, Site Health report, WooCommerce status report, staging copy,
and verified backup are required first.

## Definition of done

- One system owns every URL and canonical page.
- The genetics catalog contains verified structured information and consistent
  product media.
- Education, community, store, and games have clear navigation and actions.
- Plugins have documented owners with no unnecessary functional overlap.
- CI, staging, backup, deployment, live checks, and rollback are repeatable.
- Responsive, accessibility, performance, security, SEO, and commerce tests pass.
