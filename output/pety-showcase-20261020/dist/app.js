(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const story = document.querySelector('.story'), world = document.querySelector('.paper-world');
  const clamp = n => Math.max(0, Math.min(1,n));
  const chapters = [
    ['01 / NOTICE','从一张照片，<br>开始。','它看向镜头的样子，<br>还有照片之外，你想记住的小事。','留住一眼心动'],
    ['02 / REMEMBER','把日常，<br>轻轻展开。','窗边的午睡，回家的迎接。<br>一张照片、几句话，就足够。','收好平凡一天'],
    ['03 / KEEP','让时光，<br>有页可翻。','把散落的片刻收成册页，<br>慢慢翻开，都是一起生活的痕迹。','珍藏一起走过的时光']
  ];
  let selected=-1,manual=-1;
  function update(){
    const mobile=innerWidth<=600;
    const r=story.getBoundingClientRect();
    const progress=manual>=0?manual:clamp(-r.top/Math.max(1,story.offsetHeight-innerHeight));
    const p=progress,s=mobile?.43:1;
    world.style.setProperty('--photo-x',`${p*90*s}px`);world.style.setProperty('--photo-y',`${p*15*s}px`);world.style.setProperty('--photo-r',`${-8+p*18}deg`);
    world.style.setProperty('--paper-x',`${-p*135*s}px`);world.style.setProperty('--paper-y',`${p*10*s}px`);world.style.setProperty('--paper-r',`${-4-p*12}deg`);
    world.style.setProperty('--book-x',`${p*170*s}px`);world.style.setProperty('--book-y',`${-p*45*s}px`);world.style.setProperty('--book-r',`${3+p*17}deg`);
    world.style.setProperty('--slip-y',`${p*15}px`);
    const ch=Math.min(2,Math.floor(p*3));
    if(ch!==selected){selected=ch;const c=chapters[ch];document.querySelector('#story-kicker').textContent=c[0];document.querySelector('#story-title').innerHTML=c[1];document.querySelector('#story-desc').innerHTML=c[2];document.querySelector('#story-foot').textContent=c[3];document.querySelectorAll('[data-chapter]').forEach((b,i)=>{b.classList.toggle('active',i===ch);b.setAttribute('aria-current',i===ch?'step':'false');});}
    if(!reduced)document.documentElement.style.setProperty('--hero-y',Math.min(scrollY*.10,65)+'px');
  }
  let queued=false;addEventListener('scroll',()=>{manual=-1;if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;update()})}},{passive:true});
  addEventListener('resize',update);
  document.querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>{const p=(+b.dataset.chapter+.3)/3;if(reduced){manual=p;update()}else scrollTo({top:story.offsetTop+p*(story.offsetHeight-innerHeight),behavior:'smooth'})}));
  const tabs=[...document.querySelectorAll('[data-screen]')];
  function selectScreen(b){tabs.forEach(t=>{const s=t===b;t.classList.toggle('selected',s);t.setAttribute('aria-selected',s);t.tabIndex=s?0:-1});document.querySelector('#app-screen').src=`assets/app-${b.dataset.screen}.png`;document.querySelector('#app-screen').alt=`Pety 当前项目的${b.querySelector('b').textContent}界面，使用演示资料`;document.querySelector('#product-panel').setAttribute('aria-labelledby',b.id)}
  tabs.forEach((b,i)=>{b.tabIndex=i? -1:0;b.addEventListener('click',()=>selectScreen(b));b.addEventListener('keydown',e=>{let n;if(['ArrowDown','ArrowRight'].includes(e.key))n=(i+1)%tabs.length;if(['ArrowUp','ArrowLeft'].includes(e.key))n=(i+tabs.length-1)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(n!==undefined){e.preventDefault();selectScreen(tabs[n]);tabs[n].focus()}})});
  const names={ivory:['象牙纸','#f5eddf'],sage:['鼠尾草纸','#d2d7c2'],rose:['浅玫瑰纸','#e4c7b8']};
  document.querySelectorAll('[data-paper]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-paper]').forEach(s=>{s.classList.toggle('chosen',s===b);s.setAttribute('aria-pressed',s===b)});document.querySelector('.keepsake').style.setProperty('--sheet',names[b.dataset.paper][1]);document.querySelector('#paper-name').textContent=names[b.dataset.paper][0]}));
  document.querySelector('#stamp-button').addEventListener('click',e=>{const s=document.querySelector('.keepsake').classList.toggle('stamped');e.currentTarget.innerHTML=(s?'收起印记':'盖上它的印记')+' <span>↗</span>';e.currentTarget.setAttribute('aria-pressed',s)});
  const dialog=document.querySelector('#film-dialog'),video=dialog.querySelector('video');
  document.querySelectorAll('[data-film]').forEach(b=>b.addEventListener('click',()=>{dialog.showModal();video.play().catch(()=>{})}));
  document.querySelector('.close-film').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>video.pause());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
  update();
})();
