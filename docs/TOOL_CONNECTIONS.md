# Tool Connection Map

This document records current integrations and useful connection points. It does not lock source ownership, backend choice, repository placement, deployment method, or development tooling.

## Current connections

| System | Current state |
| --- | --- |
| GitHub | `dtfgenetics/Thc` is the current integration repository |
| Production branch | `main` |
| High Land app | currently under `apps/high-land-web` |
| High Land multiplayer | currently uses the Hostinger PHP Website Room API |
| CI | GitHub Actions |
| Site deployment | Hostinger / WordPress / `dtfseeds.com` |
| Google Drive | current human asset/archive source |

All of these implementation choices may be changed when the project goal requires it. When a tool, repository, backend, or deployment path changes, update this document and the relevant registry/deployment metadata.

## Credentials and private data

Private values must remain outside public browser code and committed source. Use the secret-management mechanism appropriate to the chosen platform for SSH keys, API keys, database credentials, bot tokens, and other private automation values.

## Development tooling

Use the strongest practical tools for the task. Browser automation, static checks, unit tests, integration tests, screenshots, visual regression, performance profiling, local servers, cloud build systems, and alternative engines are all allowed.

## Multiplayer

The current Hostinger room API is one available implementation, not a permanent backend requirement. It may be retained, migrated, replaced, or removed. Any replacement should still protect authentication, authorization, private room state, and credentials.

## Deployment

Current production behavior should be verified against the exact visitor-facing route after deployment. Build commands, artifact directories, hosting providers, and route structures may change with the implementation.
