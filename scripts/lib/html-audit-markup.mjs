export function stripNonRenderedMarkup(html='') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,' ');
}
