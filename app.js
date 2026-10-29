const DEFAULT_TRIP_TITLE = '吉隆坡，一起走走';
const $=s=>document.querySelector(s), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATS=['美食','文化','自然','藝文','購物','地標','室內','夜生活'];
const QUESTIONS=[
['抵達吉隆坡，第一件想做的事？',['吃一頓在地美食','走進老街與廟宇','看看城市天際線'],['美食','文化','地標']],
['空出一個下午，你會去哪裡？',['公園裡放空','美術館看展','商場逛逛'],['自然','藝文','購物']],
['你的旅行相簿，最多是哪種照片？',['建築與街景','食物特寫','山林與綠意'],['地標','美食','自然']],
['如果下雨，你最想怎麼度過？',['找間室內展館','去逛設計選物店','吃一輪美食'],['室內','購物','美食']],
['入夜後的旅行提案，你選？',['熱鬧街區小酌','欣賞城市夜景','找夜市吃晚餐'],['夜生活','地標','美食']],
['最願意多花一點時間的是？',['了解當地文化','體驗藝術與設計','探索自然風景'],['文化','藝文','自然']],
['旅途中想帶回什麼？',['市場裡的手作物','一段文化故事','一張經典地標合照'],['購物','文化','地標']],
['選一個最有吸引力的旅程標題。',['雨林裡的城市散步','從早吃到晚的味覺地圖','老街巷弄與藝術靈感'],['自然','美食','藝文']],
['旅伴提議加一站，你希望是？',['好玩的室內體驗','充滿生活感的市場','熱鬧的夜間街區'],['室內','文化','夜生活']],
['離開前的最後半天，你會？',['補買喜歡的小物','再看一座博物館','走訪一個城市地標'],['購物','藝文','地標']],
['你最舒服的旅行節奏？',['慢慢走，留很多空白','剛剛好，鬆緊有度','充實一點，多看幾站'],['pace:slow','pace:balanced','pace:full']],
['理想的出門時間？',['早起出發，08:00','吃完早餐，09:00','睡飽再說，10:00'],['start:480','start:540','start:600']],
['你希望幾點結束一天？',['傍晚回去休息，18:00','晚餐後收工，20:00','夜色也是旅程，22:00'],['end:1080','end:1200','end:1320']],
['交通方式，你比較偏好？',['步行與大眾運輸','混合搭配，彈性移動','以計程車為主'],['transport:transit','transport:mixed','transport:taxi']],
['每天的體驗與餐飲預算？',['輕旅行，約 RM 100','適中，約 RM 200','豐富體驗，約 RM 350'],['budget:100','budget:200','budget:350']]
];
const KEY='roam-kl-v1';let state;try{state=JSON.parse(localStorage.getItem(KEY))}catch{};
if(!state||!Array.isArray(state.people)||!state.people.length)state={version:1,tripId:crypto.randomUUID(),me:crypto.randomUUID(),people:[],settings:{days:3,pace:'balanced',start:540,end:1200,transport:'mixed',budget:200}};
if(!state.people.some(p=>p.id===state.me))state.people.push({id:state.me,name:'我',answers:[],votes:[],updated:Date.now()});
state.settings=cleanSettings(state.settings);
state.trip=cleanTrip(state.trip);
let view='overview',step=Math.min(me().answers.length,14),filter='全部',query='',area='全部區域',sort='popular',activeDay=0,plan=null,editingQuiz=false;

function cleanTrip(trip) {
  const input = trip && typeof trip === 'object' ? trip : {};
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 60) : '';
  const date = typeof input.startDate === 'string' ? input.startDate : '';
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date + 'T00:00:00Z')) &&
    new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
  return { title: title || DEFAULT_TRIP_TITLE, startDate: validDate ? date : '' };
}

function tripDateSummary(trip, days, now = new Date()) {
  if (!trip.startDate) return { range: '出發日期待定', badge: '日期待定', caption: '好日子，一起決定' };
  // Calendar-day arithmetic avoids host timezone and daylight-saving offsets.
  const start = Date.parse(trip.startDate + 'T00:00:00Z');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const today = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  const end = start + (days - 1) * 86400000;
  const format = date => new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
  const range = days === 1 ? format(start) : `${format(start)} — ${format(end)}`;
  if (today < start) return { range, badge: `${Math.round((start - today) / 86400000)} 天`, caption: '距離一起出發' };
  if (today <= end) return { range, badge: '旅途中', caption: `DAY ${Math.round((today - start) / 86400000) + 1} / ${days}` };
  return { range, badge: '旅行回憶', caption: '期待下次一起出發' };
}

function editTrip() {
  modal(`<div class="eyebrow">MAKE THIS TRIP YOURS</div><h2 style="margin-top:16px">編輯旅程資訊</h2>
    <form id="tripForm"><label for="tripTitle">旅程名稱<input id="tripTitle" type="text" maxlength="60" required value="${esc(state.trip.title)}"></label>
    <label for="tripStart">出發日期（可稍後決定）<input id="tripStart" type="date" min="2000-01-01" max="2099-12-31" value="${state.trip.startDate}"></label>
    <label for="tripDays">旅行天數<select id="tripDays">${[1,2,3,4,5,6,7].map(n => `<option value="${n}" ${n === state.settings.days ? 'selected' : ''}>${n} 天</option>`).join('')}</select></label>
    <p class="help-note">天數會同步套用至行程頁。日期用於旅程總覽與倒數；排程尚未處理每週休館日。</p>
    <p id="tripFormError" class="form-error" role="alert"></p><button class="primary" type="submit">儲存旅程資訊</button></form>`);
  $('#tripForm').onsubmit = event => {
    event.preventDefault();
    const title = $('#tripTitle').value.trim();
    const startDate = $('#tripStart').value;
    const trip = cleanTrip({ title, startDate });
    const days = Number($('#tripDays').value);
    if (!title || (startDate && trip.startDate !== startDate) || !Number.isInteger(days) || days < 1 || days > 7) {
      $('#tripFormError').textContent = '請填寫旅程名稱、有效日期與 1–7 天的旅行天數。';
      return;
    }
    state.trip = trip;
    state.settings.days = days;
    plan = null;
    activeDay = 0;
    $('#modal').close();
    render();
  };
}

function me(){return state.people.find(p=>p.id===state.me)}
function save(){me().updated=Date.now();try{localStorage.setItem(KEY,JSON.stringify(state));$('.saved').textContent='● 已儲存在此裝置';$('.saved').classList.remove('save-error')}catch{$('.saved').textContent='● 無法儲存，請匯出備份';$('.saved').classList.add('save-error');toast('此瀏覽器無法儲存，請匯出旅程備份。')}$('#profileLabel').innerHTML=esc(me().name)+'<small>瀏覽器本機儲存</small>'}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').style.display='none',3200)}
function modal(html){$('#modalBody').innerHTML=html;$('#modal').showModal()}
$('.close').onclick=()=>$('#modal').close();$('#modal').onclick=e=>{if(e.target===$('#modal'))$('#modal').close()};
function prefs(p){let weights=Object.fromEntries(CATS.map(c=>[c,0]));let out={weights,pace:'balanced',start:540,end:1200,transport:'mixed',budget:200};p.answers.forEach((a,i)=>{let val=QUESTIONS[i]?.[2][a];if(!val)return;if(val.includes(':')){let[k,v]=val.split(':');out[k]=isNaN(Number(v))?v:Number(v)}else weights[val]+=1});return out}
function groupPrefs(){let people=state.people.filter(p=>p.answers.length===15);if(!people.length)people=[me()];let ps=people.map(prefs);return {weights:Object.fromEntries(CATS.map(c=>[c,ps.reduce((s,p)=>s+p.weights[c],0)/ps.length])),start:Math.round(ps.reduce((s,p)=>s+p.start,0)/ps.length/60)*60,end:Math.round(ps.reduce((s,p)=>s+p.end,0)/ps.length/60)*60,budget:Math.round(ps.reduce((s,p)=>s+p.budget,0)/ps.length),pace:ps.map(p=>p.pace).sort((a,b)=>ps.filter(p=>p.pace===b).length-ps.filter(p=>p.pace===a).length)[0],transport:ps.map(p=>p.transport).sort((a,b)=>ps.filter(p=>p.transport===b).length-ps.filter(p=>p.transport===a).length)[0]}}
const votes=id=>state.people.filter(p=>p.votes.includes(id)).length;
const PHOTO={1:'photo-1596422846543-75c6fc197f07',8:'photo-1514282401047-d79a71a590e8',43:'photo-1596422846543-75c6fc197f07'};
function placeCard(p){return `<article class="place"><div class="place-image">${PHOTO[p.id]?`<img src="https://images.unsplash.com/${PHOTO[p.id]}?auto=format&fit=crop&w=650&q=80" alt="吉隆坡城市旅行意象" loading="lazy">`:`<div class="map-art"><span>${({'美食':'♨','文化':'⛩','自然':'❧','藝文':'◈','購物':'▱','地標':'⌁','室內':'◇','夜生活':'☾'})[p.cat]}</span></div>`}<span class="category">${p.cat} · ${p.area}</span><button class="heart ${me().votes.includes(p.id)?'voted':''}" data-vote="${p.id}" aria-label="${me().votes.includes(p.id)?'取消':'投票給'}${p.name}" aria-pressed="${me().votes.includes(p.id)}">${me().votes.includes(p.id)?'♥':'♡'}</button></div><div class="place-body"><h3><button data-place="${p.id}">${p.name} ↗</button></h3><p>${p.en}</p><div class="place-meta"><span>◷ 約 ${p.duration} 分鐘</span><span class="vote-count">♡ ${votes(p.id)} 人想去</span></div></div></article>`}
function heading(eyebrow,title,sub,extra=''){return `<div class="title-line"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${extra}</div>`}
function overviewStats() {
  const complete = state.people.filter(p => p.answers.length === QUESTIONS.length).length;
  const ranked = PLACES.map(place => ({ ...place, voteCount: votes(place.id) }))
    .filter(place => place.voteCount > 0)
    .sort((a, b) => b.voteCount - a.voteCount || a.id - b.id);
  return {
    complete,
    total: state.people.length,
    voters: state.people.filter(p => p.votes.length > 0).length,
    ballots: state.people.reduce((sum, person) => sum + person.votes.length, 0),
    ranked,
    pending: state.people.filter(p => p.answers.length < QUESTIONS.length),
    next: me().answers.length < QUESTIONS.length ? 'quiz' : !me().votes.length ? 'places' : 'route'
  };
}

function overview() {
  const stats = overviewStats();
  const done = me().answers.length === QUESTIONS.length;
  const preview = stats.ranked.length ? generate() : null;
  const scheduled = preview ? preview.days.reduce((sum, day) => sum + day.stops.length, 0) : 0;
  const preferences = Object.entries(groupPrefs().weights).filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 3);
  const next = {
    quiz: [me().answers.length ? '繼續旅行偏好測驗' : '開始旅行偏好測驗', '先找到你的旅行節奏。', `已回答 ${me().answers.length} / 15 題，答案會自動儲存。`],
    places: ['選出想去的地方', '你的旅行模樣，已經很清晰。', '從 56 個地點裡，把最想去的地方加入票選。'],
    route: ['查看建議行程', '把你們的期待，排成每一天。', `已收到 ${stats.ballots} 票，${scheduled} 個地點可排入目前的旅程。`]
  }[stats.next];
  const date = tripDateSummary(state.trip, state.settings.days);
  const topPlaces = stats.ranked.length ? stats.ranked.slice(0, 3) : [PLACES[0], PLACES[8], PLACES[14]];
  return heading('YOUR TRIP, AT A GLANCE', esc(state.trip.title), '旅程資訊、大家的期待，還有下一步，都在這裡。',
    '<button class="outline" id="editTrip">✎ 編輯旅程</button>') + `
    <section class="hero overview-hero">
      <img src="https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1800&q=85" alt="吉隆坡雙子星塔與城市天際線">
      <div class="hero-copy"><div class="eyebrow">MALAYSIA · KUALA LUMPUR</div>
        <h2>下一站，吉隆坡。<br>一起走出我們的路。</h2>
        <div class="trip-facts"><span>◷ ${date.range}</span><span>${state.settings.days} 天旅程</span><span>${stats.total} 位同路旅人</span></div>
      </div><div class="hero-stamp"><b>${date.badge}</b>${date.caption}</div>
    </section>
    <div class="overview-metrics" aria-label="旅程統計">
      <div><span>旅行偏好已完成</span><strong>${stats.complete}<small> / ${stats.total} 人</small></strong><p>${stats.pending.length ? `還有 ${stats.pending.length} 位旅伴尚未完成` : '大家的旅行偏好都到齊了'}</p></div>
      <div><span>大家想去的地方</span><strong>${stats.ranked.length}<small> 個地點</small></strong><p>共 ${stats.ballots} 票 · ${stats.voters} 位旅伴參與</p></div>
      <div><span>建議路線已排入</span><strong>${scheduled}<small> 個地點</small></strong><p>${preview ? preview.rejected.length ? `${preview.rejected.length} 個待調整時間或天數` : '已涵蓋所有收到票選的地點' : '投下第一票，就能開始排路線'}</p></div>
      <div><span>每日體驗與餐飲預算</span><strong>${state.settings.budget}<small> RM / 人</small></strong><p>${({ slow: '慢慢走', balanced: '剛剛好', full: '充實走' })[state.settings.pace]} · ${time(state.settings.start)}–${time(state.settings.end)}</p></div>
    </div>
    <div class="steps overview-steps">
      <button class="step" data-go="quiz"><span>01 / DISCOVER</span><div><h3>找到你的旅行模樣</h3><p>15 題，讀懂旅行偏好</p><small>${done ? '✓ 我的測驗已完成' : `已回答 ${me().answers.length} / 15 題`} ↗</small></div></button>
      <button class="step" data-go="places"><span>02 / PICK</span><div><h3>把喜歡的地方留下</h3><p>56 個地點，一起票選</p><small>我的 ${me().votes.length} 個口袋名單 ↗</small></div></button>
      <button class="step" data-go="route"><span>03 / ROAM</span><div><h3>讓期待，變成路線</h3><p>綜合偏好、距離與節奏</p><small>${scheduled ? `${state.settings.days} 天 · ${scheduled} 站建議` : '等待你的第一個想去'} ↗</small></div></button>
    </div>
    <div class="dashboard overview-dashboard"><section>
      <div class="section-head"><h2>接下來，做一點旅行準備</h2><span class="eyebrow">YOUR NEXT STEP</span></div>
      <div class="panel"><div class="journey-card"><div class="art">✳</div><div><h3>${next[1]}</h3><p>${next[2]}</p><button class="primary" data-go="${stats.next}">${next[0]} ↗</button></div></div>
      <div class="progress" role="progressbar" aria-label="我的測驗進度" aria-valuemin="0" aria-valuemax="15" aria-valuenow="${me().answers.length}"><div style="width:${me().answers.length / 15 * 100}%"></div></div>
      <div class="progress-caption"><span>${done ? '偏好已加入旅程' : '隨時可以回來繼續'}</span><span>${me().answers.length} / 15 題</span></div></div>
      <section class="discover"><div class="section-head"><h2>${stats.ranked.length ? '大家最想一起去的地方' : '先收藏一點旅行靈感'}</h2><button data-go="places">探索全部 56 個地點 ↗</button></div>
      ${!stats.ranked.length ? '<p class="help-note">還沒有收到票選；以下是探索靈感，不是票選結果。</p>' : '<p class="help-note">依目前收到的票數排序，同票時按地點清單順序顯示。</p>'}
      <div class="cards overview-top-places">${topPlaces.map(placeCard).join('')}</div></section>
      <section class="discover"><div class="section-head"><h2>我們的旅行節奏</h2><button data-go="route">調整行程設定 ↗</button></div>
      <div class="panel overview-rhythm"><div><span class="eyebrow">OUR SHARED INTERESTS</span><div class="prefs">${stats.complete && preferences.length ? preferences.map(([category]) => `<span class="pill">${category}</span>`).join('') : '<p class="help-note">完成測驗後，這裡會顯示大家最喜歡的旅行體驗。</p>'}</div></div><p class="help-note">每天從 KLCC 出發，依${({ transit: '步行與大眾運輸', mixed: '混合交通', taxi: '計程車' })[state.settings.transport]}估計移動時間。時段、交通與費用仍需出發前確認。</p></div></section>
    </section><aside>
      <div class="section-head"><h2>我們的旅行小隊</h2><button id="inviteSide" aria-label="邀請旅伴">＋ 邀請</button></div>
      <div class="panel"><div class="progress-caption"><span>旅行偏好完成進度</span><span>${stats.complete} / ${stats.total}</span></div>
      <div class="progress" role="progressbar" aria-label="旅伴測驗完成進度" aria-valuemin="0" aria-valuemax="${stats.total}" aria-valuenow="${stats.complete}"><div style="width:${stats.complete / stats.total * 100}%"></div></div>
      <div class="overview-people">${state.people.map(person => `<div class="overview-person"><span class="avatar">${esc(Array.from(person.name)[0] || '旅')}</span><div><strong>${esc(person.name)}${person.id === state.me ? '（你）' : ''}</strong><small>${person.answers.length === 15 ? '✓ 測驗完成' : `測驗 ${person.answers.length} / 15`} · ${person.votes.length} 個想去</small></div></div>`).join('')}</div>
      <button class="outline full-width" id="managePeople">邀請與匯入旅伴回覆 ↗</button><p class="help-note">這裡只統計已加入或匯入的旅伴。以連結交換回覆，非即時同步。</p></div>
      <div class="compass"><div class="eyebrow">KEEP YOUR PLANS CLOSE</div><h3>把這次的期待，好好留下。</h3><p>匯出旅程備份，就能保留旅程設定、旅伴偏好與票選。</p><button class="outline full-width" id="backupOverview">↓ 備份旅程 JSON</button></div>
    </aside></div>`;
}

function quiz(){if(me().answers.length===15&&!editingQuiz)return heading('YOUR TRAVEL DNA','這就是你的旅行模樣。','每個偏好，都會成為我們安排路線的線索。')+`<section class="panel quiz-box"><div class="result-icon">✳</div><h2>${Object.entries(prefs(me()).weights).sort((a,b)=>b[1]-a[1])[0][0]}探索家，準備出發。</h2><p class="subtitle">以下偏好已儲存，行程會綜合所有完成測驗的旅伴。</p><div class="prefs" style="margin:25px 0">${Object.entries(prefs(me()).weights).sort((a,b)=>b[1]-a[1]).filter(x=>x[1]).map(([c,n])=>`<span class="pill">${c} ${n}</span>`).join('')}</div><button class="primary" data-go="places">接著，投票選地點 ↗</button> <button class="outline" id="retake">重新調整答案</button></section>`;const q=QUESTIONS[step];return heading('FIND YOUR OWN WAY','旅行沒有標準答案。','15 個小問題，幫你和旅伴找到舒服的同路方式。')+`<div class="quiz-layout"><section class="panel quiz-box"><div class="mobile-progress">旅行偏好測驗 <span style="float:right">${step+1} / 15</span></div><div class="progress"><div style="width:${(step+1)/15*100}%"></div></div><h2>${q[0]}</h2><div class="quiz-options">${q[1].map((o,i)=>`<button class="option ${me().answers[step]===i?'selected':''}" data-answer="${i}">${['A','B','C'][i]} <span style="margin-left:15px">${o}</span> ${me().answers[step]===i?'✓':''}</button>`).join('')}</div><div class="quiz-actions"><button class="outline" id="prevQuestion" ${step===0?'disabled':''}>← 上一題</button><button class="primary" id="nextQuestion" ${me().answers[step]===undefined?'disabled':''}>${step===14?'完成測驗':'下一題'} →</button></div></section><aside class="compass" style="height:fit-content"><div class="eyebrow">JUST BE YOURSELF</div><h3 style="margin-top:20px">跟著直覺選就好。</h3><p>前 10 題探索喜歡的體驗，後 5 題找出你的步調、交通與預算。<br><br>答案會自動留在此裝置，隨時都能回來繼續。</p></aside></div>`}
function places(){let list=PLACES.filter(p=>(filter==='全部'||p.cat===filter)&&(area==='全部區域'||p.area===area)&&(!query||(p.name+p.en+p.area).toLowerCase().includes(query.toLowerCase())));if(sort==='popular')list.sort((a,b)=>votes(b.id)-votes(a.id));if(sort==='mine')list=list.filter(p=>me().votes.includes(p.id));return heading('SAVE THE PLACES, SHARE THE EXCITEMENT','每一票，都是想一起去的心情。','從 56 個吉隆坡與近郊地點，留下你最期待的旅行片段。',`<span class="pill">♡ 已選 ${me().votes.length} 個地點</span>`)+`${me().answers.length<15?'<div class="banner">✳ 先完成旅行偏好測驗，就能開始投票。 <button data-go="quiz"><b>前往測驗 →</b></button></div>':''}<div class="tools"><input id="search" aria-label="搜尋地點" placeholder="⌕ 搜尋地點、街區或關鍵字" value="${esc(query)}"><select id="area" aria-label="篩選區域"><option>全部區域</option>${[...new Set(PLACES.map(p=>p.area))].map(a=>`<option ${area===a?'selected':''}>${a}</option>`).join('')}</select><select id="sort" aria-label="地點排序"><option value="popular" ${sort==='popular'?'selected':''}>依票數排序</option><option value="mine" ${sort==='mine'?'selected':''}>我的口袋名單</option><option value="default" ${sort==='default'?'selected':''}>預設排序</option></select></div><div class="tools">${['全部',...CATS].map(c=>`<button class="filter ${filter===c?'selected':''}" data-filter="${c}">${c}</button>`).join('')}</div><div class="section-head"><span class="help-note">${list.length} 個地點 · 點擊名稱查看規劃資料</span><button data-go="route">查看建議行程 ↗</button></div><div class="cards all-places">${list.length?list.map(placeCard).join(''):'<div class="empty">還沒有符合的地點，試試其他關鍵字或分類。</div>'}</div>`}
function hav(a,b){let r=Math.PI/180;let x=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
const time=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
function generate(){const s=state.settings,g=groupPrefs();let left=PLACES.filter(p=>votes(p.id)>0),days=[],rejected=[];const cap={slow:3,balanced:5,full:7}[s.pace],rest={slow:40,balanced:25,full:10}[s.pace];for(let d=0;d<s.days;d++){let stops=[],t=+s.start,prev={lat:3.1579,lng:101.7123},spent=0;while(stops.length<cap){let candidates=left.map(p=>{let km=hav(prev,p);let travel=Math.ceil(km<.6?km*15:km*({transit:5,mixed:3.6,taxi:2.7}[s.transport])+({transit:12,mixed:8,taxi:6}[s.transport]));let arrival=t+travel,start=Math.max(arrival,p.open),finish=start+p.duration;return {p,km,travel,start,finish,wait:start-arrival,score:votes(p.id)*8+g.weights[p.cat]*3-km*1.7-(start-arrival)/12}}).filter(c=>c.finish<=Math.min(+s.end,c.p.close)&&spent+c.p.cost<=+s.budget).sort((a,b)=>b.score-a.score);if(!candidates.length)break;let c=candidates[0];stops.push(c);spent+=c.p.cost;t=c.finish+rest;prev=c.p;left=left.filter(p=>p.id!==c.p.id)}days.push({stops,spent})}rejected=left;return {days,rejected}}
function route(){if(me().answers.length<15)return heading('LET’S MAKE IT HAPPEN','先找到旅行的節奏。','完成測驗與投票，讓每個建議都更貼近你的期待。')+`<div class="empty panel"><div class="result-icon">⌁</div><h2>你的路線，從 15 個答案開始。</h2><p>完成測驗後，選出想去的地方，再回來安排行程。</p><button class="primary" data-go="quiz">開始旅行測驗 ↗</button></div>`;if(!plan)plan=generate();let s=state.settings,day=plan.days[activeDay]||plan.days[0],total=plan.days.reduce((n,d)=>n+d.stops.length,0);return heading('A ROUTE THAT FEELS LIKE US','把想去，串成一條剛剛好的路。','每一站，綜合大家的票數、旅行偏好、區域距離與規劃時段。',`<button class="outline" id="exportRoute">↓ 匯出行程</button>`)+`<div class="panel settings"><label>旅行天數<select id="set-days">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${s.days===n?'selected':''}>${n} 天</option>`).join('')}</select></label><label>旅行節奏<select id="set-pace">${[['slow','慢慢走 · 每天最多 3 站'],['balanced','剛剛好 · 每天最多 5 站'],['full','充實走 · 每天最多 7 站']].map(([v,n])=>`<option value="${v}" ${s.pace===v?'selected':''}>${n}</option>`).join('')}</select></label><label>交通方式<select id="set-transport">${[['transit','步行＋大眾運輸'],['mixed','混合交通'],['taxi','計程車為主']].map(([v,n])=>`<option value="${v}" ${s.transport===v?'selected':''}>${n}</option>`).join('')}</select></label><label>每日預算估值（RM）<input type="number" min="30" max="2000" step="10" id="set-budget" value="${s.budget}"></label><label>出門時間<select id="set-start">${[420,480,540,600,660].map(n=>`<option value="${n}" ${+s.start===n?'selected':''}>${time(n)}</option>`).join('')}</select></label><label>收工時間<select id="set-end">${[1020,1080,1140,1200,1260,1320,1380].map(n=>`<option value="${n}" ${+s.end===n?'selected':''}>${time(n)}</option>`).join('')}</select></label><div style="align-self:end"><button class="outline" id="useGroup">套用旅伴平均偏好</button></div><div style="align-self:end"><button class="primary" id="regenerate">重新產生路線 ↻</button></div></div><div class="route-layout"><section><div class="day-tabs">${plan.days.map((d,i)=>`<button class="filter ${activeDay===i?'selected':''}" data-day="${i}">DAY ${i+1}</button>`).join('')}</div><div class="panel">${day.stops.length?day.stops.map((c,i)=>`<div class="stop"><span class="time">${time(c.start)}</span><span class="dot">${i+1}</span><div><h3>${c.p.name}</h3><p>${c.p.area} · ${c.p.duration} 分鐘 · 至 ${time(c.finish)}</p><p>♡ ${votes(c.p.id)} 票 · 偏好契合 ${groupPrefs().weights[c.p.cat].toFixed(1)} · 移動估計 ${c.travel} 分${c.wait?` · 等候 ${c.wait} 分`:''}</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.p.en+' Kuala Lumpur')}" target="_blank" rel="noopener">在 Google Maps 查看 ↗</a></div></div>`).join(''):'<div class="empty"><h3>今天還有很多留白。</h3><p>先投票選地點，或增加可用時間與預算。</p><button class="primary" data-go="places">去選想去的地方 ↗</button></div>'}</div>${plan.rejected.length?`<div class="banner">${plan.rejected.length} 個想去的地點尚未排入：${plan.rejected.map(p=>p.name).join('、')}。<br>可能受天數、時段、每日站數或預算限制，可調整設定再試。</div>`:''}</section><aside><div class="panel"><div class="eyebrow">TRIP AT A GLANCE</div><h3 style="margin-top:15px">這次旅行的輪廓</h3><div class="route-stats"><div><b>${s.days}</b><span>天的旅程</span></div><div><b>${total}</b><span>個心動地點</span></div><div><b>${state.people.length}</b><span>位同路旅伴</span></div><div><b>${day.spent}</b><span>今日估值 RM</span></div></div><p class="route-note">以 KLCC 為每日出發參考點。依票數與偏好評分，扣除移動及等待成本，逐站安排，並留出 ${ {slow:40,balanced:25,full:10}[s.pace]} 分鐘緩衝。</p></div><div class="compass"><h3>留一點空白給偶然。</h3><p>時段、座標、費用與交通時間皆為規劃估值，非即時營業或導航資料；請出發前確認。費用不含交通、住宿和購物。</p></div></aside></div>`}
function render(){const tripName=$('#tripName');if(tripName)tripName.textContent=state.trip.title;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#breadcrumb').textContent={overview:'旅程總覽',quiz:'旅行偏好測驗',places:'想去的地方',route:'我們的行程'}[view];$('#app').innerHTML=({overview,quiz,places,route})[view]();bind();save()}
function go(v){view=v;render();window.scrollTo({top:0,behavior:'smooth'})}
function bind(){$('#editTrip')?.addEventListener('click',editTrip);$('#backupOverview')?.addEventListener('click',()=>download('同路-旅程備份.json',JSON.stringify(payload(),null,2)));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));document.querySelectorAll('[data-vote]').forEach(b=>b.onclick=()=>{if(me().answers.length<15){toast('先完成 15 題測驗，就能開始投票。');go('quiz');return}let id=+b.dataset.vote;me().votes=me().votes.includes(id)?me().votes.filter(n=>n!==id):[...me().votes,id];plan=null;save();render()});document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>placeInfo(+b.dataset.place));document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{me().answers[step]=+b.dataset.answer;save();if(step===14&&me().answers.length===15){editingQuiz=false;state.settings={...state.settings,...Object.fromEntries(Object.entries(groupPrefs()).filter(([k])=>k!=='weights'))};plan=null}render()});$('#nextQuestion')?.addEventListener('click',()=>{if(step<14)step++;else editingQuiz=false;render()});$('#prevQuestion')?.addEventListener('click',()=>{step--;render()});$('#retake')?.addEventListener('click',()=>{editingQuiz=true;step=0;plan=null;render()});document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});$('#search')?.addEventListener('input',e=>{let n=e.target.selectionStart;query=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(n,n)});$('#area')?.addEventListener('change',e=>{area=e.target.value;render()});$('#sort')?.addEventListener('change',e=>{sort=e.target.value;render()});$('#inviteSide')?.addEventListener('click',share);$('#managePeople')?.addEventListener('click',share);document.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{activeDay=+b.dataset.day;render()});$('#regenerate')?.addEventListener('click',()=>{let v=+$('#set-budget').value;if(!Number.isFinite(v)||v<30||v>2000){toast('每日預算請填 30–2000 RM');return}for(let k of ['days','pace','transport','budget','start','end']){let val=$('#set-'+k).value;state.settings[k]=['days','budget','start','end'].includes(k)?+val:val}activeDay=0;plan=generate();save();render();toast('已依最新設定產生路線')});$('#useGroup')?.addEventListener('click',()=>{let g=groupPrefs();delete g.weights;state.settings={...state.settings,...g};state.settings.start=Math.round(state.settings.start/60)*60;state.settings.end=Math.round(state.settings.end/60)*60;plan=null;render();toast('已套用完成測驗旅伴的平均時間、預算與多數節奏')});$('#exportRoute')?.addEventListener('click',()=>download('同路-吉隆坡行程.txt',plan.days.map((d,i)=>`DAY ${i+1}\n`+d.stops.map(c=>`${time(c.start)}–${time(c.finish)} ${c.p.name} (${c.p.area})\n移動估值 ${c.travel} 分鐘；${votes(c.p.id)} 票`).join('\n')).join('\n\n')+'\n\n所有時段、座標、費用與交通時間為規劃估值。請出發前向官方確認。','text/plain'))}
function placeInfo(id){let p=PLACES.find(p=>p.id===id);modal(`<div class="eyebrow">${p.area} / ${p.cat}</div><h2 style="margin-top:16px">${p.name}</h2><p>${p.en}</p><p>建議停留 ${p.duration} 分鐘<br>規劃可用時段：${time(p.open)}–${time(p.close)}<br>體驗與餐飲預算估值：RM ${p.cost}</p><p>以上為排程用的概略估值，並非已核實的最新營業時間或票價；宗教場所、展館及店舖可能有休息日、禮拜或臨時調整。免費估值也可能有付費體驗。</p><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.en+' Kuala Lumpur')}" target="_blank" rel="noopener">查地圖與最新資訊 ↗</a>`)}
function download(name,content,type='application/json'){let url=URL.createObjectURL(new Blob([content],{type}));let a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function encode(o){return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function decode(s){if(s.length>180000)throw Error();return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))))}
function payload(){return {version:1,tripId:state.tripId,localPerson:state.me,people:state.people,settings:state.settings,trip:state.trip}}
function valid(p){return p&&typeof p.id==='string'&&p.id.length<100&&typeof p.name==='string'&&p.name.length<=40&&Array.isArray(p.answers)&&p.answers.length<=15&&p.answers.every(n=>Number.isInteger(n)&&n>=0&&n<3)&&Array.isArray(p.votes)&&p.votes.length<=56&&p.votes.every(n=>Number.isInteger(n)&&n>=1&&n<=56)&&(p.votes.length===0||p.answers.length===15)&&new Set(p.votes).size===p.votes.length}
function cleanSettings(s={}){return {days:Number.isInteger(s.days)&&s.days>=1&&s.days<=7?s.days:3,pace:['slow','balanced','full'].includes(s.pace)?s.pace:'balanced',start:[420,480,540,600,660].includes(+s.start)?+s.start:540,end:[1020,1080,1140,1200,1260,1320,1380].includes(+s.end)?+s.end:1200,budget:Number.isFinite(+s.budget)&&+s.budget>=30&&+s.budget<=2000?+s.budget:200,transport:['transit','mixed','taxi'].includes(s.transport)?s.transport:'mixed'}}
function validate(o){if(o.version!==1||typeof o.tripId!=='string'||!Array.isArray(o.people)||!o.people.length||o.people.length>30||!o.people.every(valid)||new Set(o.people.map(p=>p.id)).size!==o.people.length)throw Error('回覆格式不符或資料已損毀');return o}
function importPayload(o){validate(o);if(o.tripId!==state.tripId){modal('<h2>這是另一份旅程備份。</h2><p>還原後會切換目前旅程。請先備份目前的資料，避免失去尚未匯出的回覆。</p><div class="actions"><button class="outline" id="backupCurrent">先備份目前旅程</button><button class="primary" id="restoreTrip">切換並還原旅程</button></div>');$('#backupCurrent').onclick=()=>download('同路-切換前備份.json',JSON.stringify(payload(),null,2));$('#restoreTrip').onclick=()=>{let own=o.people.find(p=>p.id===o.localPerson)||o.people[0];state={version:1,tripId:o.tripId,me:own.id,people:o.people,settings:cleanSettings(o.settings),trip:cleanTrip(o.trip)};step=Math.min(own.answers.length,14);editingQuiz=false;plan=null;save();$('#modal').close();go('overview');toast('已還原旅程備份')};return;}let count=0;for(let p of o.people){if(p.id===state.me)continue;let i=state.people.findIndex(x=>x.id===p.id);if(i<0){if(state.people.length>=30)throw Error('此旅程最多支援 30 位旅伴');state.people.push(p);count++}else if((+p.updated||0)>(+state.people[i].updated||0)){state.people[i]=p;count++}}plan=null;save();$('#modal').close();render();toast(count?`已更新 ${count} 位旅伴的回覆`:'沒有新的旅伴回覆（自己的檔案不會被覆蓋）')}
function share(){modal(`<div class="eyebrow">BETTER TOGETHER</div><h2 style="margin-top:16px">邀請旅伴，一起把旅行排好。</h2><p>這是純靜態網站，沒有伺服器同步。邀請連結包含目前旅程快照；旅伴完成測驗和投票後，把回覆連結或 JSON 檔交給你，再由你匯入合併。</p><button class="outline" id="renameShare">修改我的名字 ✎</button><div class="participant-list">${state.people.map(p=>`<div class="participant-row"><span class="avatar">${esc(p.name.slice(0,1))}</span><div>${esc(p.name)} ${p.id===state.me?'（你）':''}<small>${p.answers.length}/15 題 · ${p.votes.length} 個想去</small></div></div>`).join('')}</div><label>可分享連結（含所有旅伴的名字、偏好與票選）<textarea id="shareLink" readonly></textarea></label><div class="actions"><button class="primary" id="copyInvite">複製邀請連結 ↗</button><button class="outline" id="copyReply">複製我的回覆</button><button class="outline" id="exportData">匯出旅程 JSON</button></div><hr style="border:0;border-top:1px solid #dde2d3;margin:25px 0"><label>貼上旅伴的回覆連結或 JSON<textarea id="importText" placeholder="貼在這裡，再按匯入"></textarea></label><div class="actions"><button class="primary" id="importTextBtn">匯入旅伴回覆</button><label class="outline" style="margin:0;cursor:pointer">選擇 JSON 檔<input type="file" id="importFile" accept="application/json,.json" style="display:none"></label></div><p>請僅分享給旅伴。資料含旅行偏好；清除瀏覽器資料前，建議先匯出備份。連結過長時請改用 JSON 檔。</p>`);$('#renameShare').onclick=()=>{$('#modal').close();$('#editName').click()};const base=location.href.split('#')[0];let link=base+'#invite='+encode(payload());$('#shareLink').value=link;async function copy(t){try{await navigator.clipboard.writeText(t);toast('已複製連結')}catch{$('#shareLink').value=t;$('#shareLink').select();toast('請手動複製選取的連結')}}$('#copyInvite').onclick=()=>copy(link);$('#copyReply').onclick=()=>copy(base+'#reply='+encode({version:1,tripId:state.tripId,people:[me()]}));$('#exportData').onclick=()=>download('同路-旅程備份.json',JSON.stringify(payload(),null,2));function read(text){try{let raw=text.trim();let o=raw.startsWith('{')?JSON.parse(raw):decode(new URL(raw).hash.split('=').slice(1).join('='));importPayload(o)}catch(e){toast(e.message||'無法讀取，請使用完整回覆連結或 JSON')}}$('#importTextBtn').onclick=()=>read($('#importText').value);$('#importFile').onchange=async e=>{let f=e.target.files[0];if(f){if(f.size>200000){toast('檔案過大，請選擇旅程 JSON');return}read(await f.text())}}}
function info(){modal(`<div class="eyebrow">ABOUT THIS LITTLE ADVENTURE</div><h2 style="margin-top:16px">一起旅行，也保留自己的模樣。</h2><p>同路是一個無需安裝、無需帳號的靜態旅行工具。先做 15 題測驗，再從 56 個地點投票，最後把大家的期待排成路線。</p><h3>路線如何產生？</h3><p>以每票 8 分、類別偏好平均每點 3 分為基礎，扣除直線距離與等待成本，逐站挑選符合可用時段、每日預算和節奏的候選地點。每天由 KLCC 區域出發，已排地點不重複。這是啟發式建議，並非全域最短路線。</p><h3>資料的邊界</h3><p>地點參考 <a href="https://www.malaysia.travel/explore/top-places-to-visit-in-kuala-lumpur" target="_blank" rel="noopener">馬來西亞觀光局</a>與<a href="https://ebrochures.malaysia.travel/en/malaysia-travel-guide/kuala-lumpur/" target="_blank" rel="noopener">吉隆坡旅遊指南</a>。56 筆資料為探索清單；座標、營業時段、費用及停留時間均為排程概略估值，未逐筆核實。票數只統計已匯入的旅伴，沒有即時共享資料庫。</p><p>每種節奏最多安排 3／5／7 站，各站額外留 40／25／10 分鐘休息；交通按距離及所選模式估算。未排入的地點會在行程下方列出。</p><p>影像為 Unsplash 吉隆坡旅行意象，並非每個地點的實景。網站可整包部署至任何靜態主機。</p>`)}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go(b.dataset.view));$('.brand').onclick=e=>{e.preventDefault();go('overview')};$('#shareTop').onclick=share;$('#openHelp').onclick=info;$('#dataInfo').onclick=info;$('#editName').onclick=()=>{modal(`<h2>旅伴怎麼稱呼你？</h2><label>你的名字<input id="nameInput" type="text" maxlength="40" value="${esc(me().name)}"></label><button class="primary" id="saveName">儲存名字</button>`);$('#saveName').onclick=()=>{let n=$('#nameInput').value.trim();if(!n){toast('請填寫名字');return}me().name=n;save();$('#modal').close();render()}};
render();
if(location.hash.startsWith('#invite=')||location.hash.startsWith('#reply=')){let kind=location.hash.slice(1).split('=')[0];try{let incoming=validate(decode(location.hash.split('=').slice(1).join('=')));history.replaceState(null,'',location.pathname+location.search);if(kind==='reply'){modal('<h2>收到旅伴的回覆了。</h2><p>確認匯入這份偏好與投票？同一旅程中，只有較新的旅伴版本會合併。</p><button class="primary" id="confirmMerge">匯入回覆</button>');$('#confirmMerge').onclick=()=>{try{importPayload(incoming)}catch(e){toast(e.message)}}}else{modal(`<div class="eyebrow">YOU’RE INVITED</div><h2 style="margin-top:16px">${esc(cleanTrip(incoming.trip).title)}</h2><p>${incoming.people.length} 位旅伴的旅程邀請。加入會切換目前的旅程，請先匯出既有旅程以保留備份。</p><label>你的名字<input id="joinName" maxlength="40" placeholder="旅伴怎麼稱呼你？"></label><div class="actions"><button class="primary" id="joinTrip">加入旅程 ↗</button><button class="outline" id="backupBeforeJoin">先備份原旅程</button></div>`);$('#backupBeforeJoin').onclick=()=>download('同路-原旅程備份.json',JSON.stringify(payload(),null,2));$('#joinTrip').onclick=()=>{let name=$('#joinName').value.trim();if(!name){toast('填個名字再出發吧');return}if(incoming.people.length>=30){toast('此旅程已達 30 位旅伴上限');return}state={version:1,tripId:incoming.tripId,me:crypto.randomUUID(),people:incoming.people,settings:cleanSettings(incoming.settings),trip:cleanTrip(incoming.trip)};state.people.push({id:state.me,name,answers:[],votes:[],updated:Date.now()});step=0;plan=null;save();$('#modal').close();go('quiz')}}}catch{toast('邀請連結無效，請向旅伴索取完整連結')}}
