import { state as typing } from '../../features/typing/session.js';

// Owns layout only. Existing controls, IDs, handlers, inputs and graders stay intact.
export function initializeStudyPresentation() {
  for (const [id,mode] of [['appCard','typing'],['pronCard','speaking']]) {
    const root=document.getElementById(id); if(!root||root.dataset.layout==='approved')continue;
    root.dataset.layout='approved';
    const heading=document.createElement('header');heading.className='studyPageHeading';
    heading.innerHTML=`<div><span class="featureEyebrow">${mode==='typing'?'LUYỆN GÕ CHỮ HÁN':'LUYỆN PHÁT ÂM'}</span><h2>${mode==='typing'?'Gõ từng câu. Ghi nhớ từng chữ.':'Cất tiếng nói, từng câu một.'}</h2></div>`;
    const bar=root.querySelector('.practiceModeBar'); if(bar)heading.append(bar);
    root.querySelector('.studyHead').before(heading);
    const layout=document.createElement('div');layout.className='studyLayout';
    const main=document.createElement('div');main.className='studyMainPanel';
    const body=root.querySelector('.studyBody'),foot=root.querySelector('.studyFoot');
    body.before(layout);main.append(body,foot);layout.append(main);
    const aside=document.createElement('aside');aside.className='studyContext';
    aside.innerHTML='<section class="studyContextCard"><div data-mascot="reading" data-mascot-size="hero" aria-hidden="true"></div><span class="featureEyebrow">BẠN ĐANG LUYỆN</span><h3 data-context-title></h3><p>Luyện từng câu nhỏ. Học chắc hơn mỗi ngày, theo nhịp riêng của bạn.</p><div class="contextProgress"><i></i></div><div class="contextStats"><span><b data-context-count>0 / 0</b> câu đã học</span><span><b data-context-accuracy>—</b> '+(mode==='typing'?'chính xác':'điểm trung bình')+'</span></div></section><div class="studyKeyGuide"><span><kbd>1–3</kbd> Ẩn / hiện câu</span><span><kbd>4</kbd> Nghe mẫu</span><span><kbd>5</kbd> Câu tiếp</span><span><kbd>0</kbd> Đổi Gõ / Nói</span></div>';
    const guide=root.querySelector('.kbdHint');if(guide){const details=document.createElement('details');details.className='studyMoreKeys';details.innerHTML='<summary>Toàn bộ phím tắt</summary>';details.append(guide);aside.append(details);}layout.append(aside);
    if(mode==='speaking'){
      const result=document.getElementById('pronResult');aside.prepend(result);
      const sync=()=>aside.classList.toggle('has-feedback',!result.classList.contains('hidden'));
      new MutationObserver(sync).observe(result,{attributes:true,attributeFilter:['class']});sync();
    }
    const count=document.getElementById(mode==='typing'?'progressText':'pronProg');
    const accuracy=document.getElementById(mode==='typing'?'accuracyText':'pronAvg');
    const source=document.getElementById(mode==='typing'?'appSource':'pronSource');
    const set=(selector,value)=>{const el=aside.querySelector(selector);if(el.textContent!==value)el.textContent=value;};
    const update=()=>{
      const name=mode==='typing'?typing.activeDataset?.name:source.selectedOptions[0]?.textContent;
      set('[data-context-title]',name||'Luyện tập cùng gấu');
      set('[data-context-count]',count.textContent);set('[data-context-accuracy]',accuracy.textContent);
      const values=count.textContent.match(/\d+/g)||[];const percent=values[1]?Math.min(100,Number(values[0])/Number(values[1])*100):0;
      aside.querySelector('.contextProgress i').style.width=percent+'%';
    };
    for(const el of [count,accuracy,source])new MutationObserver(update).observe(el,{childList:true,characterData:true,subtree:true});
    source.addEventListener('change',update);document.addEventListener('gp:view-changed',update);update();
  }
}
