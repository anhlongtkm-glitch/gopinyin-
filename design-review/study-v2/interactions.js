/* Isolated approval prototype only. No live API, progress, authentication or microphone access. */
(function () {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const query = new URLSearchParams(window.location.search);
  const samples = [
    { han: '今天很开心。', pinyin: ['jīn', 'tiān', 'hěn', 'kāi', 'xīn'], meaning: 'Hôm nay tôi rất vui.' },
    { han: '我想喝一杯热茶。', pinyin: ['wǒ', 'xiǎng', 'hē', 'yì', 'bēi', 'rè', 'chá'], meaning: 'Tôi muốn uống một cốc trà nóng.' },
    { han: '我们一起学习吧。', pinyin: ['wǒ', 'men', 'yì', 'qǐ', 'xué', 'xí', 'ba'], meaning: 'Chúng ta cùng học nhé.' },
  ];
  const modes = {
    typing: { index: 0, draft: '', correct: false, pinyin: false, recording: false },
    pron: { index: 0, draft: '', correct: false, pinyin: true, recording: false },
  };
  let mode = query.get('mode') === 'pron' ? 'pron' : 'typing';
  let composing = false;
  let focusBeforeOptions = null;
  let selectionBeforeOptions = null;
  let sampleTimer = null;
  let listening = false;
  let initialized = false;
  const state = () => modes[mode];
  const current = () => samples[state().index];
  const setText = (id, value) => { const node = byId(id); if (node) node.textContent = value; };
  const setPressed = (node, value) => { if (node) node.setAttribute('aria-pressed', String(value)); };
  const stripPunctuation = (value) => value.normalize('NFKC').replace(/[\p{P}\s]/gu, '');

  if (query.has('pinyin')) state().pinyin = query.get('pinyin') === '1';
  if (query.get('state') === 'correct') {
    state().correct = true;
    if (mode === 'typing') state().draft = current().han;
  }

  function updateDisplay() {
    const showHan = byId('opt-han') ? byId('opt-han').checked : true;
    const showVi = byId('opt-vi') ? byId('opt-vi').checked : true;
    document.body.classList.toggle('hide-han', !showHan);
    document.body.classList.toggle('hide-pinyin', !state().pinyin);
    document.body.classList.toggle('hide-vi', !showVi);
    if (byId('opt-pinyin')) byId('opt-pinyin').checked = state().pinyin;
    setPressed(byId('quick-pinyin'), state().pinyin);
    setText('pinyin-label', state().pinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin');
    if (byId('quick-pinyin')) byId('quick-pinyin').title = state().pinyin ? 'Ẩn gợi ý Pinyin' : 'Hiện gợi ý Pinyin';
  }

  function updateFeedback() {
    const value = state();
    const strip = byId('feedback-strip');
    if (strip) strip.dataset.state = value.recording ? 'recording' : value.correct ? 'correct' : 'neutral';
    setText('accuracy-value', value.correct ? '100%' : '96%');
    setText('streak-value', value.correct ? '13' : '12');

    if (mode === 'typing') {
      setText('typing-input-state', value.correct ? 'Chính xác · Bạn đã gõ đúng cả câu' : value.draft ? 'Đang nhập · Tự kiểm tra khi hoàn thành' : 'Gõ chữ Hán · Tự kiểm tra khi hoàn thành');
      setText('feedback-text', value.correct ? 'Chính xác! Sẵn sàng sang câu tiếp theo.' : 'Cứ từ từ nhé. Bạn có thể bật Pinyin khi cần.');
      setText('coach-title', value.correct ? 'Bạn làm tốt lắm!' : 'Mỗi câu, một bước tiến.');
      setText('coach-copy', value.correct ? 'Giữ nhịp học và thử câu tiếp theo nhé.' : 'Gõ lại câu tiếng Trung. Mình luôn ở đây khi bạn cần gợi ý.');
    } else {
      setText('pron-label', value.recording ? 'Dừng & xem kết quả' : value.correct ? 'Nói lại' : 'Bắt đầu nói');
      setText('pron-state', value.recording ? 'Đang ghi âm · Nhấn để kết thúc' : value.correct ? 'Rõ ràng lắm! · 92 / 100' : 'Sẵn sàng · Nhấn micro để bắt đầu');
      setText('feedback-text', value.recording ? 'Mình đang lắng nghe. Hãy đọc câu phía trên.' : value.correct ? 'Phát âm tốt! Bạn có thể luyện lại hoặc sang câu tiếp theo.' : 'Nghe mẫu trước, rồi đọc thật tự nhiên nhé.');
      setText('coach-title', value.correct ? 'Giọng đọc thật tự tin!' : value.recording ? 'Mình đang lắng nghe.' : 'Tự tin nói từng câu.');
      setText('coach-copy', value.correct ? 'Bạn đã hoàn thành lượt luyện này. Tiếp tục khi sẵn sàng.' : value.recording ? 'Đọc chậm, rõ và kết thúc khi bạn sẵn sàng.' : 'Nghe mẫu, đọc theo và xem phản hồi ngay tại đây.');
      setPressed(byId('pron-action'), value.recording);
      if (byId('pron-action')) byId('pron-action').dataset.state = value.recording ? 'recording' : value.correct ? 'correct' : 'ready';
    }
    if (byId('next-btn')) {
      byId('next-btn').disabled = mode === 'typing' && !value.correct;
      byId('next-btn').title = mode === 'typing' && !value.correct ? 'Hoàn thành câu để tiếp tục' : 'Chuyển đến câu tiếp theo';
    }
    if (byId('typing-answer')) byId('typing-answer').classList.toggle('is-correct', value.correct && mode === 'typing');
  }

  function renderSentence() {
    const host = byId('sentence-pairs');
    if (host) {
      const fragment = document.createDocumentFragment();
      let pinyinIndex = 0;
      Array.from(current().han).forEach((character) => {
        const isHan = /\p{Script=Han}/u.test(character);
        const node = document.createElement(isHan ? 'button' : 'span');
        node.className = isHan ? 'char-pair' : 'char-pair is-punctuation';
        if (isHan) node.type = 'button';
        const han = document.createElement('span');
        han.className = 'char-han';
        han.textContent = character;
        const py = document.createElement('span');
        py.className = 'char-py';
        py.textContent = isHan ? current().pinyin[pinyinIndex++] : '\u00a0';
        node.append(han, py);
        if (isHan) {
          node.setAttribute('aria-label', character + ', ' + py.textContent);
          node.title = character + ' · ' + py.textContent;
          node.addEventListener('click', () => {
            host.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'));
            node.classList.add('is-active');
          });
        } else node.setAttribute('aria-hidden', 'true');
        fragment.appendChild(node);
      });
      host.replaceChildren(fragment);
    }
    setText('meaning-text', current().meaning);
    setText('lesson-counter', String(7 + state().index).padStart(2, '0') + ' / 20');
    const progress = byId('progress-fill');
    if (progress) progress.style.width = ((7 + state().index) * 5) + '%';
    const progressBar = progress && progress.closest('[role="progressbar"]');
    if (progressBar) progressBar.setAttribute('aria-valuenow', String(7 + state().index));
    if (byId('typing-answer')) byId('typing-answer').value = state().draft;
    updateDisplay();
    updateFeedback();
  }

  function stopListening() {
    window.clearTimeout(sampleTimer);
    listening = false;
    setPressed(byId('listen-btn'), false);
    setText('listen-label', 'Nghe mẫu');
  }

  function setMode(nextMode) {
    if (nextMode !== 'typing' && nextMode !== 'pron') return;
    if (initialized && byId('typing-answer') && mode === 'typing') state().draft = byId('typing-answer').value;
    state().recording = false;
    stopListening();
    mode = nextMode;
    document.body.dataset.mode = mode;
    document.querySelectorAll('[data-mode-link]').forEach((button) => {
      const selected = button.dataset.modeLink === mode;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    setText('view-title', mode === 'typing' ? 'Luyện gõ' : 'Luyện phát âm');
    setText('course-title', 'HSK 2 · Giao tiếp hằng ngày');
    renderSentence();
    initialized = true;
  }

  function moveSentence(direction) {
    stopListening();
    const value = state();
    value.index = (value.index + direction + samples.length) % samples.length;
    value.draft = '';
    value.correct = false;
    value.recording = false;
    composing = false;
    renderSentence();
    if (mode === 'typing' && byId('typing-answer')) byId('typing-answer').focus({ preventScroll: true });
  }

  function checkTyping() {
    const input = byId('typing-answer');
    if (!input || composing || mode !== 'typing') return;
    state().draft = input.value;
    state().correct = stripPunctuation(input.value) === stripPunctuation(current().han);
    updateFeedback();
  }

  document.querySelectorAll('[data-mode-link]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      setMode(button.dataset.modeLink);
    });
  });
  const input = byId('typing-answer');
  if (input) {
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; checkTyping(); });
    input.addEventListener('input', checkTyping);
    input.addEventListener('keydown', (event) => {
      if (composing || event.isComposing || event.keyCode === 229) return;
      if (state().correct && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        moveSentence(1);
      }
    });
  }
  if (byId('next-btn')) byId('next-btn').addEventListener('click', () => { if (!byId('next-btn').disabled) moveSentence(1); });
  if (byId('prev-btn')) byId('prev-btn').addEventListener('click', () => moveSentence(-1));
  if (byId('skip-btn')) byId('skip-btn').addEventListener('click', () => moveSentence(1));
  if (byId('retry-btn')) byId('retry-btn').addEventListener('click', () => {
    state().draft = '';
    state().correct = false;
    state().recording = false;
    if (input) input.value = '';
    updateFeedback();
    if (mode === 'typing' && input) input.focus({ preventScroll: true });
  });
  if (byId('quick-pinyin')) byId('quick-pinyin').addEventListener('click', () => {
    state().pinyin = !state().pinyin;
    updateDisplay();
  });
  if (byId('pron-action')) byId('pron-action').addEventListener('click', () => {
    if (mode !== 'pron') return;
    stopListening();
    if (state().recording) {
      state().recording = false;
      state().correct = true;
    } else {
      state().correct = false;
      state().recording = true;
    }
    updateFeedback();
  });
  if (byId('listen-btn')) byId('listen-btn').addEventListener('click', () => {
    if (listening) { stopListening(); return; }
    listening = true;
    setPressed(byId('listen-btn'), true);
    setText('listen-label', 'Đang nghe mẫu…');
    sampleTimer = window.setTimeout(stopListening, 1600);
  });

  ['opt-han', 'opt-pinyin', 'opt-vi'].forEach((id) => {
    const checkbox = byId(id);
    if (checkbox) checkbox.addEventListener('change', () => {
      if (id === 'opt-pinyin') state().pinyin = checkbox.checked;
      updateDisplay();
    });
  });

  function selectOptionsTab(name, focus) {
    const tabs = Array.from(document.querySelectorAll('[data-options-tab]'));
    if (!tabs.some((tab) => tab.dataset.optionsTab === name)) name = 'display';
    tabs.forEach((tab) => {
      const selected = tab.dataset.optionsTab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.classList.toggle('is-active', selected);
      if (selected && focus) tab.focus();
    });
    document.querySelectorAll('[data-options-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.optionsPanel !== name;
    });
  }
  const tabs = Array.from(document.querySelectorAll('[data-options-tab]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectOptionsTab(tab.dataset.optionsTab, false));
    tab.addEventListener('keydown', (event) => {
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      selectOptionsTab(tabs[target].dataset.optionsTab, true);
    });
  });

  const dialog = byId('lesson-options');
  const optionsTrigger = byId('options-trigger');
  function captureFocus() {
    focusBeforeOptions = document.activeElement;
    selectionBeforeOptions = input && focusBeforeOptions === input ? [input.selectionStart, input.selectionEnd] : null;
  }
  function openOptions() {
    if (!dialog || dialog.open) return;
    if (!focusBeforeOptions || !focusBeforeOptions.isConnected) captureFocus();
    if (mode === 'pron' && state().recording) {
      state().recording = false;
      state().correct = true;
      updateFeedback();
    }
    dialog.showModal();
  }
  function closeOptions() { if (dialog && dialog.open) dialog.close(); }
  if (optionsTrigger) {
    optionsTrigger.addEventListener('pointerdown', captureFocus);
    optionsTrigger.addEventListener('click', () => { if (!focusBeforeOptions) captureFocus(); openOptions(); });
  }
  ['options-close', 'options-done'].forEach((id) => { if (byId(id)) byId(id).addEventListener('click', closeOptions); });
  if (dialog) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeOptions();
    });
    dialog.addEventListener('close', () => {
      const target = focusBeforeOptions && focusBeforeOptions.isConnected ? focusBeforeOptions : optionsTrigger;
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
      if (selectionBeforeOptions && input) input.setSelectionRange(selectionBeforeOptions[0], selectionBeforeOptions[1]);
      focusBeforeOptions = null;
      selectionBeforeOptions = null;
    });
  }

  selectOptionsTab(query.get('settings') || 'display', false);
  setMode(mode);
  if (['display', 'audio', 'lesson'].includes(query.get('settings'))) window.requestAnimationFrame(openOptions);
})();
