// Own only #/ routes; leave Auth recovery and legacy import fragments untouched.
let navigationEpoch = 0;
export function navigationVersion() { return navigationEpoch; }
export function markNavigation() { navigationEpoch++; }
export function readRoute() {
  if (!location.hash.startsWith('#/')) return null;
  const [view, query = ''] = location.hash.slice(2).split('?');
  const params = new URLSearchParams(query);
  return { view, dataset: params.get('dataset') || '', review: params.get('review') || '' };
}
export function writeRoute(view, dataset = '', replace = false, review = '') {
  if (location.hash && !location.hash.startsWith('#/')) return;
  const params = new URLSearchParams();
  if (dataset) params.set('dataset', dataset);
  if (['due', 'weak'].includes(review)) params.set('review', review);
  const hash = '#/' + view + (params.size ? '?' + params : '');
  if (location.hash === hash) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + location.search + hash);
}
