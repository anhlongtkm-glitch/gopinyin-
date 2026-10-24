/* Áp theme ngay từ đầu để tránh nhấp nháy (FOUC) */
(function(){try{var t=localStorage.getItem('cts:theme');if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();
