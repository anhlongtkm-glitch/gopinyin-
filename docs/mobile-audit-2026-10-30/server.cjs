const path=require('node:path');
const {spawn}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const f=await require('../../tests/helpers/supabase-fixture.cjs').startSupabaseFixture();
 process.env.GOPINYIN_SUPABASE_URL=f.url;process.env.GOPINYIN_SUPABASE_PUBLISHABLE_KEY=f.key;
 const {build}=await import('../../scripts/build.mjs');
 const out=path.join(root,'.cache/mobile-audit-app');await build({outputDirectory:out});
 const child=spawn(process.execPath,['server/serve.js','--no-open'],{cwd:root,env:{...process.env,PORT:'8092',GP_BUILD_READY:'1',GP_PUBLIC_ROOT:out},windowsHide:true,stdio:'inherit'});
 process.on('SIGINT',()=>{child.kill();f.close().then(()=>process.exit());});
})().catch(e=>{console.error(e);process.exit(1)});
