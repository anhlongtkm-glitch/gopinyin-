import { TOPICS, getTopic, plainPinyin } from './panda-content.js';

export const CAMPAIGN_VERSION = 'v2';
const SUPPORT = `我|wǒ|Tôi
你|nǐ|Bạn
他|tā|Anh ấy
我们|wǒ men|Chúng tôi
的|de|Của
是|shì|Là
有|yǒu|Có
在|zài|Ở; tại
和|hé|Và
很|hěn|Rất
不|bù|Không
了|le|Rồi
吗|ma|Không? (từ hỏi)
爱|ài|Yêu
喝|hē|Uống
吃|chī|Ăn
喜欢|xǐ huan|Thích
看|kàn|Xem; ngắm
去|qù|Đi
想|xiǎng|Muốn
要|yào|Muốn; cần
坐|zuò|Ngồi; đi bằng
一起|yì qǐ|Cùng nhau
大|dà|To; lớn
小|xiǎo|Nhỏ
这|zhè|Đây; này
那|nà|Kia; đó
一杯|yì bēi|Một cốc
多少|duō shao|Bao nhiêu
钱|qián|Tiền
请|qǐng|Xin; mời
给|gěi|Cho
谢谢|xiè xie|Cảm ơn
帮助|bāng zhù|Giúp đỡ
忙|máng|Bận
累|lèi|Mệt
疼|téng|Đau
洗|xǐ|Rửa
到了|dào le|Đã đến
可以|kě yǐ|Có thể
好|hǎo|Tốt; đẹp
多|duō|Nhiều
北京|běi jīng|Bắc Kinh
教|jiāo|Dạy
家|jiā|Nhà
好看|hǎo kàn|Đẹp
问|wèn|Hỏi
哪里|nǎ lǐ|Ở đâu
打篮球|dǎ lán qiú|Chơi bóng rổ
看病|kàn bìng|Khám bệnh
只|zhī|Lượng từ chỉ con vật
小鸟|xiǎo niǎo|Chim nhỏ
这个|zhè ge|Cái này`;
const vocabulary = new Map(TOPICS.flatMap(topic => topic.words).map(word => [word.word, word]));
for (const row of SUPPORT.split('\n')) {
  const [word, py, vi] = row.split('|');
  vocabulary.set(word, { word, py, vi, pyPlain:plainPinyin(py) });
}
// Common everyday sentences, assembled only after their vocabulary has been learned.
const SENTENCES = {
  family:[['我 爱 妈妈','Tôi yêu mẹ.'],['这 是 我 的 爸爸','Đây là bố của tôi.'],['我 和 家人 一起 回家','Tôi về nhà cùng người thân.']],
  drinks:[['我 喝 水','Tôi uống nước.'],['我 想 喝 咖啡','Tôi muốn uống cà phê.'],['请 给 我 一杯 茶','Làm ơn cho tôi một cốc trà.']],
  food:[['我 吃 米饭','Tôi ăn cơm.'],['我 喜欢 吃 面条','Tôi thích ăn mì.'],['我们 一起 去 餐厅','Chúng tôi cùng đến nhà hàng.']],
  school:[['我 是 学生','Tôi là học sinh.'],['我 在 学校 学习','Tôi học ở trường.'],['老师 教 我们 中文','Giáo viên dạy chúng tôi tiếng Trung.']],
  time:[['现在 是 早上','Bây giờ là buổi sáng.'],['我 今天 不 忙','Hôm nay tôi không bận.'],['我们 明天 一起 去 学校','Ngày mai chúng tôi cùng đến trường.']],
  animals:[['我 喜欢 猫','Tôi thích mèo.'],['我 家 有 狗','Nhà tôi có chó.'],['你 看 那 只 小鸟','Bạn nhìn con chim nhỏ kia kìa.']],
  nature:[['我 喜欢 看 月亮','Tôi thích ngắm trăng.'],['这 花 很 好看','Bông hoa này rất đẹp.'],['我们 一起 去 看 海','Chúng tôi cùng đi ngắm biển.']],
  weather:[['今天 很 热','Hôm nay rất nóng.'],['今天 下雨 了','Hôm nay trời mưa rồi.'],['明天 天气 好 吗','Thời tiết ngày mai có đẹp không?']],
  sports:[['我 喜欢 跑步','Tôi thích chạy bộ.'],['我们 一起 打篮球','Chúng tôi cùng chơi bóng rổ.'],['今天 我 想 去 游泳','Hôm nay tôi muốn đi bơi.']],
  body:[['我 的 头 疼','Tôi đau đầu.'],['请 洗 手','Hãy rửa tay.'],['我 的 眼睛 很 累','Mắt tôi rất mỏi.']],
  health:[['我 想 看 医生','Tôi muốn gặp bác sĩ.'],['你 要 多 喝 水','Bạn cần uống nhiều nước.'],['我 今天 去 医院 看病','Hôm nay tôi đến bệnh viện khám bệnh.']],
  shopping:[['这个 多少 钱','Cái này bao nhiêu tiền?'],['我 想 买 衣服','Tôi muốn mua quần áo.'],['我们 去 超市 买 水果','Chúng tôi đến siêu thị mua trái cây.']],
  travel:[['我 想 去 北京','Tôi muốn đến Bắc Kinh.'],['我们 坐 火车 去 旅行','Chúng tôi đi du lịch bằng tàu hỏa.'],['请 问 车站 在 哪里','Xin hỏi nhà ga ở đâu?']],
  work:[['我 在 公司 工作','Tôi làm việc ở công ty.'],['我 今天 有 会议','Hôm nay tôi có cuộc họp.'],['谢谢 你 的 帮助','Cảm ơn sự giúp đỡ của bạn.']]
};
const ORDER = ['family','drinks','food','school','time','animals','nature','weather','sports','body','health','shopping','travel','work'];
const lessons = new Map();
export const LEVELS = Object.freeze(ORDER.map((baseId, index) => {
  const base = getTopic(baseId), id = index + 1;
  const topics = SENTENCES[baseId].map(([sentence, vi], part) => {
    const topicId = part ? baseId + '-' + (part + 1) : baseId;
    const tiles = sentence.split(' ').map(word => {
      const source = vocabulary.get(word);
      if (!source) throw new Error('Missing campaign vocabulary: ' + word);
      return { ...source, id:baseId + ':' + word };
    });
    const start = Math.floor(part * base.words.length / 3), end = Math.floor((part + 1) * base.words.length / 3);
    const words = [...new Map([...base.words.slice(start, end), ...tiles].map(word => [word.id, word])).values()];
    const topic = { ...base, id:topicId, label:vi.replace(/[.!?]$/, ''), subtitle:base.label + ' · Chủ đề ' + (part + 1), words };
    lessons.set(topicId, { topic, baseId, levelId:id, words, boss:{ vi, tiles } });
    return topicId;
  });
  const wordCount = new Set(topics.flatMap(topicId => lessons.get(topicId).words.map(word => word.word))).size;
  return Object.freeze({ id, name:base.label, difficulty:id <= 4 ? 'Cơ bản' : id <= 9 ? 'Vận dụng' : 'Nâng cao', topics, wordCount, timeScale:1 - index * 0.008 });
}));
export function lessonFor(topicId) {
  const lesson = lessons.get(topicId) || lessons.get('family');
  return { ...lesson, level:LEVELS[lesson.levelId - 1] };
}
export function getCampaignTopic(topicId) {
  const lesson = lessonFor(topicId), level = lesson.level, base = getTopic(lesson.baseId);
  const words = [...new Map(level.topics.flatMap(id => [...lessons.get(id).boss.tiles, ...lessons.get(id).words]).map(word => [word.word, word])).values()];
  return { ...base, words, levelId:level.id, label:level.name };
}
export const levelFor = topicId => lessonFor(topicId).level;
export function levelProgress(progress, topicId) {
  const topic = getCampaignTopic(topicId);
  const rows = levelFor(topicId).topics.map(id => progress?.[id]);
  const learned = new Set(rows.flatMap(row => Array.isArray(row?.learned) ? row.learned : []));
  const processed = new Set(rows.flatMap(row => [...(Array.isArray(row?.processed) ? row.processed : []), ...(Array.isArray(row?.learned) ? row.learned : [])]));
  return { learned:topic.words.filter(word => learned.has(word.id)).map(word => word.id), processed:topic.words.filter(word => processed.has(word.id)).map(word => word.id) };
}
export function levelPassed(progress, topicId) {
  return levelProgress(progress, topicId).processed.length === getCampaignTopic(topicId).words.length;
}
export function recordLevel(progress, topicId, completed, processed) {
  const topic = getCampaignTopic(topicId), previous = levelProgress(progress, topic.id);
  const valid = new Set(topic.words.map(word => word.id));
  return { ...progress, [topic.id]:{
    learned:[...new Set([...previous.learned, ...completed.filter(id => valid.has(id))])],
    processed:[...new Set([...previous.processed, ...processed.filter(id => valid.has(id))])]
  } };
}
export function levelUnlocked(progress, levelId) {
  return LEVELS.filter(level => level.id < levelId).every(level => levelPassed(progress, level.topics[0]));
}
export function nextTopic(progress) {
  return LEVELS.find(level => !levelPassed(progress, level.topics[0]))?.topics[0] || 'family';
}
