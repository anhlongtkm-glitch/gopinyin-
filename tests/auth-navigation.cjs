'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Load actual source modules, replacing only their external dependencies.
async function bundleActual(entry, fixtures) {
  const result = await require('esbuild').build({
    entryPoints: ['auth-navigation-entry'], bundle: true, platform: 'node', format: 'cjs', write: false,
    plugins: [{ name: 'auth-navigation-fixtures', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.path === 'auth-navigation-entry') return { path: 'entry', namespace: 'fixture' };
        const resolved = path.isAbsolute(args.path) ? args.path : path.resolve(path.dirname(args.importer), args.path);
        return { path: resolved, namespace: fixtures[resolved] ? 'fixture' : 'source' };
      });
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'entry' ? entry : fixtures[args.path] }));
      build.onLoad({ filter: /.*/, namespace: 'source' }, args => ({ contents: fs.readFileSync(args.path, 'utf8') }));
    } }]
  });
  const module = { exports: {} };
  new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports);
  return module.exports;
}

async function loadAuth() {
  return bundleActual(`export * as auth from ${JSON.stringify(path.resolve('src/features/auth/service.js'))}; export * as routes from ${JSON.stringify(path.resolve('src/app/routes.js'))};`, {
    [path.resolve('src/features/auth/client.js')]: 'export const getAccountClient=()=>globalThis.authNavigationFixture.client,accountRedirect=()=>"http://localhost/";',
    [path.resolve('src/shared/storage/account-data.js')]: 'export const attachAccountData=async id=>globalThis.authNavigationFixture.attached.push(id),detachAccountData=()=>{},synchronizeAccountData=async()=>{},flushAccountData=async()=>{},syncStatus=()=>"saved";'
  });
}

async function routeScenario(options = {}) {
  const fixture = { calls: [], writes: [], authState: { ready: false }, ...options };
  if (!('client' in options)) fixture.client = { auth: { getSession: async () => ({ data: { session: {} } }) } };
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: new EventTarget() },
    location: { configurable: true, value: { hash: '#/study?dataset=saved-set', pathname: '/', search: '' } },
    history: { configurable: true, value: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, title, url) => {
      fixture.writes.push({ method, url }); location.hash = url.includes('#') ? url.slice(url.indexOf('#')) : '';
    }])) },
    routeRestoreFixture: { configurable: true, value: fixture }
  });
  const routeImport = JSON.stringify(path.resolve('src/app/routes.js'));
  const api = await bundleActual(`export * from ${JSON.stringify(path.resolve('src/app/route-restoration.js'))}; export * as routes from ${routeImport};`, {
    [path.resolve('src/features/auth/client.js')]: 'export const getAccountClient=()=>globalThis.routeRestoreFixture.client;',
    [path.resolve('src/features/auth/service.js')]: 'export const state=globalThis.routeRestoreFixture.authState;',
    [path.resolve('src/app/navigation.js')]: `import {markNavigation,navigationVersion} from ${routeImport}; export async function showView(view,options={}){const nav=options.navigation??markNavigation();if(nav!==navigationVersion())return false;globalThis.routeRestoreFixture.calls.push({view,options});return true;}`,
    [path.resolve('src/features/typing/datasets.js')]: `import {markNavigation} from ${routeImport};export async function openDataset(id,options={}){const navigation=options.navigation??markNavigation();const f=globalThis.routeRestoreFixture;f.calls.push({view:'study',id,options});return f.openDataset?f.openDataset(id,options,navigation):true;}`
  });
  api.initializeRouteRestoration();
  return { ...api, fixture };
}

const drain = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const originalGlobals = new Map(['window', 'navigator', 'localStorage', 'location', 'history', 'authNavigationFixture', 'routeRestoreFixture'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    const user = { id: 'navigation-learner', email: 'navigation@example.test', email_confirmed_at: '2026-10-26T00:00:00Z' };
    const fixture = { attached: [], loginRequired: 0, getUser: async () => ({ data: { user }, error: null }) };
    const profile = { id: user.id, display_name: 'Navigation learner', avatar_path: null };
    fixture.client = {
      auth: {
        getUser: () => fixture.getUser(),
        signInWithPassword: async () => ({ data: { user }, error: null }),
        signUp: async () => ({ data: { user, session: {} }, error: null }),
        signOut: async () => ({ error: null })
      },
      from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: profile, error: null }) })
    };
    const values = new Map();
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: new EventTarget() },
      navigator: { configurable: true, value: { onLine: true } },
      localStorage: { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) } },
      authNavigationFixture: { configurable: true, value: fixture }
    });
    const { auth, routes } = await loadAuth();
    window.addEventListener('gp:login-required', () => { fixture.loginRequired++; });
    // The real controller clears account runtime by navigating to the dashboard.
    window.addEventListener('gp:account-cleared', () => { routes.markNavigation(); });
    const reset = () => {
      auth.cancelPendingAction(); auth.clearAccount();
      fixture.loginRequired = 0; fixture.attached.length = 0;
      fixture.getUser = async () => ({ data: { user }, error: null });
    };
    const login = async () => { assert.equal((await auth.doLogin(user.email, 'password123')).ok, true); };

    reset();
    let resumed = 0;
    assert.equal(await auth.requireAccount(() => { resumed++; }), false);
    routes.markNavigation();
    await login(); await auth.resumePendingAction(); await auth.resumePendingAction();
    assert.equal(resumed, 0); assert.equal(fixture.loginRequired, 1);
    console.log('  PASS guest login cannot resume an action abandoned by newer navigation');

    for (const method of ['login', 'signup']) {
      reset(); resumed = 0;
      assert.equal(await auth.requireAccount(() => { resumed++; }), false);
      if (method === 'login') await login();
      else {
        const result = await auth.doRegister('Navigation learner', user.email, 'password123');
        assert.equal(result.ok, true); assert.equal(result.verification, false);
      }
      await auth.resumePendingAction(); await auth.resumePendingAction();
      assert.equal(resumed, 1); assert.deepEqual(fixture.attached, [user.id]);
    }
    console.log('  PASS current login and verified signup resume their requested action exactly once');

    reset(); resumed = 0;
    auth.state.user = { ...user }; auth.state.ready = true;
    let expire;
    fixture.getUser = () => new Promise(resolve => { expire = resolve; });
    const expiredOldRequest = auth.requireAccount(() => { resumed++; });
    routes.markNavigation();
    expire({ data: { user: null }, error: { status: 401, message: 'Fixture expired session' } });
    assert.equal(await expiredOldRequest, false);
    assert.equal(fixture.loginRequired, 0);
    await login(); await auth.resumePendingAction();
    assert.equal(resumed, 0);
    console.log('  PASS delayed expired-session checks do not reopen login or queue an abandoned action');

    reset(); resumed = 0;
    auth.state.user = { ...user }; auth.state.ready = true;
    fixture.getUser = async () => ({ data: { user: null }, error: { status: 401, message: 'Fixture expired session' } });
    const beforeExpiry = routes.navigationVersion();
    assert.equal(await auth.requireAccount(() => { resumed++; }), false);
    assert.equal(auth.state.user, null); assert.equal(fixture.loginRequired, 1);
    assert(routes.navigationVersion() > beforeExpiry);
    await login(); await auth.resumePendingAction(); await auth.resumePendingAction();
    assert.equal(resumed, 1);
    console.log('  PASS current expired-session actions survive the internal account-cleared navigation');

    reset(); resumed = 0;
    await auth.requireAccount(() => { resumed++; }); auth.cancelPendingAction();
    await login(); await auth.resumePendingAction();
    assert.equal(resumed, 0);
    console.log('  PASS closing login still cancels its pending action');

    let scenario = await routeScenario();
    await drain(); assert.deepEqual(scenario.fixture.calls, []);
    window.dispatchEvent(new CustomEvent('gp:account-ready'));
    await drain();
    window.dispatchEvent(new CustomEvent('gp:account-error'));
    window.dispatchEvent(new CustomEvent('gp:account-cleared'));
    await drain();
    assert.deepEqual(scenario.fixture.calls.map(call => call.view), ['study']);
    assert.equal(scenario.fixture.calls[0].id, 'saved-set');
    console.log('  PASS cached-session study routes wait for activation and restore only once');

    for (const failedSession of [false, true]) {
      scenario = await routeScenario(failedSession ? { client: { auth: { getSession: async () => { throw new Error('Fixture session read failed'); } } } } : {});
      await drain();
      if (!failedSession) window.dispatchEvent(new CustomEvent('gp:account-error'));
      await drain();
      assert.deepEqual(scenario.fixture.calls.map(call => call.view), ['study']);
      window.dispatchEvent(new CustomEvent('gp:account-ready'));
      await drain(); assert.equal(scenario.fixture.calls.length, 1);
    }
    console.log('  PASS failed session activation and session reads release initial-route restoration');

    scenario = await routeScenario(); await drain();
    scenario.routes.markNavigation();
    window.dispatchEvent(new CustomEvent('gp:account-ready'));
    await drain(); assert.deepEqual(scenario.fixture.calls, []);
    scenario = await routeScenario(); await drain();
    location.hash = '#/ai';
    window.dispatchEvent(new CustomEvent('gp:account-ready'));
    await drain(); assert.deepEqual(scenario.fixture.calls, []);
    console.log('  PASS newer navigation intent or changed hash cancels the initial study-route restoration');

    let missing;
    scenario = await routeScenario({ client: null, openDataset: () => new Promise(resolve => { missing = resolve; }) });
    assert.deepEqual(scenario.fixture.calls.map(call => call.view), ['study']);
    scenario.routes.markNavigation(); missing(false); await drain();
    assert.deepEqual(scenario.fixture.calls.map(call => call.view), ['study']); assert.deepEqual(scenario.fixture.writes, []);
    scenario = await routeScenario({ client: null, openDataset: async () => false });
    await drain();
    assert.deepEqual(scenario.fixture.calls.map(call => call.view), ['study', 'library']);
    assert.equal(scenario.fixture.calls[0].options.navigation, scenario.fixture.calls[1].options.navigation);
    assert.deepEqual(scenario.fixture.writes, [{ method: 'replaceState', url: '/#/library' }]);
    console.log('  PASS missing lessons redirect current routes while stale failures cannot replace newer navigation');
  } finally {
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
