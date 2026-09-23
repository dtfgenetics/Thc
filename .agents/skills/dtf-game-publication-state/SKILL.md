---
name: dtf-game-publication-state
description: Determine and verify the exact publication state of a DTF game: canonical source, packaged snapshot, deployable artifact, reserved route, public navigation, deployed route, and verified live visitor behavior.
metadata:
  author: dtfgenetics
  version: "1.0.0"
---

# DTF Game Publication State

Never collapse these into one state:

1. source exists;
2. canonical source validated;
3. package/snapshot exists;
4. deployment metadata exists;
5. route is reserved/candidate;
6. navigation marks public;
7. route has been deployed;
8. exact visitor route is live and verified.

Read `data/game-location-registry.json` publication and packageSnapshot fields plus deployment/public-navigation registries.

A packaged route is not proof of public promotion.
A public navigation entry is not proof of current deployed bytes.
A merged commit is not proof of live production.

## Report exact state

Use precise language such as:
- canonical source ready;
- packaged but nonpublic;
- deployment registered;
- candidate route reserved;
- public navigation promoted;
- deployed but live verification pending;
- exact public route verified.

Update publication metadata whenever route ownership or public promotion changes.
