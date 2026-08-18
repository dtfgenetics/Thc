# THC WordPress article publishing

This repository can publish Teaching Healthy Cultivation articles to the existing WordPress site at `https://dtfseeds.com` through the WordPress REST API.

## What is already implemented

- Article source files live in `site/wordpress/articles/*.json`.
- `scripts/publish-wordpress-articles-rest.mjs` validates each package before any network request.
- Publishing is idempotent by WordPress post slug:
  - if the slug does not exist, the publisher creates the post;
  - if the slug already exists, the publisher updates that post instead of creating a duplicate.
- Categories and tags are resolved by exact name and created if missing.
- Existing post JSON is saved before an update.
- Deployment results and rollback metadata are retained as a private GitHub Actions artifact.
- THC article packages require the canonical Discord CTA `https://discord.gg/xJbUeHFPMt` unless explicitly opted out.

## Required WordPress credentials

Create a dedicated WordPress publishing user with permission to create and publish posts and taxonomy terms. Do not use the primary administrator password.

In WordPress, generate an **Application Password** for that publishing user.

Store the credentials as GitHub **Environment secrets** in the `production` environment of `dtfgenetics/Thc`:

- `WP_API_USERNAME` — WordPress username for the dedicated publisher account.
- `WP_API_PASSWORD` — WordPress Application Password generated for that account.

The workflow also recognizes the existing aliases `WORDPRESS_USERNAME`, `WP_USERNAME`, `WORDPRESS_APP_PASSWORD`, and `WP_APPLICATION_PASSWORD`, but the two `WP_API_*` names are preferred.

Never commit these values to the repository, article JSON, workflow files, issues, or documentation.

## First publication

Publication #1 is already staged at:

`site/wordpress/articles/yellow-leaves.json`

It is configured with `status: publish`.

After the production secrets are present:

1. Open GitHub Actions for `dtfgenetics/Thc`.
2. Select **Publish THC WordPress Articles**.
3. Choose **Run workflow**.
4. Enter `yellow-leaves` to publish only Publication #1, or `all` to publish every article package.
5. The workflow validates first, authenticates to WordPress, creates or updates the post, and records the returned public WordPress link in the job log.

## Automatic publishing

Pushes to `main` always validate article packages. Live publishing from a push is intentionally disabled by default.

To enable controlled automatic publication later, add a repository/environment variable:

`WORDPRESS_ARTICLE_AUTO_PUBLISH=true`

When enabled, a qualifying article change on `main` will run the live deploy job after validation. Until then, production publishing requires an explicit manual workflow run.

## Article format

Each article JSON contains:

- `title`
- `slug`
- `excerpt`
- `status`
- `categories`
- `tags`
- `references`
- `content` as WordPress-safe HTML
- optional `require_discord_cta`

The source contract is documented in `site/wordpress/articles/article.schema.json`.

## Safety boundaries

The THC article publisher only calls WordPress endpoints for:

- the authenticated current user (`users/me`) for connection verification;
- posts;
- categories;
- tags.

It does not change WordPress users, plugins, themes, site settings, products, orders, or media.

The existing public-page deployment workflow remains separate and continues to manage the fixed public pages under `site/wordpress/pages/`.
