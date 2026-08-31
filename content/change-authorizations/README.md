# Content change authorizations

Canonical content is append-only by default. New records may be added normally. Existing protected records may not be modified, deleted, or renamed unless the same pull request adds a new authorization record in this directory.

Authorization records are themselves append-only audit history: once committed, they must never be edited, renamed, or deleted.

## Required format

```json
{
  "schemaVersion": 1,
  "id": "AUTH-YYYYMMDD-short-description",
  "authorizedBy": "project-owner",
  "instructionRef": "User explicitly requested correction/revision of THC-ENC-123",
  "reason": "Explain why changing the existing record is necessary.",
  "changes": [
    {
      "path": "content/encyclopedia/volume-7/lessons/thc-enc-123.json",
      "action": "modify",
      "previousSha256": "64 lowercase hex characters",
      "newSha256": "64 lowercase hex characters",
      "reason": "Explain this exact record change."
    }
  ]
}
```

Supported actions are:

- `modify`: requires `path`, `previousSha256`, `newSha256`, and `reason`.
- `delete`: requires `path`, `previousSha256`, and `reason`.
- `rename`: requires `path`, `newPath`, `previousSha256`, `newSha256`, and `reason`.

The validator accepts an override only when the hashes match the exact old and new bytes in the pull request. An older authorization cannot be reused for a later change.

## Default behavior

If no explicit authorization is present:

- adding a new canonical lesson is allowed;
- editing an existing canonical lesson is blocked;
- deleting an existing canonical lesson is blocked;
- renaming an existing canonical lesson is blocked;
- reusing an existing lesson ID or lesson number is blocked.

This keeps previous work intact while allowing the content library to grow indefinitely.
