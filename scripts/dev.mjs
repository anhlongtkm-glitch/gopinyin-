import { build, projectRoot } from './build.mjs';
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

// One build at a time. A source change during a build queues the next pass.
let pending = false, building = false, timer;
async function rebuild() {
  pending = true;
  if (building) return;
  building = true;
  try {
    while (pending) {
      pending = false;
      try { await build({ development:true }); }
      catch (error) { console.error('[watch] Build failed; fix the source and save again:', error.message); }
    }
  } finally { building = false; }
}

try {
  await build({ development:true });
  const server = spawn(process.execPath, [path.join(projectRoot,'server/serve.js'), ...process.argv.slice(2)], {
    cwd: projectRoot, env:{...process.env,GP_BUILD_READY:'1'}, stdio:'inherit', windowsHide:true
  });
  const watchers = ['src','assets'].map(directory => watch(path.join(projectRoot,directory), {recursive:true}, (_event, filename) => {
    if (!filename) return;
    clearTimeout(timer); timer=setTimeout(rebuild,100);
  }));
  console.log('[watch] Watching src/ and public assets. Save, then reload the browser.');
  const stop = () => { clearTimeout(timer); for(const watcher of watchers)watcher.close(); server.kill(); };
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  process.on('message',message=>{if(message==='shutdown'){stop();if(process.connected)process.disconnect();}});
  server.on('exit',code=>{stop();process.exitCode=code||0;});
} catch(error) {console.error('[dev]',error.message);process.exitCode=1;}
