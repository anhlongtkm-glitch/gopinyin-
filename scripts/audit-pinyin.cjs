'use strict';
// Read-only corpus audit. Writes reports only; never rewrites lesson data.
// Reference setup (from workspace root):
// npm.cmd pack pinyin-pro@3.29.5 --pack-destination .cache --ignore-scripts
// mkdir .cache/pinyin-reference
// tar -xzf .cache/pinyin-pro-3.29.5.tgz -C .cache/pinyin-reference
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const referenceRoot = path.resolve(root, process.argv[2] || '.cache/pinyin-reference/package');
const reference = require(referenceRoot);
const referenceVersion = require(path.join(referenceRoot, 'package.json')).version;
const inputs = new Map();
const source = file => { const text = read(file); inputs.set(file, crypto.createHash('sha256').update(text).digest('hex')); return text; };
const corrections = JSON.parse(source('src/data/pinyin-corrections.json'));
const context = vm.createContext({ console, pinyinCorrections: corrections });
// Evaluate trusted local modules in separate scopes, retaining real exported functions.
// Import wiring is supplied explicitly so the audit needs no browser/account/bootstrap.
function moduleExports(file, names, initialize = '') {
  const code = source(file).replace(/^import .*?;\s*$/gm, '').replace(/\bexport\s+/g, '');
  vm.runInContext(`(function(){${code}\n${initialize};Object.assign(globalThis,{${names.join(',')}});})()`, context, { filename: file });
}
moduleExports('src/data/catalog.js', ['dataCatalogState'], 'initializeDataCatalog()');
moduleExports('src/shared/language/pinyin.js', ['fixPinyin', 'stripToneMarks', 'languagePinyinState'], 'initializeLanguagePinyin()');
moduleExports('src/shared/language/normalization.js', ['normalize']);
moduleExports('src/shared/language/alignment.js', ['alignPinyinToHanzi', 'isHanCharacter', 'isErhuaSyllable']);
moduleExports('src/features/typing/answers.js', ['answerWords']);
moduleExports('src/shared/language/hanzi.js', ['splitChineseByPinyin', 'hanziSegment']);
moduleExports('src/features/ai/validation.js', ['aiItemOk']);
moduleExports('src/features/game/panda-vocabulary.js', ['EXTRA_WORDS', 'NEW_TOPICS']);
moduleExports('src/features/game/panda-content.js', ['TOPICS']);
moduleExports('src/features/journey/content.js', ['readings']);
const vocab = { window: {} };
vm.runInNewContext(source('assets/vocab-pack.js'), vocab);
context.gameSessionState = { HAN: /[㐀-鿿]/ };
moduleExports('src/features/game/words.js', ['sentenceToWords']);

const rows = [];
const add = (group, location, zh, py, vi) => rows.push({ group, location, zh, py: py || '', vi: vi || '' });
for (const [level, entries] of Object.entries(context.dataCatalogState.HSK_DATA)) {
  if (!/^hsk[1-9]$/.test(level) && level !== 'tone_pairs') continue;
  entries.forEach(([zh, py, vi], index) => add(level === 'tone_pairs' ? 'tone-pairs' : 'hsk', `${level}:${index}`, zh, py, vi));
}
for (const [topic, body] of Object.entries(vocab.window.VOCAB_PACK)) {
  body.split(/\r?\n/).forEach((line, index) => { if (line.trim()) add('topics', `${topic}:${index}`, ...line.split('\t')); });
}
for (const topic of context.TOPICS) {
  for (const word of topic.words) add('panda', word.id, word.word, word.py, word.vi);
}
for (const lesson of context.readings) {
  lesson.lines.forEach(([zh, py, vi], index) => add('reading-lines', `${lesson.id}:line:${index}`, zh, py, vi));
  lesson.vocabulary.forEach(([zh, py, vi], index) => add('reading-vocabulary', `${lesson.id}:vocabulary:${index}`, zh, py, vi));
}
for (const [letter, entry] of Object.entries(context.dataCatalogState.LATIN_TO_HANZI)) {
  add('latin-substitution-helper', letter, entry.hz, entry.py, '');
}
const inputRowCount = rows.length;
const legacyPool = new Map();
for (const row of rows.filter(row => row.group === 'hsk')) context.sentenceToWords(row.zh, row.py, row.vi, legacyPool);
for (const word of legacyPool.values()) add('legacy-game-derived', word.word, word.word, word.py, word.vi);

// Unlike the app's tolerant keyboard normalizer, preserve the u / ü distinction.
const base = text => String(text).normalize('NFD').toLowerCase().replace(/u\u0308/g, 'v').replace(/[\u0300-\u036f]/g, '');
const exact = text => String(text).normalize('NFC').toLowerCase();
const alternatives = new Map();
function readingsFor(character) {
  if (!alternatives.has(character)) alternatives.set(character, reference.polyphonic(character, { type: 'array', toneSandhi: false })[0] || []);
  return alternatives.get(character);
}
const summary = {}, issues = [], duplicates = new Map();
for (const row of rows) {
  const stats = summary[row.group] ||= { rows: 0, sourceCorrectionsApplied: 0, alignmentFailures: 0, unknownReferenceRows: 0, unsupportedBaseRows: 0, toneReviewRows: 0, contextDifferenceRows: 0, noDifferenceDetected: 0 };
  stats.rows++;
  const effective = context.answerWords(row).marked;
  const aligned = context.alignPinyinToHanzi(row.zh, effective);
  const issuesHere = [];
  const corrected = corrections[row.zh.trim() + '\t' + row.py.trim()];
  if (corrected) stats.sourceCorrectionsApplied++;
  if (!aligned.complete) {
    stats.alignmentFailures++;
    issuesHere.push({ kind: 'alignment', message: 'Source units and Pinyin cannot be completely aligned.' });
  } else {
    let offset = 0;
    for (const character of row.zh) {
      const index = aligned.map[offset];
      if (context.isHanCharacter(character) && index >= 0) {
        let actual = effective[index];
        const previousIndex = offset > 0 ? aligned.map[offset - 1] : -1;
        // A suffix 儿 shares the base reading; it is not an independent ér.
        const suffix = character === '儿' && previousIndex === index && context.isErhuaSyllable(actual);
        if (!suffix) {
          if (context.isErhuaSyllable(actual) && row.zh.slice(offset + character.length).startsWith('儿')) actual = actual.slice(0, -1);
          const candidates = readingsFor(character);
          if (!candidates.length || candidates.every(candidate => candidate === character)) {
            issuesHere.push({ kind: 'reference-unknown', character, offset, actual });
          } else if (!candidates.some(candidate => base(candidate) === base(actual))) {
            issuesHere.push({ kind: 'unsupported-base', character, offset, actual, candidates });
          } else if (!candidates.some(candidate => exact(candidate) === exact(actual))) {
            issuesHere.push({ kind: 'tone-review', character, offset, actual, candidates });
          }
        }
      }
      offset += character.length;
    }
    if (issuesHere.some(issue => issue.kind === 'unsupported-base')) stats.unsupportedBaseRows++;
    if (issuesHere.some(issue => issue.kind === 'reference-unknown')) stats.unknownReferenceRows++;
    if (issuesHere.some(issue => issue.kind === 'tone-review')) stats.toneReviewRows++;
  }
  // Reference conversion is a triage tool, never a verification certificate.
  const referenceReading = reference.pinyin(row.zh, { type: 'array', toneSandhi: false, nonZh: 'removed' });
  const hanOnly = [...row.zh].every(character => context.isHanCharacter(character) || /[\s\p{P}]/u.test(character));
  if (aligned.complete && hanOnly && exact(effective.join(' ')) !== exact(referenceReading.join(' '))) {
    stats.contextDifferenceRows++;
    issuesHere.push({ kind: 'context-difference', referenceReading });
  }
  if (!issuesHere.length) stats.noDifferenceDetected++;
  else issues.push({ ...row, effective: [...effective], issues: issuesHere });
  if (row.group !== 'legacy-game-derived') {
    const byReading = duplicates.get(row.zh) || new Map();
    const key = exact(effective.join(' '));
    const locations = byReading.get(key) || [];
    locations.push(row.location);
    byReading.set(key, locations);
    duplicates.set(row.zh, byReading);
  }
}
const conflictingDuplicates = [...duplicates].filter(([, readings]) => readings.size > 1).map(([zh, readings]) => ({ zh, readings: [...readings].map(([py, locations]) => ({ py, locations })) }));
const screenshot = { zh: '请确认一下尺寸。', py: 'qǐng qùn rèn yī xià chǐ cùn', vi: 'Vui lòng xác nhận kích thước.' };
const probes = {
  screenshot: { ...screenshot, suppliedReadingIsTranscribedFromImage: true,
    reference: reference.pinyin(screenshot.zh, { toneSandhi: false, nonZh: 'removed' }),
    currentAiValidatorAccepts: context.aiItemOk(screenshot.zh, screenshot.py, screenshot.vi),
    currentAlignmentAccepts: context.alignPinyinToHanzi(screenshot.zh, context.answerWords(screenshot).marked).complete,
    exactSourceMatches: rows.filter(row => row.zh.replace(/\p{P}/gu, '') === screenshot.zh.replace(/\p{P}/gu, '')) },
  erBypass: { zh: '儿子学习汉语', py: 'ér', currentAiValidatorAccepts: context.aiItemOk('儿子学习汉语', 'ér', 'test') },
  standaloneErLegacy: (() => { const pool = new Map();context.sentenceToWords('女儿儿子', 'nǚ ér ér zi', '', pool);return { input: '女儿儿子', derivedPoolSize: pool.size }; })()
};
const report = { generatedAt: new Date().toISOString(), reference: { name: 'pinyin-pro', version: referenceVersion, toneSandhi: false },
  limitations: ['Flags are candidates for review, not confirmed errors.', 'Matching a reference does not verify context or meaning.', 'Personal/cloud/AI-saved datasets were not accessed.', 'Source row counts include repeated content; legacy-game-derived is counted separately.'],
  inputHashes: Object.fromEntries(inputs), inputRowCount, derivedRowCount: rows.length - inputRowCount, summary, probes, conflictingDuplicates, issues };
const output = path.join(root, '.cache/pinyin-full-audit.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ inputRowCount, derivedRowCount: report.derivedRowCount, summary, conflictingDuplicateTexts: conflictingDuplicates.length, probes, output }, null, 2));
