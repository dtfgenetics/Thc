#!/usr/bin/env bash
set -euo pipefail

if (($# != 7)); then
  echo "Usage: $0 DATA_ROOT BACKUP_ROOT WORK_DIR ARCHIVE_NAME COMMIT MAX_BYTES RETENTION" >&2
  exit 2
fi

data_root="$1"
backup_root="$2"
work="$3"
archive_name="$4"
commit="$5"
max_bytes="$6"
retention="$7"
tools="$work/tools"
snapshot="$work/snapshot"
restored="$work/restored"
reports="$work/reports"
archive="$backup_root/$archive_name"
archive_tmp="$archive.tmp"
summary="$backup_root/$archive_name.summary.json"
checksum="$backup_root/$archive_name.sha256"
snapshot_report="$backup_root/$archive_name.snapshot-audit.json"
restore_report="$backup_root/$archive_name.restored-copy-audit.json"
snapshot_audit="$reports/snapshot-audit.json"
restore_audit="$reports/restored-copy-audit.json"
verified=0

cleanup() {
  rm -rf -- "$work"
  rm -f -- "$archive_tmp"
  if ((verified != 1)); then
    rm -f -- "$archive" "$checksum" "$summary" "$snapshot_report" "$restore_report"
  fi
}
trap cleanup EXIT

for required in \
  "$tools/growlens-private-data-common.php" \
  "$tools/growlens-private-data-snapshot.php" \
  "$tools/growlens-private-data-audit.php"; do
  [[ -f "$required" ]] || {
    echo "Missing uploaded backup tool: $required" >&2
    exit 1
  }
done

mkdir -p "$reports"
chmod 700 "$reports"
php "$tools/growlens-private-data-snapshot.php" \
  --source="$data_root" \
  --destination="$snapshot" \
  --commit="$commit" \
  --max-bytes="$max_bytes" \
  --lock-wait-seconds=120 > "$reports/snapshot-result.json"
chmod 600 "$reports/snapshot-result.json"

php "$tools/growlens-private-data-audit.php" \
  --root="$snapshot" \
  --strict-permissions=true \
  --output="$snapshot_audit" > /dev/null

tar -C "$snapshot" -czf "$archive_tmp" .
chmod 600 "$archive_tmp"
mv "$archive_tmp" "$archive"
(
  cd "$backup_root"
  sha256sum "$archive_name" > "$archive_name.sha256"
)
chmod 600 "$checksum"

mkdir -p "$restored"
chmod 700 "$restored"
tar -C "$restored" -xzf "$archive" --no-same-owner
chmod 700 "$restored"
php "$tools/growlens-private-data-audit.php" \
  --root="$restored" \
  --strict-permissions=true \
  --output="$restore_audit" > /dev/null

php -r '
  [$snapshotPath, $restorePath] = array_slice($argv, 1);
  $snapshot = json_decode(file_get_contents($snapshotPath), true, 512, JSON_THROW_ON_ERROR);
  $restore = json_decode(file_get_contents($restorePath), true, 512, JSON_THROW_ON_ERROR);
  foreach (["entriesDigest", "manifestSha256", "commit"] as $field) {
      if (!isset($snapshot[$field], $restore[$field]) || !hash_equals((string)$snapshot[$field], (string)$restore[$field])) {
          fwrite(STDERR, "Snapshot and restored-copy audit differ for {$field}.\n");
          exit(1);
      }
  }
  if (($snapshot["ok"] ?? false) !== true || ($restore["ok"] ?? false) !== true) {
      fwrite(STDERR, "Snapshot or restored-copy audit did not pass.\n");
      exit(1);
  }
' "$snapshot_audit" "$restore_audit"

cp "$snapshot_audit" "$snapshot_report"
cp "$restore_audit" "$restore_report"
chmod 600 "$snapshot_report" "$restore_report"

php -r '
  [$archiveName, $checksumPath, $snapshotPath, $restorePath, $outputPath] = array_slice($argv, 1);
  $snapshot = json_decode(file_get_contents($snapshotPath), true, 512, JSON_THROW_ON_ERROR);
  $restore = json_decode(file_get_contents($restorePath), true, 512, JSON_THROW_ON_ERROR);
  $checksum = trim((string)file_get_contents($checksumPath));
  $summary = [
      "ok" => true,
      "app" => "THC GrowLens",
      "archive" => $archiveName,
      "createdAt" => gmdate("c"),
      "commit" => $snapshot["commit"] ?? "",
      "entriesDigest" => $snapshot["entriesDigest"] ?? "",
      "manifestSha256" => $snapshot["manifestSha256"] ?? "",
      "archiveSha256" => strtok($checksum, " "),
      "counts" => $restore["counts"] ?? []
  ];
  file_put_contents($outputPath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL, LOCK_EX);
  chmod($outputPath, 0600);
' "$archive_name" "$checksum" "$snapshot_audit" "$restore_audit" "$summary"

mapfile -t archives < <(
  find "$backup_root" -maxdepth 1 -type f -name 'growlens-private-*.tar.gz' -printf '%T@ %f\n' \
    | sort -nr \
    | awk '{print $2}'
)
if ((${#archives[@]} > retention)); then
  for old in "${archives[@]:retention}"; do
    rm -f -- \
      "$backup_root/$old" \
      "$backup_root/$old.sha256" \
      "$backup_root/$old.summary.json" \
      "$backup_root/$old.snapshot-audit.json" \
      "$backup_root/$old.restored-copy-audit.json"
  done
fi

verified=1
printf '%s\n' "$summary"
