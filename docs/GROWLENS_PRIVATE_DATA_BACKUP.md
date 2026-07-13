# GrowLens Private Data Backup and Restore Audit

## What this protects

GrowLens keeps account data outside `public_html`. A private-data snapshot includes the files required to reconstruct account continuity:

- User records and password hashes
- Email-to-user indexes
- Grow state and synchronization revisions
- Active and expired session records
- Private image metadata
- Private image bytes

These files are sensitive. A snapshot archive must be treated as production account data, even when it was created only for a restore drill.

## What is deliberately excluded

The snapshot command excludes transient files that should not be restored:

- Rate-limit counters under `rate/`
- `operations.lock`
- `registration.lock`
- Per-account `*.lock` files
- Temporary `*.tmp-*` files
- Health probe files

Excluding rate-limit counters prevents an old backup from restoring stale throttling state. Excluding locks prevents a restored copy from inheriting meaningless process coordination files.

## Consistent snapshot locking

Every public GrowLens PHP endpoint calls `growlens_begin_storage_access()` from `api/_operations.php` before reading or changing private storage.

Normal requests hold a shared filesystem lock for the lifetime of the request. The snapshot command takes an exclusive lock on the same `operations.lock` file. The exclusive lock begins only after active requests finish, and new requests wait while the private files are copied.

Requests wait up to 15 seconds. If a large backup keeps the exclusive lock longer, the API returns HTTP 503 with `Retry-After: 5` rather than reading a partial snapshot state.

Run backups during lower-traffic periods and monitor snapshot duration. A rapidly growing private-data directory should be moved to a database/object-storage architecture before filesystem copy pauses become operationally unacceptable.

## Snapshot format

The CLI snapshot command is:

```bash
php scripts/growlens-private-data-snapshot.php \
  --source=/absolute/private/growlens-data \
  --destination=/absolute/private/backup-work/snapshot \
  --commit=<git-commit> \
  --max-bytes=5368709120 \
  --lock-wait-seconds=120
```

The destination must not already exist. Source and destination must be absolute, separate, and outside `public_html` unless an explicit localhost test override is used.

The command writes `manifest.json` containing:

- Snapshot format and version
- Creation timestamp
- Git commit
- File count and total uncompressed bytes
- Deterministic entries digest
- Relative path, byte count, and SHA-256 checksum for every included file

Directories are written with mode `0700`; files and the manifest use mode `0600`.

## Restored-copy audit

The integrity auditor is:

```bash
php scripts/growlens-private-data-audit.php \
  --root=/absolute/private/extracted-copy \
  --strict-permissions=true \
  --output=/absolute/private/reports/restored-copy-audit.json
```

The auditor first verifies the exact file set, sizes, SHA-256 checksums, and manifest digest. It then validates the data relationships rather than treating a successful extraction as proof of a usable backup.

It checks:

- Required private directory layout
- No symbolic links, temporary files, lock files, or unexpected files
- Root, directory, and file permissions
- User ID and filename consistency
- Normalized valid email addresses without printing them
- Recognized password hash formats
- Unique email-index hashes
- Every user has one matching email index and one grow-data record
- No orphan email indexes or grow-data records
- Non-negative synchronization revisions
- Schema version 1 and all eight state collections
- Record-object shape, record limits, valid IDs, and duplicate IDs
- Cross-reference warnings for missing plants, cycles, or spaces
- Session filename, owner, CSRF token, timestamp, and expiry shape
- Private image owner directories
- Image ID, extension, MIME type, dimensions, byte count, and timestamps
- Matching metadata and image files
- Actual image MIME type, dimensions, and byte count
- No orphan image metadata or image bytes

The report contains counts, digests, warnings, and error codes. It does not include email addresses, password hashes, CSRF tokens, or session cookies.

## Protected Hostinger workflow

The manual workflow is `.github/workflows/growlens-private-data-backup.yml`.

It requires:

```txt
confirmation: BACKUP-AND-RESTORE-AUDIT
retention: 7
max_gigabytes: 5
```

It uses the protected `growlens-production` GitHub environment and these secrets:

| Secret | Purpose |
| --- | --- |
| `HOSTINGER_SSH_HOST` | Hostinger SSH hostname |
| `HOSTINGER_SSH_PORT` | Hostinger SSH port |
| `HOSTINGER_SSH_USER` | Dedicated SSH deployment/operations user |
| `HOSTINGER_SSH_PRIVATE_KEY` | Dedicated private key |
| `HOSTINGER_SSH_KNOWN_HOSTS` | Independently verified server host key |
| `HOSTINGER_GROWLENS_DATA_DIR` | Live GrowLens private-data directory outside `public_html` |
| `HOSTINGER_GROWLENS_DATA_BACKUP_DIR` | Separate private backup directory outside `public_html` and outside the live data directory |

The workflow:

1. Lints and smoke-tests the backup tools locally.
2. Validates SSH values and rejects unsafe or public paths.
3. Confirms PHP 8.1+, `fileinfo`, `tar`, and SHA-256 tooling on Hostinger.
4. Uploads the three CLI tools to a private temporary work directory.
5. Creates a coordinated snapshot under the exclusive storage lock.
6. Audits the snapshot with strict permissions.
7. Creates a `tar.gz` archive with mode `0600`.
8. Writes a SHA-256 archive checksum.
9. Extracts the archive into a separate private restored-copy directory.
10. Audits the extracted copy again.
11. Requires snapshot and restored-copy digests, manifest checksums, and commit markers to match.
12. Saves non-sensitive audit summaries beside the private archive.
13. Downloads only the checksum and non-sensitive reports to GitHub Actions.
14. Keeps the newest configured number of verified archives.
15. Removes temporary snapshot, tool, and extracted-copy directories.

It never replaces the live private-data directory.

## Archive naming and companion files

A successful run creates files shaped like:

```txt
growlens-private-20260713T203000Z-9f96bbd517b5.tar.gz
growlens-private-20260713T203000Z-9f96bbd517b5.tar.gz.sha256
growlens-private-20260713T203000Z-9f96bbd517b5.tar.gz.summary.json
growlens-private-20260713T203000Z-9f96bbd517b5.tar.gz.snapshot-audit.json
growlens-private-20260713T203000Z-9f96bbd517b5.tar.gz.restored-copy-audit.json
```

Do not separate an archive from its checksum and reports.

## Manual recovery procedure

Do not restore directly over live data.

1. Put GrowLens into a planned maintenance window or otherwise stop writes.
2. Create and verify a fresh emergency snapshot of the current live directory before changing anything.
3. Select a historical archive and verify its `.sha256` file.
4. Extract it into a new private directory with mode `0700`.
5. Run the strict restored-copy auditor against the extracted directory.
6. Confirm the intended Git commit and data counts in the report.
7. Preserve the existing live private-data directory under a timestamped rollback name.
8. Point `GROWLENS_DATA_DIR` at the audited extracted directory, or perform a same-filesystem atomic directory rename during the maintenance window.
9. Confirm `api/health.php` reports writable private storage.
10. Run the protected two-account GrowLens live acceptance workflow.
11. Confirm existing real accounts can authenticate and access expected records and private images.
12. Keep the pre-restore directory until the recovery is independently confirmed.

A restore should be an explicit incident operation with an identified archive and rollback path. It is intentionally not automated by the backup workflow.

## What a passing run proves

A passing run proves that, at that moment:

- The private filesystem could be copied consistently under the coordination lock.
- The archive matched its checksum.
- The archive extracted successfully.
- The extracted file set exactly matched the manifest.
- Core account, state, session, and image relationships were structurally usable.
- Permissions were private.

It does not prove that every human-entered field is semantically correct, that all users remember their passwords, or that the hosting account itself cannot fail.

## Remaining off-host backup requirement

The workflow stores the sensitive archive on the same Hostinger account. This protects against application mistakes, bad releases, and many file-level failures, but it is not sufficient protection against total hosting-account loss or compromise.

Before handling meaningful production user data, maintain at least one encrypted copy outside the Hostinger account. A later no-monthly-cost option can encrypt the verified archive locally with a separately stored key and copy it to owner-controlled offline storage. Never upload an unencrypted GrowLens private archive to GitHub artifacts, email, cloud drives, or public file storage.

## Production readiness gate

The GrowLens backend should not be called production-ready until all three have passed:

1. Guarded Hostinger deployment with live commit and health verification
2. Protected two-account/two-device live acceptance testing
3. Private snapshot plus extracted restored-copy audit

For stronger disaster recovery, add and periodically test the encrypted off-host copy described above.
