// One shared loader promise; player instances and their lifetime belong to the controller.
let pending;

export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => reject(new Error('Không tải được YouTube API. Kiểm tra mạng rồi thử lại.')), 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Mạng đang chặn YouTube API.'));
    };
    document.head.append(script);
  }).catch(error => {
    pending = undefined;
    throw error;
  });

  return pending;
}
