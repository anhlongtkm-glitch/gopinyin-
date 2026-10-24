import { initializeDataCatalog } from "../data/catalog.js";
import { initializeDom } from "../shared/dom.js";
import { initializeStorageLessonRepository } from "../shared/storage/lesson-repository.js";
import { initializeTypingSession } from "../features/typing/session.js";
import { initializeStorageLessonRepository2 } from "../shared/storage/lesson-repository.js";
import { initializeTypingHistoryState } from "../features/typing/history.js";
import { initializeStorageLessonRepository3 } from "../shared/storage/lesson-repository.js";
import { initializeLanguageNormalization } from "../shared/language/normalization.js";
import { initializeTypingWeakness } from "../features/typing/weakness.js";
import { initializeTheme } from "../shared/theme.js";
import { initializeModal } from "../shared/modal.js";
import { initializeLibraryController } from "../features/library/controller.js";
import { initializeAiSavedSets } from "../features/ai/saved-sets.js";
import { initializeLibraryCatalog } from "../features/library/catalog.js";
import { initializeAiProviders } from "../features/ai/providers.js";
import { initializeAiSession } from "../features/ai/session.js";
import { initializeAiClient } from "../features/ai/client.js";
import { initializeLanguagePinyin } from "../shared/language/pinyin.js";
import { initializeAiValidation } from "../features/ai/validation.js";
import { initializeStorageImportFiles } from "../shared/storage/import-files.js";
import { initializeTypingDatasets } from "../features/typing/datasets.js";
import { initializeTypingHistory } from "../features/typing/history.js";
import { initializeTypingInput } from "../features/typing/input.js";
import { initializeAudioTypingSfx } from "../shared/audio/typing-sfx.js";
import { initializeTypingControls } from "../features/typing/controls.js";
import { initializeTypingNavigation } from "../features/typing/navigation.js";
import { initializeAiController } from "../features/ai/controller.js";
import { initializeTypingEvents } from "../features/typing/events.js";
import { initializeHelp } from "../shared/help.js";
import { initializeTypingHistory2 } from "../features/typing/history.js";
import { initializeTypingControls2 } from "../features/typing/controls.js";
import { initializeAppLayout } from "./layout.js";
import { initializeAppCoreStartup } from "./core-startup.js";
import { initializeLessonBridge } from "../shared/lesson-bridge.js";
import { initializeAccountStorage } from "../shared/account-storage.js";
import { initializeAudioEffects } from "../shared/audio/effects.js";
import { initializeConfetti } from "../shared/confetti.js";
import { initializeAuthService } from "../features/auth/service.js";
import { initializeProEntitlements } from "../features/pro/entitlements.js";
import { initializeAppNavigation } from "./navigation.js";
import { initializeDialogs } from "../shared/dialogs.js";
import { initializeAuthController } from "../features/auth/controller.js";
import { initializeProCheckout } from "../features/pro/checkout.js";
import { initializeAppNavigationEvents } from "./navigation-events.js";
import { initializeThemeControls } from "../shared/theme-controls.js";
import { initializeDashboardController } from "../features/dashboard/controller.js";
import { initializeRankingController } from "../features/ranking/controller.js";
import { initializeAppShellStartup } from "./shell-startup.js";
import { initializeGameSession } from "../features/game/session.js";
import { initializeGameWords } from "../features/game/words.js";
import { initializeGameEngine } from "../features/game/engine.js";
import { initializeGameInput } from "../features/game/input.js";
import { initializeGameShip } from "../features/game/ship.js";
import { initializeGameController } from "../features/game/controller.js";
import { initializeGameEvents } from "../features/game/events.js";
import { initializePronunciationSession } from "../features/pronunciation/session.js";
import { initializePronunciationUtils } from "../features/pronunciation/utils.js";
import { initializePronunciationRepository } from "../features/pronunciation/repository.js";
import { initializePronunciationStorage } from "../features/pronunciation/storage.js";
import { initializePronunciationTts } from "../features/pronunciation/tts.js";
import { initializePronunciationMicrophone } from "../features/pronunciation/microphone.js";
import { initializePronunciationRecognition } from "../features/pronunciation/recognition.js";
import { initializePronunciationWav } from "../features/pronunciation/wav.js";
import { initializePronunciationAssessment } from "../features/pronunciation/assessment.js";
import { initializePronunciationFileTransfer } from "../features/pronunciation/file-transfer.js";
import { initializePronunciationController } from "../features/pronunciation/controller.js";
import { initializeVirtualKeyboard } from "../shared/virtual-keyboard.js";
import { exposeCoreGlobals } from "./compatibility.js";

function initializeData(){
  initializeDataCatalog();
}

function initializeCore(){
  initializeDom();
  initializeStorageLessonRepository();
  initializeTypingSession();
  initializeStorageLessonRepository2();
  initializeTypingHistoryState();
  initializeStorageLessonRepository3();
  initializeLanguageNormalization();
  initializeTypingWeakness();
  initializeTheme();
  initializeModal();
  initializeLibraryController();
  initializeAiSavedSets();
  initializeLibraryCatalog();
  initializeAiProviders();
  initializeAiSession();
  initializeAiClient();
  initializeLanguagePinyin();
  initializeAiValidation();
  initializeStorageImportFiles();
  initializeTypingDatasets();
  initializeTypingHistory();
  initializeTypingInput();
  initializeAudioTypingSfx();
  initializeTypingControls();
  initializeGame();
  initializeTypingNavigation();
  initializeAiController();
  initializeTypingEvents();
  initializeHelp();
  initializeTypingHistory2();
  initializeTypingControls2();
  initializeAppLayout();
  initializeAppCoreStartup();
  initializeLessonBridge();
}

function initializeShell(){
  initializeAccountStorage();
  initializeAudioEffects();
  initializeConfetti();
  initializeAuthService();
  initializeProEntitlements();
  initializeAppNavigation();
  initializeDialogs();
  initializeAuthController();
  initializeProCheckout();
  initializeAppNavigationEvents();
  initializeThemeControls();
  initializeDashboardController();
  initializeRankingController();
  initializeAppShellStartup();
}

function initializeGame(){
  if (!document.getElementById('gameCard') || !document.getElementById('gaCanvas')) return;
  initializeGameSession();
  initializeGameWords();
  initializeGameEngine();
  initializeGameInput();
  initializeGameShip();
  initializeGameController();
  initializeGameEvents();
}

function initializePron(){
  initializePronunciationSession();
  initializePronunciationUtils();
  initializePronunciationRepository();
  initializePronunciationStorage();
  initializePronunciationTts();
  initializePronunciationMicrophone();
  initializePronunciationRecognition();
  initializePronunciationWav();
  initializePronunciationAssessment();
  initializePronunciationFileTransfer();
  initializePronunciationController();
}

function initializeKeyboard(){
  initializeVirtualKeyboard();
}

let initialized = false;
export function initializeApplication(){
 if(initialized)return;
 initialized=true;
 initializeData();
 exposeCoreGlobals();
 initializeCore();
 initializeShell();
 initializePron();
 initializeKeyboard();
}
