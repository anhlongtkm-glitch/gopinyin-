// State and behavior owned by features/pronunciation/session. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const pronunciationSessionState = state;

export function initializePronunciationSession() {
  /* ── Hằng số ── */
  pronunciationSessionState.GOOD = 75;
  // ngưỡng "phát âm tốt" (thang 100)
  pronunciationSessionState.MIN_CONF = 0.55;
  // dưới ngưỡng này → coi là "chưa đủ dữ liệu"
  pronunciationSessionState.MAX_MS = 15000;
  // tự dừng ghi âm sau 15 giây
  pronunciationSessionState.SILENCE_MS = 1600;
  // im lặng bao lâu thì tự kết thúc câu
  pronunciationSessionState.SILENCE_RMS = 0.018;
  // ngưỡng coi là "có tiếng"
  pronunciationSessionState.STORE_PREFIX = 'gp:pron:v1:';
  pronunciationSessionState.SETTINGS_KEY = 'gp:pron:settings';
  pronunciationSessionState.RECENT_MAX = 60;
  // số lượt nói giữ lại để tính chuỗi
  pronunciationSessionState.TONE_TIP = {
    1: 'Thanh 1 — cao và ngang, giữ đều giọng.',
    2: 'Thanh 2 — giọng đi lên như đang hỏi lại.',
    3: 'Thanh 3 — hạ thấp rồi nâng lên (xuống rồi lên).',
    4: 'Thanh 4 — giọng đi xuống dứt khoát.',
    0: 'Thanh nhẹ — đọc nhẹ và ngắn, không nhấn.'
  };
  pronunciationSessionState.TONE_MARK = {
    'ā': 1,
    'á': 2,
    'ǎ': 3,
    'à': 4,
    'ē': 1,
    'é': 2,
    'ě': 3,
    'è': 4,
    'ī': 1,
    'í': 2,
    'ǐ': 3,
    'ì': 4,
    'ō': 1,
    'ó': 2,
    'ǒ': 3,
    'ò': 4,
    'ū': 1,
    'ú': 2,
    'ǔ': 3,
    'ù': 4,
    'ǖ': 1,
    'ǘ': 2,
    'ǚ': 3,
    'ǜ': 4
  };
  /* ── Trạng thái ── */
  pronunciationSessionState.S = {
    ready: false,
    items: [],
    // [{id, zh, py, vi}]
    order: [],
    // chỉ số theo bộ lọc
    index: 0,
    source: 'current',
    sources: [],
    settings: {
      rate: 1,
      voice: '',
      autoSample: true,
      autoNext: false,
      showPy: true,
      showHan: true,
      showVi: true,
      filter: 'all'
    },
    phase: 'idle',
    // idle|requesting|starting|recording|analyzing|result|error
    result: null,
    detailIdx: -1,
    sessionTries: 0,
    lastError: '',
    /* runtime */
    stream: null,
    rec: null,
    recDone: null,
    chunks: [],
    blobUrl: '',
    actx: null,
    analyser: null,
    freq: null,
    raf: 0,
    hasSpeech: false,
    lastLoud: 0,
    startedAt: 0,
    timer: 0,
    maxTimer: 0,
    silenceTimer: 0,
    asr: null,
    asrText: '',
    asrInterim: '',
    asrDiagnostics: null,
    asrConf: null,
    asrErr: '',
    asrDone: null,
    busy: false,
    record: null,
    // record = kết quả chấm của lượt hiện tại
    progress: null,
    serverAssess: null // {ok:bool, note:string} — dò 1 lần
  };
}
