const MODAL_QUERY_PARAMS = ['course-modal', 'prof-modal'];

export function createCatalogLink(path = '/catalog'): string {
  const lastSearch = sessionStorage.getItem('lastCatalogSearch');
  // Reject corrupt or default-only URLs (e.g. [object Object], empty params)
  if (!lastSearch || lastSearch === '?' || lastSearch.includes('object+Object'))
    return path;

  const params = new URLSearchParams(
    lastSearch.startsWith('?') ? lastSearch.slice(1) : lastSearch,
  );
  MODAL_QUERY_PARAMS.forEach((param) => params.delete(param));
  const cleanedSearch = params.toString();
  return cleanedSearch ? `${path}?${cleanedSearch}` : path;
}
