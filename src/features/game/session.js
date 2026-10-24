// State and behavior owned by features/game/session. Initialization is orchestrated by app/bootstrap.js.

export const state = {};

const gameSessionState = state;

/* Chủ đề ngẫu nhiên (KHÁC chủ đề đang có) */
export function randTheme(exclude) {
  if (gameSessionState.THEMES.length < 2) return 0;
  let i;
  do {
    i = Math.floor(Math.random() * gameSessionState.THEMES.length);
  } while (i === exclude);
  return i;
}

/* ü được gõ bằng "v" (quy ước pinyin: 女 nǚ → "nv"). Vẫn chấp nhận "u"
   tương đương "v" khi đích là ü để người quen gõ cũ không bị kẹt. */

export function initializeGameSession() {
  gameSessionState.$ = id => document.getElementById(id);
  gameSessionState.HAN = /[㐀-鿿]/;
  gameSessionState.stage = gameSessionState.$('gameCard');
  gameSessionState.playField = gameSessionState.$('gaStage') || gameSessionState.$('gameCard');
  // vùng vẽ thật (canvas nằm trong đây)
  gameSessionState.shipSvg = gameSessionState.$('gaShipSvg');
  gameSessionState.canvas = gameSessionState.$('gaCanvas');
  gameSessionState.ctx = gameSessionState.canvas.getContext('2d');
  gameSessionState.W = 600;
  gameSessionState.H = 400;
  gameSessionState.dpr = 1;
  gameSessionState.state = {
    level: 2,
    running: false,
    paused: false,
    suspended: false,
    resumeReady: false,
    speed: 3,
    sfx: true,
    maxConcurrent: 3,
    score: 0,
    lives: 5,
    maxLives: 10,
    combo: 0,
    bestCombo: 0,
    wordsDone: 0,
    showPinyin: false,
    shipAngle: 0,
    items: [],
    particles: [],
    bullets: [],
    floats: [],
    bg: [],
    pool: [],
    poolIdx: 0,
    buffer: '',
    locked: null,
    skipped: new Set(),
    spawnAcc: 0,
    lastT: 0,
    rafId: 0,
    flashRed: 0,
    uid: 1,
    /* ★ stageWords = số từ đã bắn TRONG chặng hiện tại. Trước đây tiến độ chặng
       được suy ra từ wordsDone (reset về 0 mỗi ván) nên khi khôi phục chặng cũ
       (vd chặng 5) thì wordsDone không bao giờ vượt 5*30 → chặng KẸT vĩnh viễn.
       over = đã báo hết mạng (chặn gameOver() bắn nhiều lần). */
    stageWords: 0,
    over: false,
    stage: 1,
    themeIdx: 0,
    banner: null,
    scene: null
  };
  gameSessionState.SPEED_LABEL = {
    1: 'Siêu chậm',
    2: 'Rất chậm',
    3: 'Chậm',
    4: 'Vừa',
    5: 'Vừa',
    6: 'Khá',
    7: 'Khá',
    8: 'Nhanh',
    9: 'Nhanh',
    10: 'Siêu nhanh'
  };
  /* ★ Chặng (stage): mỗi chặng = STAGE_SIZE từ. Qua chặng → đổi cả nền game.
     Mỗi nền là một PHONG CẢNH riêng (thành phố mưa, núi tuyết, vũ trụ, rừm thu,
     hoàng hôn, biển đêm, hoa anh đào, thành phố neon) + hạt rơi tương ứng.
     Chủ đề được RANDOM khi mở game và khi đổi chặng (khác chủ đề trước đó).
     Nền luôn TỐI (chủ đạo tối) dù app đang sáng hay tối. */
  gameSessionState.STAGE_SIZE = 30;
  gameSessionState.THEMES = [{
    id: 'rain',
    bg1: '#0a1228',
    bg2: '#0d1a35',
    scene: 'city',
    part: 'rain'
  }, {
    id: 'snow',
    bg1: '#0b1430',
    bg2: '#122a44',
    scene: 'mountain',
    part: 'snow'
  }, {
    id: 'space',
    bg1: '#05050f',
    bg2: '#140b2a',
    scene: 'planet',
    part: 'star'
  }, {
    id: 'autumn',
    bg1: '#1a1005',
    bg2: '#2c1a09',
    scene: 'forest',
    part: 'leaf'
  }, {
    id: 'dusk',
    bg1: '#241029',
    bg2: '#4a2340',
    scene: 'sunset',
    part: 'dust'
  }, {
    id: 'sea',
    bg1: '#04101c',
    bg2: '#07263a',
    scene: 'sea',
    part: 'dust'
  }, {
    id: 'sakura',
    bg1: '#1a0a18',
    bg2: '#33132c',
    scene: 'sakura',
    part: 'petal'
  }, {
    id: 'neon',
    bg1: '#0a0716',
    bg2: '#1a0a2e',
    scene: 'neon',
    part: 'dust'
  }];
}
