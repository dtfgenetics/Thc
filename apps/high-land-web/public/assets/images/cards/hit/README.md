# High Land HIT Card Artwork

The game expects approved HIT card images in this folder using exact file names:

```txt
card-001.png
card-002.png
card-003.png
...
card-030.png
```

These paths are referenced by `src/game/data/actionCards.ts` as:

```txt
assets/images/cards/hit/<card-id>.png
```

Do not remove or rename these images without updating the card deck mapping. The HIT popup should show the approved image artwork first, then the card title, text, effect description, and Continue button.
