(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let topics=StudyStorage.read(),active=null,tab='kk-ko',toastTimer;
const library=$('#library');
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function refresh(){
 topics=StudyStorage.read();const query=$('#search-input').value.trim().toLocaleLowerCase(),shown=topics.filter(t=>t.name.toLocaleLowerCase().includes(query));
 $('#topic-count').textContent=topics.length;$('#empty-state').hidden=topics.length>0;
 library.innerHTML=shown.map(t=>`<article class="topic-card" data-open="${esc(t.id)}"><div class="topic-top"><span class="topic-label">ГРАММАТИКА · ${new Date(t.createdAt).toLocaleDateString('ru-RU')}</span><button class="topic-menu" title="Удалить тему" data-delete="${esc(t.id)}">···</button></div><h3>${esc(t.name)}</h3><div class="topic-meta">${t.exercises.length} предложений</div><div class="topic-progress"><span style="width:0%"></span></div></article>`).join('');library.hidden=!shown.length&&topics.length>0;
}
function syncActive(){topics=StudyStorage.read();active=topics.find(t=>t.id===active.id)}
function renderStudy(){
 if(!active)return;const analysis=active.analysis||{};
 $('#analysis-content').innerHTML=[['Мағынасы',analysis.meaning],['Құрылуы',analysis.formation],['Қолданылуы',analysis.usage],['Шектеулер',analysis.restrictions],['Ұқсас құрылымдар',analysis.similarForms]].filter(x=>x[1]).map(x=>`<section><b>${esc(x[0])}</b><p>${esc(x[1])}</p></section>`).join('');
 $$('.tab').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));const exercises=active.exercises.filter(x=>tab==='answers'||x.direction===tab);$('#answer-warning').hidden=tab==='answers';$('#study-progress').innerHTML=`<b>${active.exercises.length}</b>предложений · 2 направления`;
 $('#reveal-all-btn').textContent=active.exercises.every(x=>active.revealed?.[x.id])?'Скрыть ответы':'Показать ответы';
 $('#exercise-list').innerHTML=exercises.map((exercise,index)=>{const originalIndex=active.exercises.indexOf(exercise),revealed=Boolean(active.revealed?.[exercise.id]),answer=`<div class="answer-box" ${revealed?'':'hidden'}><b>ОТВЕТ</b>${esc(exercise.answer)}</div>`;return `<article class="exercise"><div class="exercise-num">${String(exercise.number||originalIndex+1).padStart(2,'0')}</div><div class="exercise-content"><div class="exercise-text ${exercise.direction==='kk-ko'?'kazakh':''}">${esc(exercise.prompt)}</div>${answer}</div></article>`}).join('');
}
function openTopic(id){active=topics.find(t=>t.id===id);if(!active)return;$('#home-view').hidden=true;$('#study-view').hidden=false;tab='kk-ko';renderStudy();window.scrollTo(0,0)}
$('#create-btn').onclick=async()=>{const name=$('#grammar-input').value.trim(),status=$('#create-status'),button=$('#create-btn');if(!name){status.textContent='Введите название грамматики.';status.className='status error';$('#grammar-input').focus();return}button.disabled=true;status.className='status';status.textContent='Обращаемся к подключённому генератору…';try{const topic=await StudyGenerator.generate(name);StudyStorage.upsert(topic);$('#grammar-input').value='';status.textContent='';refresh();toast('Тема добавлена.')}catch(error){status.textContent=error.message.includes('Failed to fetch')||error.message.includes('404')?'Не удалось связаться с генератором. Проверьте запуск сервера и настройки из README.':error.message;status.className='status error'}finally{button.disabled=false}};
$('#grammar-input').onkeydown=event=>{if(event.key==='Enter')$('#create-btn').click()};$('#search-input').oninput=refresh;
library.onclick=event=>{const removeButton=event.target.closest('[data-delete]');if(removeButton){event.stopPropagation();if(confirm('Удалить эту тему?')){StudyStorage.remove(removeButton.dataset.delete);refresh();toast('Тема удалена.')}return}const card=event.target.closest('[data-open]');if(card)openTopic(card.dataset.open)};
$$('.tab').forEach(button=>button.onclick=()=>{tab=button.dataset.tab;if(tab==='answers'){StudyStorage.patch(active.id,topic=>{topic.revealed=topic.revealed||{};topic.exercises.forEach(x=>topic.revealed[x.id]=true);return topic});syncActive()}renderStudy()});
$('#back-btn').onclick=()=>{$('#study-view').hidden=true;$('#home-view').hidden=false;refresh()};$('#print-btn').onclick=()=>window.print();
$('#reset-btn').onclick=()=>{if(confirm('Скрыть все открытые ответы в этой теме?')){StudyStorage.patch(active.id,topic=>{topic.revealed={};return topic});syncActive();renderStudy();toast('Ответы скрыты.')}};
$('#reveal-all-btn').onclick=()=>{const show=!active.exercises.every(x=>active.revealed?.[x.id]);StudyStorage.patch(active.id,topic=>{topic.revealed=topic.revealed||{};topic.exercises.forEach(x=>topic.revealed[x.id]=show);return topic});syncActive();renderStudy()};
$('#export-btn').onclick=()=>{const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob([StudyStorage.exportJSON()],{type:'application/json'}));anchor.download=`moonjang-backup-${new Date().toISOString().slice(0,10)}.json`;anchor.click();URL.revokeObjectURL(anchor.href)};
$('#import-btn').onclick=()=>$('#import-file').click();$('#import-file').onchange=async event=>{try{StudyStorage.importJSON(await event.target.files[0].text());refresh();toast('Темы импортированы.')}catch(error){toast('Ошибка импорта: '+error.message)}event.target.value=''};
$('#theme-toggle').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('moonjang-theme',document.body.classList.contains('dark')?'dark':'light')};if(localStorage.getItem('moonjang-theme')==='dark')document.body.classList.add('dark');refresh();
})();


