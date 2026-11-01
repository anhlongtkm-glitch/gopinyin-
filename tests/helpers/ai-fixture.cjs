const base=[['茶叶','chá yè','lá trà'],['红茶','hóng chá','trà đen'],['绿茶','lǜ chá','trà xanh'],['白茶','bái chá','trà trắng'],['茶水','chá shuǐ','nước trà'],['杯子','bēi zi','cốc'],['牛奶','niú nǎi','sữa'],['咖啡','kā fēi','cà phê'],['开水','kāi shuǐ','nước nóng'],['果汁','guǒ zhī','nước trái cây']];
const prefixes=[['',''],['新','xīn'],['大','dà'],['小','xiǎo'],['热','rè'],['冷','lěng'],['好','hǎo'],['老','lǎo']];
exports.aiRows=(batch=0)=>base.map(([zh,py,vi])=>({zh:prefixes[batch%prefixes.length][0]+zh,py:(prefixes[batch%prefixes.length][1]+' '+py).trim(),vi}));
exports.chooseAiKind=async(page,kind)=>{
 await page.locator('#aiSentenceChoice').setChecked(kind==='sentence'||kind==='both');
 await page.locator('#aiWordChoice').setChecked(kind==='word'||kind==='both');
};
exports.autoAiChoice=async(page,save=true,name='')=>{
 await page.evaluate(({save,name})=>{
  window.__aiTestChoice={save,name};
  if(window.__aiTestObserver)return;
  window.__aiTestObserver=new MutationObserver(()=>{
   const dialog=document.getElementById('aiCreateDialog');
   if(!dialog?.open)return;
   const choice=window.__aiTestChoice;
   if(choice.name)document.getElementById('aiCreateName').value=choice.name;
   dialog.querySelector('[value="'+(choice.save?'save':'temporary')+'"]').click();
  });
  window.__aiTestObserver.observe(document.documentElement,{attributes:true,attributeFilter:['open'],subtree:true});
 },{save,name});
};
exports.advanceAi=async page=>{
 await page.evaluate(()=>window.markSentenceCorrect());
 await page.click('#typingNextBtn');
};
