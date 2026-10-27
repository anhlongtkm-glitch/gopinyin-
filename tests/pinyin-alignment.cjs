'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { register } = require('./helpers/supabase-fixture.cjs');
const fs = require('node:fs');
const corrections = require('../src/data/pinyin-corrections.json');

const screenshot = {
  zh:'这是我儿子，那是我女儿。',
  py:'zhè shì wǒ ér zi nà shì wǒ nǚ ér',
  expected:['zhè','shì','wǒ','ér','zi','nà','shì','wǒ','nǚ','ér']
};
const cases = [
  screenshot,
  {zh:'儿女',py:'ér nǚ',expected:['ér','nǚ']},
  {zh:'儿科',py:'ér kē',expected:['ér','kē']},
  {zh:'儿童',py:'ér tóng',expected:['ér','tóng']},
  {zh:'女儿和儿子。',py:'nǚ ér hé ér zi 。',expected:['nǚ','ér','hé','ér','zi']},
  {zh:'玩儿',py:'wánr',expected:['wán','r'],typing:['wánr']},
  {zh:'这儿',py:'zhèr',expected:['zhè','r'],typing:['zhèr']},
  {zh:'那儿',py:'nàr',expected:['nà','r'],typing:['nàr']},
  {zh:'我女儿在这儿玩儿。',py:'wǒ nǚ ér zài zhèr wánr',expected:['wǒ','nǚ','ér','zài','zhè','r','wán','r'],typing:['wǒ','nǚ','ér','zài','zhèr','wánr']},
  {zh:'有一点儿冷。',py:'yǒu yī diǎn r lěng',expected:['yǒu','yī','diǎn','r','lěng'],typing:['yǒu','yī','diǎnr','lěng']},
  {zh:'我说的话。',py:'wǒ shuō dehuà 。',expected:['wǒ','shuō','de','huà']},
  {zh:'加强监管。',py:'jiāqiáng jiānguǎn 。',expected:['jiā','qiáng','jiān','guǎn']},
  {zh:'他在办公室。',py:'tā zài bàngōngshì 。',expected:['tā','zài','bàn','gōng','shì']},
  {zh:'你好，老师！',py:'nǐ hǎo ， lǎo shī ！',expected:['nǐ','hǎo','lǎo','shī']},
  {zh:'“你好！”她说。',py:'nǐ hǎo ！ tā shuō 。',expected:['nǐ','hǎo','tā','shuō']}
];

async function displayedTyping(page) {
  return page.locator('#chinese').evaluate(host => ({
    text:[...host.children].map(node => node.querySelector('.hanzi-word')?.textContent ?? node.textContent).join(''),
    py:[...host.querySelectorAll('.pinyin-guide')].flatMap(node => node.textContent.trim().split(/\s+/)).filter(Boolean),
    punctuation:[...host.querySelectorAll('.hanzi-punct')].map(node => node.textContent)
  }));
}

async function displayedPronunciation(page) {
  return page.locator('#pronHanzi').evaluate(host => ({
    text:[...host.querySelectorAll('.pronCharGlyph')].map(node => node.textContent).join(''),
    py:[...host.querySelectorAll('.pronChar:not(.is-punct) .pronCharPy')].map(node => node.textContent),
    punctuation:[...host.querySelectorAll('.pronChar.is-punct')].map(node => ({text:node.querySelector('.pronCharGlyph').textContent,py:node.querySelector('.pronCharPy').textContent}))
  }));
}

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.SpeechSynthesisUtterance = class {constructor(text){this.text=text;}};
      speechSynthesis.getVoices = () => [{name:'Google Mandarin Female',lang:'zh-CN'}];
      speechSynthesis.cancel = () => {};
      speechSynthesis.speak = utterance => {utterance.onstart?.();setTimeout(() => utterance.onend?.({}),0);};
    });
    await page.goto(process.env.TEST_URL,{waitUntil:'networkidle'});
    await register(page,'Pinyin alignment learner');
    await page.evaluate(() => window.showView('practice'));
    await page.click('[data-hsk-level="1"]');
    await page.click('[data-practice-group="0"]');
    await page.locator('#appCard').waitFor({state:'visible'});

    const scanned = await page.evaluate(() => {
      const failures = [];
      let count = 0, hanCount = 0, erhuaSlots = 0;
      for (const level of Object.keys(window.HSK_DATA).filter(key => /^hsk[1-9]$/.test(key))) {
        window.HSK_DATA[level].forEach(([zh,py,vi],index) => {
          count++;
          const row = {zh,py,vi}, han = window.hanChars(zh), words = window.answerWords(row).marked;
          const map = window.hanSyllableList(row,han.length);
          const fail = reason => {if(failures.length < 25)failures.push({level,index,zh,py,words,map,reason});};
          hanCount += han.length;
          if (map.length !== han.length) {fail('Every Han character needs one aligned slot');return;}
          if (words.some(word => !word || !/[a-züāáǎàēéěèōóǒòīíǐìūúǔùǖǘǚǜ]/i.test(word) || /[，。！？,!?]/.test(word))) fail('Punctuation cannot consume a spoken token');
          const covered = new Set(), duplicates = [];
          for (let ci = 0; ci < map.length; ci++) {
            const wi = map[ci];
            if (!Number.isInteger(wi) || wi < 0 || wi >= words.length || !words[wi]) {fail('Alignment points outside the available syllables');break;}
            if (ci > 0 && wi < map[ci-1]) {fail('Alignment must preserve sentence order');break;}
            if (covered.has(wi)) {
              duplicates.push(ci);
              const base = window.normalize(words[wi]).replace(/[^a-zü]/g,'');
              if (han[ci] !== '儿' || wi !== map[ci-1] || base === 'er' || !base.endsWith('r')) {fail('Only an actual erhua suffix can share its preceding syllable');break;}
            }
            covered.add(wi);
          }
          erhuaSlots += duplicates.length;
          if (words.length + duplicates.length !== han.length || covered.size !== words.length) fail('Spoken tokens plus actual erhua slots must cover the full sentence');
          const parts = window.splitChineseByPinyin(row);
          if (parts.map(part => part.text).join('') !== zh) fail('Typing groups lost or duplicated Chinese text or punctuation');
          const displayed = parts.filter(part => !part.punct && part.wordIndex >= 0).flatMap(part => {
            const end = part.wordEnd ?? part.wordIndex;
            return Array.from({length:end-part.wordIndex+1},(_,offset) => part.wordIndex+offset);
          });
          if (displayed.length !== words.length || displayed.some((value,i) => value !== i)) fail('Typing groups must display each pinyin token once in sentence order');
        });
      }
      return {count,hanCount,erhuaSlots,failures};
    });
    assert.equal(scanned.count,4969,'The audit must cover every HSK 1–9 sentence');
    assert(scanned.hanCount >= scanned.count,'Each audited sentence must contain Han characters');
    assert.deepEqual(scanned.failures,[],'HSK pinyin alignment audit: '+JSON.stringify(scanned.failures));
    console.log('  PASS all 4969 HSK sentences align every Han character and display every spoken token once');

    const rendered = await page.evaluate(cases => {
      const state = window.__pron._state;
      const before = {items:state.items,order:state.order,index:state.index};
      const typingRow = window.currentRow();
      try {
        return cases.map((row,index) => {
          const q = {...row,id:'alignment-'+index,vi:'Bài kiểm tra pinyin'};
          state.items=[q];state.order=[0];state.index=0;
          const holder = document.createElement('div');
          holder.innerHTML=window.__pron._hanziHtml(q.zh);
          window.renderChineseWords(q);
          const typing = document.getElementById('chinese');
          return {
            zh:q.zh,
            marked:window.answerWords(q).marked,
            pronText:[...holder.querySelectorAll('.pronCharGlyph')].map(node => node.textContent).join(''),
            pronPy:[...holder.querySelectorAll('.pronChar:not(.is-punct) .pronCharPy')].map(node => node.textContent),
            pronPunct:[...holder.querySelectorAll('.pronChar.is-punct .pronCharPy')].map(node => node.textContent),
            typingText:[...typing.children].map(node => node.querySelector('.hanzi-word')?.textContent ?? node.textContent).join(''),
            typingPy:[...typing.querySelectorAll('.pinyin-guide')].flatMap(node => node.textContent.trim().split(/\s+/)).filter(Boolean)
          };
        });
      } finally {
        Object.assign(state,before);
        if (typingRow) window.renderChineseWords(typingRow);
      }
    },cases);
    rendered.forEach((actual,index) => {
      const expected=cases[index], typed=expected.typing || expected.expected;
      assert.equal(actual.pronText,expected.zh);
      assert.equal(actual.typingText,expected.zh);
      assert.deepEqual(actual.pronPy,expected.expected,expected.zh+' pronunciation');
      assert.deepEqual(actual.marked,typed,expected.zh+' tokenization');
      assert.deepEqual(actual.typingPy,typed,expected.zh+' typing groups');
      assert(actual.pronPunct.every(value => value === ''),'Punctuation must never display pinyin');
    });
    console.log('  PASS standalone 儿, actual erhua, joined neutral syllables and punctuation render with exact pinyin');

    const correctionFailures = await page.evaluate(corrections => Object.entries(corrections).flatMap(([key,corrected]) => {
      const [zh,py] = key.split('\t'), row = {zh,py};
      const actual = window.answerWords(row).marked;
      const expected = window.fixPinyin(corrected).split(/\s+/).filter(Boolean);
      const map = window.hanSyllableList(row,window.hanChars(zh).length);
      return JSON.stringify(actual) !== JSON.stringify(expected) || map.some(index=>index<0) ? [{zh,py,actual,expected,map}] : [];
    }),corrections);
    assert.deepEqual(correctionFailures,[],'Corrections must apply to existing saved rows as well as new source data');
    await page.addScriptTag({url:new URL('assets/vocab-pack.js',process.env.TEST_URL).href});
    const packAudit = await page.evaluate(() => {
      const result={topics:0,rows:0,aligned:0,phraseOnly:0,partialMappings:[],samples:[]};
      for(const [topic,raw] of Object.entries(window.VOCAB_PACK)) {
        result.topics++;
        for(const line of raw.split('\n').filter(Boolean)) {
          result.rows++;
          const [zh,py] = line.split('\t'), row={zh,py};
          const map=window.hanSyllableList(row,window.hanChars(zh).length);
          if(map.length && map.every(index=>index>=0))result.aligned++;
          else {
            result.phraseOnly++;
            if(map.some(index=>index>=0)&&result.partialMappings.length<10)result.partialMappings.push({topic,zh,py,map});
            if(result.samples.length<10)result.samples.push({topic,zh,py});
          }
        }
      }
      return result;
    });
    assert.equal(packAudit.topics,206);assert.equal(packAudit.rows,41621);
    assert.deepEqual(packAudit.partialMappings,[],'Unresolved source data must not fabricate a partial character alignment');
    fs.writeFileSync('.cache/pinyin-corpus-validation.json',JSON.stringify({hsk:scanned,topics:packAudit,correctedReadings:Object.keys(corrections).length},null,2));
    console.log('  PASS verified source corrections apply to saved rows; all 41621 topic entries use complete alignment or phrase-level readings');

    const unmapped = await page.evaluate(() => {
      const row={zh:'学习工作',py:'xué xí'};
      window.renderChineseWords(row);
      const host=document.getElementById('chinese');
      return {readings:[...host.querySelectorAll('.hanzi-pair .pinyin-guide')].map(node=>node.textContent),phrase:host.querySelector('.pinyin-unmapped')?.textContent};
    });
    assert(unmapped.readings.every(reading=>reading===''));
    assert.equal(unmapped.phrase,'Phiên âm theo cụm: xué xí');
    console.log('  PASS incomplete imported pinyin is shown once as a phrase instead of duplicated over unrelated characters');

    await page.evaluate(zh => {
      const target = window.rows.findIndex(row => row.zh === zh);
      if (target < 0) throw new Error('Missing screenshot sentence in HSK 1 stage 1');
      window.index=window.order.indexOf(target);window.mainIndex=window.index;window.render();
    },screenshot.zh);
    await page.click('#hintBtn');
    let actual = await displayedTyping(page);
    assert.equal(actual.text,screenshot.zh);
    assert.deepEqual(actual.py,screenshot.expected);
    assert.deepEqual(actual.punctuation,['，','。']);
    await page.click('#appCard [data-practice-mode="speaking"]');
    await page.locator('#pronCard').waitFor({state:'visible'});
    await page.waitForFunction(zh => window.__pron._state.items[window.__pron._state.order[window.__pron._state.index]]?.zh === zh,screenshot.zh);
    actual=await displayedPronunciation(page);
    assert.equal(actual.text,screenshot.zh);
    assert.deepEqual(actual.py,screenshot.expected);
    assert.deepEqual(actual.punctuation,[{text:'，',py:''},{text:'。',py:''}]);
    await page.click('#pronCard [data-practice-mode="typing"]');
    await page.locator('#appCard').waitFor({state:'visible'});
    actual=await displayedTyping(page);
    assert.equal(actual.text,screenshot.zh);
    assert.deepEqual(actual.py,screenshot.expected);
    assert.deepEqual(errors,[]);
    console.log('  PASS the screenshot HSK sentence keeps 儿子/女儿 and punctuation correct through real Gõ/Nói switches');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
