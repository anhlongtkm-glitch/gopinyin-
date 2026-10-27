// Own only #/ routes; leave Auth recovery and legacy import fragments untouched.
let navigationEpoch = 0;
export function navigationVersion() { return navigationEpoch; }
export function markNavigation() { return ++navigationEpoch; }
export function readRoute() {
  if (!location.hash.startsWith('#/')) return null;
  const [view, query = ''] = location.hash.slice(2).split('?');
  const params = new URLSearchParams(query);
  return { view, video: params.get('video') || '', dataset: params.get('dataset') || '', review: params.get('review') || '', mode:params.get('mode')==='speaking'?'speaking':'typing' };
}
export function writeRoute(view, dataset = '', replace = false, review = '', mode = '') {
  if (location.hash && !location.hash.startsWith('#/')) return;
  const params = new URLSearchParams();
  if (dataset) params.set('dataset', dataset);
  if (mode === 'speaking') params.set('mode',mode);
  if (['due', 'weak'].includes(review)) params.set('review', review);
  const hash = '#/' + view + (params.size ? '?' + params : '');
  if (location.hash === hash) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', location.pathname + location.search + hash);
}

export function writeVideoRoute(id,replace=false){
 if(location.hash&&!location.hash.startsWith('#/'))return;
 const hash='#/shadowVideo?'+new URLSearchParams({video:id});
 if(location.hash===hash)return;
 history[replace?'replaceState':'pushState'](null,'',location.pathname+location.search+hash);
}
