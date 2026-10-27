'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

(async () => {
  const fixtures = {
    '../storage/account-data.js': 'export const learningStorage={getItem:k=>globalThis.audioRace.stored[k]??null,setItem:(k,v)=>{globalThis.audioRace.stored[k]=v;}};',
    './session.js': 'export const state={S:globalThis.audioRace.S,GOOD:75};',
    './lesson.js': 'export const currentItem=()=>globalThis.audioRace.S.items[globalThis.audioRace.S.index]||null;',
    '../../app/routes.js': 'export const navigationVersion=()=>globalThis.audioRace.navigation;',
    '../../shared/mascot.js': 'export const setMascot=()=>{};',
    '../../shared/study/interactions.js': 'export const studyOverlayOpen=()=>globalThis.audioRace.overlay;',
    '../../features/typing/answers.js': 'export const answerWords=()=>({marked:[]});',
    '../../features/typing/input.js': 'export const hanChars=s=>Array.from(s);',
    '../../features/typing/session.js': 'export const state=globalThis.audioRace.typing; export const currentRow=()=>null;',
    '../dom.js': 'export const state={$:id=>globalThis.audioRace.elements[id]};',
    '../language/normalization.js': 'export const normalize=String;',
    '../toast.js': 'export const toast=()=>{};',
    '../utils.js': 'export const escapeHtml=String;',
    '../mascot.js': 'export const setMascot=()=>{};'
  };
  const outputs = {};
  for (const [name, entry] of Object.entries({policy:'src/shared/audio/voice-policy.js',pron:'src/features/pronunciation/tts.js',typingTts:'src/shared/audio/tts.js',typingSession:'src/features/typing/session.js',pronSession:'src/features/pronunciation/session.js'})) {
    outputs[name] = path.resolve('.cache/audio-' + name + '.cjs');
    await esbuild.build({absWorkingDir:path.resolve('.'),entryPoints:[path.resolve(entry)],bundle:true,platform:'node',format:'cjs',outfile:outputs[name],plugins:[{name:'audio-fixtures',setup(build){
      build.onResolve({filter:/\.js$/},args => fixtures[args.path] ? {path:args.path,namespace:'fixture'} : undefined);
      build.onLoad({filter:/.*/,namespace:'fixture'},args => ({contents:fixtures[args.path]}));
    }}]});
  }

  const google = {name:'Google 普通话（中国大陆）',lang:'zh-CN'};
  const female = {name:'Microsoft Xiaoxiao Female',lang:'zh-CN'};
  const male = {name:'Microsoft Yunxi Male',lang:'zh-CN'};
  const race = global.audioRace = {stored:{},navigation:1,overlay:false,visible:true,voices:[male,female,google],spoken:[],typing:{speechRate:1,selectedVoiceName:''},elements:{voiceSelect:{innerHTML:'',value:''}},S:{items:[{zh:'你好。'},{zh:'你好吗？'}],index:0,phase:'idle',settings:{voice:'',rate:1,autoSample:true}}};
  let now = 0, id = 0;
  const tasks = new Map(), listeners = new Set();
  const nativeTimeout = global.setTimeout, nativeClear = global.clearTimeout;
  global.setTimeout = (callback,delay=0) => {const handle=++id;tasks.set(handle,{callback,at:now+delay});return handle;};
  global.clearTimeout = handle => tasks.delete(handle);
  function advance(ms) {
    const until=now+ms;
    while(true){const next=[...tasks].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;tasks.delete(next[0]);now=next[1].at;next[1].callback();}
    now=until;
  }
  global.window = {speechSynthesis:{getVoices:()=>race.voices,speak:u=>race.spoken.push(u),cancel:()=>{},addEventListener:(event,fn)=>listeners.add(fn),removeEventListener:(event,fn)=>listeners.delete(fn)}};
  global.SpeechSynthesisUtterance = class {constructor(text){this.text=text;}};
  global.document = {visibilityState:'visible',getElementById:id=>id==='pronCard'?{getClientRects:()=>race.visible?[{}]:[]}:id==='pronSettings'?{open:race.settingsOpen}:null};
  const check = (name,fn) => {fn();console.log('  PASS '+name);};
  try {
    const policy = require(outputs.policy);
    const pron = require(outputs.pron); pron.initializePronunciationTts();
    const typingTts = require(outputs.typingTts);
    const typingSession = require(outputs.typingSession); typingSession.initializeTypingSession();
    const pronSession = require(outputs.pronSession); pronSession.initializePronunciationSession();
    check('new sessions use speed 1.0 and enable pronunciation samples',()=>{assert.equal(typingSession.state.speechRate,1);assert.equal(pronSession.state.S.settings.rate,1);assert.equal(pronSession.state.S.settings.autoSample,true);});
    check('automatic voice prefers Google Mandarin and handles female/male labels and fallback',()=>{
      assert.equal(policy.chooseChineseVoice(race.voices),google);
      assert.equal(policy.voiceGender({name:'Chinese Female'}),'female');
      assert.equal(policy.voiceGender({name:'Chinese Male'}),'male');
      assert.equal(policy.voiceGender({}),'unknown');
      assert.equal(policy.chooseChineseVoice([male,female]),female);
      assert.equal(policy.chooseChineseVoice(race.voices,male.name),male);
      assert.equal(policy.chooseChineseVoice([]),null);
    });
    check('named voice survives an initially empty voice list and is restored when voices load',()=>{
      race.typing.selectedVoiceName=male.name;race.voices=[];typingTts.populateVoiceSelect();
      assert.equal(race.typing.selectedVoiceName,male.name);assert.equal(race.elements.voiceSelect.value,male.name);
      race.voices=[male,female,google];typingTts.populateVoiceSelect();assert.equal(typingTts.getChineseVoice(),male);
      race.typing.selectedVoiceName='';
    });
    check('shared explicit rate and voice apply across lesson defaults while legacy choices remain fallback',()=>{
      assert.deepEqual(policy.speechPreferences({rate:0.8,voice:male.name}),{rate:0.8,voice:male.name});
      policy.saveSpeechPreference({voice:female.name});policy.saveSpeechPreference({rate:0.75});
      assert.deepEqual(policy.speechPreferences({rate:1,voice:male.name}),{rate:0.75,voice:female.name});
      race.spoken=[];typingTts.speakText('你好。');assert.equal(race.spoken[0].rate,0.75);assert.equal(race.spoken[0].voice,female);
      race.stored={};race.spoken=[];
    });
    check('rescheduling the same entry reads once; a rapid next reads only the new sentence',()=>{
      pron.schedulePronunciationSample();pron.schedulePronunciationSample();advance(220);
      assert.deepEqual(race.spoken.map(u=>u.text),['你好。']);assert.equal(race.spoken[0].voice,google);assert.equal(race.spoken[0].rate,1);
      race.spoken=[];pron.schedulePronunciationSample();race.S.index=1;pron.schedulePronunciationSample();advance(220);
      assert.deepEqual(race.spoken.map(u=>u.text),['你好吗？']);
    });
    check('late voices start one sample using Google, without a duplicate timeout sample',()=>{
      race.spoken=[];race.voices=[];pron.schedulePronunciationSample();advance(220);assert.equal(race.spoken.length,0);
      race.voices=[male,google];for(const fn of [...listeners])fn();advance(1000);
      assert.equal(race.spoken.length,1);assert.equal(race.spoken[0].voice,google);
    });
    check('recording, overlays, hidden views, navigation and source changes prevent delayed playback',()=>{
      race.spoken=[];
      for(const phase of ['requesting','recording','analyzing']){race.S.phase='idle';pron.schedulePronunciationSample();race.S.phase=phase;advance(1000);}
      race.S.phase='idle';pron.schedulePronunciationSample();race.overlay=true;advance(1000);race.overlay=false;
      pron.schedulePronunciationSample();race.visible=false;advance(1000);race.visible=true;
      pron.schedulePronunciationSample();race.settingsOpen=true;advance(1000);race.settingsOpen=false;
      pron.schedulePronunciationSample();race.navigation++;advance(1000);
      pron.schedulePronunciationSample();race.S.items=race.S.items.map(x=>({...x}));advance(1000);
      assert.equal(race.spoken.length,0);
    });
    check('cancel during late voice loading removes pending sample and honors an explicit sample opt-out',()=>{
      race.spoken=[];race.voices=[];pron.schedulePronunciationSample();advance(220);pron.cancelPronunciationSample();
      race.voices=[google];for(const fn of [...listeners])fn();advance(1000);assert.equal(race.spoken.length,0);
      race.S.settings.autoSample=false;pron.schedulePronunciationSample();advance(1000);assert.equal(race.spoken.length,0);
    });
  } finally {global.setTimeout=nativeTimeout;global.clearTimeout=nativeClear;}
})().catch(error=>{console.error(error);process.exitCode=1;});
