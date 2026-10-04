# THC Encyclopedia 420+ Extension Workflow

The encyclopedia has two layers:

- **Protected core:** THC-ENC-001 through THC-ENC-420. These IDs, numbers, and Parts 1–21 remain stable.
- **Extension layer:** THC-ENC-421 and above. New lessons are appended without renumbering the protected core.

## Add new material

1. Add the next contiguous entry to `content/encyclopedia/extension-registry.json`.
2. Use the next permanent ID and number: THC-ENC-421, THC-ENC-422, and so on.
3. Put extension material in Part/Volume 22 or higher. Do not place extension lessons inside protected Parts 1–21.
4. Create the canonical lesson file under `content/encyclopedia/volume-XX/lessons/thc-enc-NNN.json`.
5. Add or update that volume's `manifest.json`. The catalog builder discovers volume directories automatically.
6. Add the extension part to `configuration/encyclopedia-topics.json`. This is required so search facets and WordPress subject hubs use the same taxonomy.
7. Add grower-language aliases to `configuration/encyclopedia-search-language.json` when useful.
8. Run the normal encyclopedia builders and validators.

## Search behavior

Every registered lesson is included in the encyclopedia discovery index. Published lessons expose their full searchable fields. Registered lessons awaiting publication remain searchable by safe catalog metadata without exposing unreleased body content.

The global THC education search then consumes the encyclopedia discovery index automatically, so new encyclopedia entries do not require a second hand-maintained search list.

## Required extension entry fields

```json
{
  "id": "THC-ENC-421",
  "number": 421,
  "part": 22,
  "title": "Example New Topic",
  "primaryFormat": "Science lesson",
  "teachingVisual": "Concept diagram"
}
```

Part 22 must also be defined in `configuration/encyclopedia-topics.json` with a non-overlapping contiguous range, title, slug, and description.

## Invariants

- Core IDs 001–420 are never recycled or renumbered.
- Extension IDs are contiguous and append-only.
- Search indexes are generated from registries and canonical lesson files, never maintained manually.
- Publication authorization remains separate from registration and search discovery.
- New lessons are subject to the same assessment, evidence, source, visual, cross-link, and substantive-quality gates as the core.
