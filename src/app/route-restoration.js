import { readRoute, writeRoute, markNavigation, navigationVersion } from './routes.js';
import { showView } from './navigation.js';
import { openDataset } from '../features/typing/datasets.js';
import { getAccountClient } from '../features/auth/client.js';
import { state as authState } from '../features/auth/service.js';

export function initializeRouteRestoration() {
  const restoreRoute = async () => {
    const route = readRoute();
    if (!route) { if (!location.hash) await showView('dash', { route: false }); return; }
    const navigation = markNavigation();
    if (['tones','shadow','shadowVideo','shadowText'].includes(route.view)) {
      await showView('readings', {route:false,navigation});
      if (navigation === navigationVersion()) writeRoute('readings', '', true);
    } else if (route.view === 'study' && route.dataset) {
      const opened = await openDataset(route.dataset, { route: false, review: route.review, navigation, practiceMode:route.mode });
      if (opened === false && navigation === navigationVersion()) {
        await showView('library', { route: false, navigation });
        if (navigation === navigationVersion()) writeRoute('library', '', true);
      }
    } else await showView(route.view, { route: false, navigation });
  };
  const restore = () => restoreRoute().catch(console.error);
  window.addEventListener('popstate', restore);
  if (readRoute()?.view !== 'study') { restore(); return; }

  const initialHash = location.hash, initialNavigation = navigationVersion();
  const events = ['gp:account-ready', 'gp:account-error', 'gp:account-cleared'];
  let pending = true;
  const restoreOnce = () => {
    if (!pending) return;
    pending = false;
    events.forEach(name => window.removeEventListener(name, restoreOnce));
    // A new intent can precede a URL update while the login dialog is open.
    if (initialHash === location.hash && initialNavigation === navigationVersion()) restore();
  };
  events.forEach(name => window.addEventListener(name, restoreOnce));
  const client = getAccountClient();
  if (!client) restoreOnce();
  else client.auth.getSession().then(({ data }) => {
    if (!data.session || authState.ready) restoreOnce();
  }).catch(restoreOnce);
}
