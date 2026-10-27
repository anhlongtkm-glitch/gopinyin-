import { escapeHtml as safe } from '../../shared/utils.js';

export function readingMarkup(reading) {
  const count = reading.questions.length;
  const required = Math.ceil(count*2/3);
  return `<button class="btn ghost" type="button" id="readingBack">← Danh sách bài</button>
    <div class="readingLessonLayout"><div class="journeyPanel readingMain">
      <span class="featureEyebrow">BÀI KHÓA HSK ${reading.level} · ${safe(reading.topic)}</span>
      <div class="readingLessonGreeting"><span data-mascot="reading" data-mascot-size="inline" aria-hidden="true"></span><div><h3 tabindex="-1" id="readingHeading">${safe(reading.title)}</h3><p><span id="readingLineCount">${reading.lines.length} lượt thoại</span> · Nghe và đọc, rồi luyện chính những câu vừa học.</p></div></div>
      <div class="readingTools"><button type="button" class="btn secondary" id="readingListen">Nghe toàn bài</button><button type="button" class="btn secondary" id="readingStop">Dừng nghe</button><button type="button" class="btn secondary" data-reading-toggle="pinyin" aria-pressed="true">Pinyin</button><button type="button" class="btn secondary" data-reading-toggle="meaning" aria-pressed="true">Nghĩa</button></div>
      ${reading.lines.map(([zh,py,vi,speaker],index) => `<div class="readingLine"><span class="readingLineNumber">${String(index+1).padStart(2,'0')}</span><div><span class="readingSpeaker">${safe(speaker)}</span><p lang="zh-CN">${safe(zh)}</p><p class="readingPinyin">${safe(py)}</p><p class="readingMeaning">${safe(vi)}</p></div><button type="button" class="btn ghost" data-reading-line="${index}" aria-label="Nghe lượt thoại ${index+1} của ${safe(speaker)}">Nghe</button></div>`).join('')}
      <div class="readingComprehension"><span class="featureEyebrow">HIỂU BÀI · ${count} CÂU HỎI</span><p>Đúng ít nhất ${required}/${count} câu để hoàn thành. Có thể luyện lại.</p><form id="readingQuiz">
        ${reading.questions.map(([question,options],index) => `<fieldset><legend>${index+1}. ${safe(question)}</legend>${options.map((option,optionIndex) => `<label class="journeyOption"><input type="radio" name="q${index}" value="${optionIndex}" required> ${safe(option)}</label>`).join('')}</fieldset>`).join('')}
        <button class="btn primary" type="submit">Kiểm tra câu trả lời</button><p id="readingResult" role="status"></p>
      </form></div>
      <footer class="readingNextActions"><button type="button" class="btn primary" data-reading-practice="${safe(reading.id)}">Gõ các câu trong bài →</button></footer>
    </div><aside><section class="journeyPanel readingNotes"><span class="featureEyebrow">TỪ CẦN NHỚ</span>
      ${(reading.vocabulary||[]).map(([zh,py,vi]) => `<div><b lang="zh-CN">${safe(zh)}</b><span>${safe(py)}</span><small>${safe(vi)}</small></div>`).join('')}
    </section><section class="journeyCoach"><span class="featureEyebrow">MẸO ĐỌC BÀI</span><h3>Đọc chậm. Hiểu từng câu.</h3><p>Nghe mẫu, đối chiếu Pinyin rồi thử đọc lại mà không nhìn phiên âm. Chọn từng lượt thoại để nghe lại.</p></section></aside></div>`;
}
