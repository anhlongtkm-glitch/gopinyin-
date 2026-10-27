// Character offsets and syllable indices are independent of visual word groups.
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}]/u;
const UNITS = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{3ffff}]|[A-Za-z0-9]+/gu;

export function isHanCharacter(character) { return HAN.test(character || ''); }

export function isErhuaSyllable(syllable) {
  const plain = String(syllable || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return plain !== 'er' && /[aeiou](?:n|ng)?r$/.test(plain);
}

export function alignPinyinToHanzi(text, syllables) {
  const source = String(text || '');
  const units = [...source.matchAll(UNITS)].map(match => ({text:match[0],start:match.index,end:match.index+match[0].length}));
  const map = Array(source.length).fill(-1);
  let next = 0, complete = true;
  const assign = (unit,index) => { for(let offset=unit.start;offset<unit.end;offset++)map[offset]=index; };
  for(let index=0;index<units.length;index++) {
    const unit=units[index];
    if(!isHanCharacter(unit.text)) {
      if(String(syllables[next] || '').toLowerCase()===unit.text.toLowerCase())assign(unit,next++);
      continue;
    }
    if(!syllables[next]) { complete=false; continue; }
    assign(unit,next);
    const following=units[index+1];
    // A full ér is a separate syllable. Only a real suffix next to 儿 shares it.
    if(isErhuaSyllable(syllables[next]) && following?.text==='儿' && /^\s*$/.test(source.slice(unit.end,following.start))) {
      assign(following,next);
      index++;
    }
    next++;
  }
  complete = complete && next===syllables.length;
  // Do not fabricate per-character readings when the source has missing syllables.
  if(!complete)map.fill(-1);
  const hanIndices=units.filter(unit=>isHanCharacter(unit.text)).map(unit=>map[unit.start]);
  return {map,hanIndices,complete};
}
