export function indexRecords(records, key = 'id') {
  const output = {};
  for (const record of records) {
    output[record[key]] = record;
  }
  return output;
}

export function mergeRecordLists(...lists) {
  return lists.flat();
}
