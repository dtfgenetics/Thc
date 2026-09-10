export const WEB_QA_BASE_URL = process.env.WEB_QA_BASE_URL || 'https://dtfseeds.com';
export const WEB_QA_ROUTE_FILE = process.env.WEB_QA_ROUTE_FILE || '.artifacts/web-qa/routes.json';
export const WEB_QA_ARTIFACT_DIR = process.env.WEB_QA_ARTIFACT_DIR || '.artifacts/web-qa';
export const WEB_QA_MAX_ROUTES = Number(process.env.WEB_QA_MAX_ROUTES || 250);
export const WEB_QA_ENFORCE = process.env.WEB_QA_ENFORCE === '1';

export const destructivePathFragments = [
  '/logout', '/signout', '/delete', '/remove', '/checkout', '/cart/clear', '/account/delete',
];

export const ignoredExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.pdf', '.zip', '.mp4', '.webm',
  '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.eot', '.css', '.js', '.mjs', '.map', '.json', '.xml',
]);
