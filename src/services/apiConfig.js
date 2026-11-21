/**
 * Centralized API configuration
 * Automatically routes production requests to the live VPS backend API at https://api.bhashyamramakrishna.in
 * while preserving relative paths for localhost/dev environments.
 */
export function getBackendUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && (
    window.location.hostname.includes('social.bhashyamramakrishna.in') ||
    window.location.hostname.includes('pages.dev')
  )) {
    return `https://api.bhashyamramakrishna.in${cleanPath}`;
  }
  return cleanPath;
}
