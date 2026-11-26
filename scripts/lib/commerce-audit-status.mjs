export function productHttpStatusIssue(status) {
  if (status === 403) {
    return 'Product page returned HTTP 403; sale-hold visibility and purchase controls cannot be verified';
  }
  if (status === 200 || status === 404 || status === 410) return null;
  return 'Unexpected HTTP status ' + status;
}
