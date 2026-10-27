# DTF portfolio discovery — repository reconciliation

The account inventory includes 22 accessible, unarchived repositories as of the observation date. The listing is not proof that all projects are deployed or maintained.

Verified source-of-truth responsibilities:
- `Thc-learning-courses-` owns certification curriculum and assessment material, distinct from Encyclopedia reference content.
- `Video-photo-editing-and-communications-posting-` already has plugin, recipe, and media-production architecture, but its README describes some production steps as pending.
- `thc-grow-hub` manages educational publication content and explicit release gates.
- `Tools` owns focused cultivation tools per the machine-readable tool execution registry.
- `Thc-dataset` owns Grow Doc; `Thc` is production integration.
- `Dtf420` is future cutover and `dtf-thc-hub` legacy migration per DTF ownership documentation.

Other repos intentionally remain `requires-ownership-review`; the registry does **not** authorize moving, deleting, archiving, merging or changing their code.

Run `node scripts/validate-portfolio-repository-discovery.mjs` to verify that canonical tool owners remain represented and return a machine-readable follow-up list. This is a local static inventory, not a live API freshness check.
