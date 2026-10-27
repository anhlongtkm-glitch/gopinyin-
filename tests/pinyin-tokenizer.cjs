'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

(async () => {
  const output = path.resolve('.cache/pinyin-tokenizer.cjs');
  await esbuild.build({absWorkingDir:path.resolve('.'),entryPoints:[path.resolve('src/shared/language/pinyin.js')],bundle:true,platform:'node',format:'cjs',outfile:output});
  const pinyin = require(output);
  pinyin.initializeLanguagePinyin();
  const check = (name, test) => {test();console.log('  PASS ' + name);};

  check('joined syllables use complete boundaries instead of greedy consonant fragments', () => {
    const cases = {
      'jiānguǎn':'jiān guǎn', 'bàngōngshì':'bàn gōng shì',
      'jiāniánhuá':'jiā nián huá', 'jìniànpǐn':'jì niàn pǐn',
      'réngōng':'rén gōng', 'zhōngguó':'zhōng guó', 'Hénán':'hé nán'
    };
    for (const [input, expected] of Object.entries(cases)) assert.equal(pinyin.fixPinyin(input), expected, input);
  });
  check('neutral syllables keep their actual tone marks and positions', () => {
    for (const [input, expected] of Object.entries({
      'dehuà':'de huà', 'múzigāo':'mú zi gāo', 'zhīmayóu':'zhī ma yóu',
      'érzi':'ér zi', 'nǎinai':'nǎi nai', 'māma':'mā ma', 'danxíng':'dan xíng'
    })) assert.equal(pinyin.fixPinyin(input), expected, input);
  });
  check('standalone er stays distinct from a valid r suffix', () => {
    for (const [input, expected] of Object.entries({
      "nǚ'ér":'nǚ ér', 'ér zi':'ér zi', 'érzi':'ér zi', 'nǚér':'nǚ ér',
      'wánr':'wánr', 'diǎnr':'diǎnr', 'yīdiǎnr':'yī diǎnr', 'nǎr':'nǎr',
      'wán r':'wánr', 'ér r':'ér r'
    })) assert.equal(pinyin.fixPinyin(input), expected, input);
    assert.equal(pinyin.canTakeErhua('ér'), false);
    assert.equal(pinyin.canTakeErhua('wán'), true);
    assert.deepEqual(pinyin.splitPinyinKeepingErhua('er'), ['er']);
  });
  check('numeric tone boundaries preserve supplied tones without guessing missing ones', () => {
    for (const [input, expected] of Object.entries({
      'ni3hao3':'nǐ hǎo', 'ni3hao3ma5':'nǐ hǎo ma', 'wan2r':'wánr',
      'wanr2':'wánr', 'lv4':'lǜ', 'lu:4':'lǜ', 'yi1dian3r':'yī diǎnr',
      'beijing3':'bei jǐng', 'yuenan4':'yue nàn', 'nǐ4':'nì', 'yidian3r':'yi diǎnr'
    })) assert.equal(pinyin.fixPinyin(input), expected, input);
    assert.equal(pinyin.numToneToDiacritic('yidian3r'), 'yi diǎnr');
  });
  check('NFC and decomposed Unicode input produce the same pinyin', () => {
    for (const input of ['nǚér','zhōngguó','dehuà','jiānguǎn','lǚ']) {
      assert.equal(pinyin.fixPinyin(input.normalize('NFD')), pinyin.fixPinyin(input));
    }
    assert.deepEqual(pinyin.stripToneMarks('NǙ'.normalize('NFD')), {plain:'Nü',tones:[3]});
  });
  check('punctuation is discarded and unknown words are not split into invalid fragments', () => {
    assert.equal(pinyin.fixPinyin('zhè ， shì 。'), 'zhè shì');
    assert.equal(pinyin.fixPinyin('fpt'), 'fpt');
    assert.equal(pinyin.splitPinyinKeepingErhua('fpt'), null);
    assert.deepEqual(pinyin.splitPinyinSyllables('fpt'), ['fpt']);
    for (const input of ['ng','m','n','r']) assert.equal(pinyin.fixPinyin(input), input);
    assert.equal(pinyin.fixPinyin("xī'ān"), 'xī ān');
  });
})().catch(error => {console.error(error);process.exitCode=1;});
