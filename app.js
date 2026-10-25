const $=s=>document.querySelector(s),E=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),D=()=>new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}),U=p=>p+Date.now()+Math.random().toString(36).slice(2,5);
const ART={abysse:'radial-gradient(at 20% 25%,#1e9fd8,#0000 55%),radial-gradient(at 85% 75%,#46f0dc88,#0000 50%),linear-gradient(160deg,#040814,#14507a)',ecume:'radial-gradient(at 70% 20%,#fff,#0000 50%),radial-gradient(at 20% 80%,#8fc3dc,#0000 55%),linear-gradient(160deg,#e7f2f8,#9fc8de)',pavillon:'radial-gradient(at 25% 30%,#c0392b,#0000 45%),radial-gradient(at 80% 80%,#6f8fbf,#0000 55%),linear-gradient(160deg,#0a0f1e,#1a2d57)',or:'radial-gradient(at 30% 25%,#f3dc8b,#0000 50%),radial-gradient(at 80% 80%,#a8832f,#0000 55%),linear-gradient(160deg,#120d06,#5a4216)'};
const IC={book:'<svg width=18 height=18 fill=none stroke=currentColor stroke-width=1.8><path d="M3 3h6a3 3 0 0 1 3 3v10a2 2 0 0 0-2-2H3zM15 3H9"/><path d="M15 3v11h-3"/></svg>',dos:'<svg width=18 height=18 fill=none stroke=currentColor stroke-width=1.8><path d="M2 5h5l2 2h7v8H2z"/></svg>',tst:'<svg width=18 height=18 fill=none stroke=currentColor stroke-width=1.8><path d="M3 9l4 4 8-8"/></svg>'};
const QS=[['Que représente la science ?',['L’art de la création','Observer et attendre que l’on vous aide','La recherche du savoir et l’amélioration des choses existantes'],2],['Que signifie la biologie ?',['Étudier les animaux','L’étude du corps humain et des modifications génétiques','L’étude du corps humain'],1],['Que signifie être prothésiste ?',['Étude du corps artificiel','Création de marionnettes','Crée des êtres artificiels'],2],['Pour débuter une carrière scientifique, que faut-il faire ?',['Travailler seul sur son projet','Viser un projet très complexe sans les bases','Viser un projet réalisable qui aidera pour les futurs projets'],2],['Pour vous, la science ?',['Est quelque chose de facile','Ne demande pas de travail','Doit être prise au sérieux et se faire sur le long terme'],2],['Conditions pour commencer vos études ?',['Être matelot','Être lieutenant','Être lieutenant et membre de la Division Scientifique','Être lieutenant scientifique et réussir le test','Lieutenant + membre + test réussi + validation du Conseil Scientifique'],4],['L’étude des yeux relève de quelle catégorie ?',['Médical','Scientifique'],0],['Pour un projet simple, un groupe de travail ?',['Non, pas obligatoire','Oui, obligatoire','Pas obligatoire mais recommandé'],2],['À partir d’un projet intermédiaire ?',['Groupe de travail obligatoire','Groupe de travail non obligatoire','Groupe de travail recommandé'],0],['Quel est le pH d’une solution neutre ?',['3','7','11','14'],1],['La photosynthèse produit principalement :',['Dioxyde de carbone','Oxygène et glucose','Eau et minéraux','Azote et phosphore'],1]].map(([q,o,c])=>({q,o,c}));
const LV=[...new Set(['Recrue','Matelot','Lieutenant','Capitaine','Commodore','Vice-Amiral','Amiral en chef','Homme de corvée','Moussaillon','Marin','Caporal','Sergent','Lieutenant','Capitaine','Colonel','Amiral en chef','Contre-Amiral','Vice-Amiral','Amiral','Amiral en chef'])];
const gradeId=grade=>`grade-${grade.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
function normalizeHierarchy(state){
const previous=Array.isArray(state.roles)?state.roles:[];
return{
lvs:[...LV],
roles:LV.map((title,index)=>{
const old=previous.find(role=>role.title===title)||previous.find(role=>role.lv===title);
return{id:old?.id||gradeId(title),title,desc:'',lv:title,color:old?.color||['#1e9fd8','#46f0dc','#d9b24c','#8a1c2b'][index%4]}
})
}
}
let S,adminOn=false,tab='bib',cur=0;
const supabaseConfig=window.DSM_SUPABASE_CONFIG||{};
const supabaseClient=window.supabase&&supabaseConfig.url&&supabaseConfig.anonKey?window.supabase.createClient(supabaseConfig.url,supabaseConfig.anonKey):null;
let currentUser=null,isEditor=false,isAdmin=false,userPermissions={},siteChannel=null,remoteUpdatePending=false;
const reportError=error=>{console.error(error);alert(`Une erreur est survenue : ${error.message||error}`)};
window.edgeFunctionErrorMessage=async error=>{
const response=error?.context;
if(response?.json){
try{const payload=await response.clone().json();if(typeof payload?.error==='string')return payload.error}
catch(parseError){console.error(parseError)}
}
return error?.message||String(error)
};
const canEdit=()=>isEditor&&adminOn;
const hasPermission=permission=>isAdmin||userPermissions[permission]===true;
function requirePermission(permission){
if(!currentUser||!adminOn){alert('Connecte-toi et active le mode édition pour effectuer cette action.');return false}
if(!hasPermission(permission)){alert('Ton grade ne t’autorise pas à effectuer cette action.');return false}
return true
}
function loadSharedState(render=true){return supabaseClient.from('dsm_site_state').select('data').eq('id',true).maybeSingle().then(async({data,error})=>{if(error)throw error;if(!data)return;if(!data.data||!Array.isArray(data.data.secs)||!Array.isArray(data.data.books))throw new Error('Le contenu partagé Supabase a un format invalide.');const hierarchy=normalizeHierarchy(data.data),hierarchyChanged=JSON.stringify(data.data.lvs)!==JSON.stringify(hierarchy.lvs)||JSON.stringify(data.data.roles)!==JSON.stringify(hierarchy.roles);S={...S,...data.data,...hierarchy,att:S.att||[]};await db(1,S);if(hierarchyChanged&&isAdmin){const{error:saveError}=await supabaseClient.from('dsm_site_state').upsert({id:true,data:{...data.data,...hierarchy},updated_at:new Date().toISOString()});if(saveError)throw saveError}if(render)R()})}
async function updateSession(session,render=true){
currentUser=session?.user||null;
isEditor=false;isAdmin=false;userPermissions={};
if(currentUser){
const{data,error}=await supabaseClient.rpc('dsm_my_access');
if(error)throw error;
isAdmin=!!data?.is_admin;
userPermissions=data?.permissions||{};
isEditor=isAdmin||Object.values(userPermissions).some(Boolean);
}
if(!isEditor){adminOn=false;document.body.classList.remove('adm')}
for(const permission of ['library','lockers','quiz','hierarchy'])document.body.classList.toggle(`perm-${permission}`,hasPermission(permission));
if(tab==='adm'&&!isAdmin)tab='bib';
$('#auth').textContent=currentUser?'Compte':'Connexion';
$('#auth').title=currentUser?(isAdmin?`Administrateur : ${currentUser.email}`:isEditor?`Connecté : ${currentUser.email}`:`Compte sans droit d’édition : ${currentUser.email}`):'Connexion réservée aux membres autorisés';
renderTabs();
if(supabaseClient)await loadSharedState(render)
}
function login(){
if(!supabaseClient){alert(supabaseConfig.url&&supabaseConfig.anonKey?'La bibliothèque Supabase n’a pas pu être chargée. Vérifie ta connexion.':'Configure d’abord l’URL et la clé publique Supabase dans supabase-config.js.');return}
const m=$('#m');
m.innerHTML=`<div class=md><h3>Connexion éditeur<button class=x onclick=cl()>✕</button></h3><form class=mb><label>E-mail<input name=email type=email autocomplete=username required></label><label>Mot de passe<input name=password type=password autocomplete=current-password required></label><button class=b style="text-align:center">Se connecter</button></form></div>`;
m.classList.add('on');
m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const{error}=await supabaseClient.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){reportError(error);return}cl()}
}
async function openRegistration(token){
const m=$('#m');
m.innerHTML=`<div class=md><h3>Créer un compte<button class=x onclick=cl()>✕</button></h3><p class=hint style="padding:16px 20px 0">Inscription réservée aux personnes possédant le lien privé.</p><form class=mb><label>E-mail<input name=email type=email autocomplete=email maxlength="320" required></label><label>Mot de passe<input name=password type=password autocomplete=new-password minlength="8" required></label><label>Confirmer le mot de passe<input name=confirm type=password autocomplete=new-password minlength="8" required></label><button class=b type=submit style="text-align:center">Créer mon compte</button></form></div>`;
m.classList.add('on');
const form=m.querySelector('form');
const submit=form.querySelector('button[type=submit]');
form.onsubmit=async event=>{
event.preventDefault();
const formData=new FormData(form),email=String(formData.get('email')||'').trim().toLowerCase(),password=formData.get('password');
if(password!==formData.get('confirm')){alert('Les deux mots de passe ne correspondent pas.');return}
submit.disabled=true;
try{
const {error}=await supabaseClient.functions.invoke('dsm-registration',{body:{action:'create-account',token,email,password}});
if(error){reportError(new Error(await window.edgeFunctionErrorMessage(error)));return}
const {error:signInError}=await supabaseClient.auth.signInWithPassword({email,password});
if(signInError){reportError(new Error(`Le compte a été créé, mais la connexion automatique a échoué : ${signInError.message}`));return}
alert('Compte créé et connecté. Un administrateur devra t’attribuer un grade.');
cl();
}catch(error){reportError(error)}
finally{submit.disabled=false}
};
try{
const {data,error}=await supabaseClient.functions.invoke('dsm-registration',{body:{action:'check-link',token}});
if(error){reportError(new Error(await window.edgeFunctionErrorMessage(error)));cl();return}
if(data?.valid!==true){alert('Ce lien privé est invalide ou a été désactivé. Demande un nouveau lien à l’administrateur.');cl()}
}catch(error){reportError(error);cl()}
}
async function handleRegistrationLink(){
const token=new URLSearchParams(location.hash.slice(1)).get('inscription');
if(!token)return;
history.replaceState(null,'',location.pathname+location.search);
if(supabaseClient)await openRegistration(token);
else alert('La connexion au service de comptes est indisponible.');
}
window.addEventListener('hashchange',()=>handleRegistrationLink().catch(reportError));
function account(){
const m=$('#m');
m.innerHTML=`<div class=md><h3>Mon compte<button class=x onclick=cl()>✕</button></h3><form class=mb><p>Connecté : ${E(currentUser.email||'')}</p><label>Nouveau mot de passe<input name=password type=password autocomplete=new-password minlength="8" required></label><label>Confirmer le mot de passe<input name=confirm type=password autocomplete=new-password minlength="8" required></label><button class=b style="text-align:center">Enregistrer le mot de passe</button></form><button class="b s g" id=signout style="margin:0 20px 20px">Se déconnecter</button></div>`;
m.classList.add('on');
m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),password=f.get('password');if(password!==f.get('confirm')){alert('Les deux mots de passe ne correspondent pas.');return}const{error}=await supabaseClient.auth.updateUser({password});if(error){reportError(error);return}alert('Mot de passe mis à jour.');cl()};
m.querySelector('#signout').onclick=async()=>{const{error}=await supabaseClient.auth.signOut();if(error){reportError(error);return}cl()}
}
function authAction(){if(!supabaseClient){login();return}if(currentUser){account();return}login()}
function subscribeToSharedState(){
if(!supabaseClient)return;
siteChannel=supabaseClient.channel('dsm-site-state').on('postgres_changes',{event:'*',schema:'public',table:'dsm_site_state'},()=>{if(canEdit()){remoteUpdatePending=true;return}loadSharedState().catch(reportError)}).subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reportError(new Error(`La synchronisation en direct a échoué (${status}).`))})
}
function seed(){const c=['#0d2b4e','#1e6f8c','#7fd6e0','#8a1c2b'],bk=(i,s,t,a,th,tx)=>({id:'b'+i,sec:s,title:t,author:a,theme:th,color:c[i%4],img:null,text:tx,date:D()});
S={secs:[{id:'s1',name:'Sciences Fondamentales'},{id:'s2',name:'Minéraux & Kairoseki'}],
books:[bk(0,'s1','Chimie Organique Appliquée','Dr. Vegapunk','Chimie','Chapitre 1 — Fondamentaux\n- Liaisons covalentes\n- Réactivité des molécules\n\nChapitre 2 — Synthèse\n- Préparation d’alcools\n- Oxydation sélective\n\nChapitre 3 — Applications\n- Synthèse pharmaceutique\n- Chimie verte'),bk(1,'s1','Biologie Moléculaire','Pr. Y. Hayashi','Biologie','Chapitre 1 — Structure de l’ADN\n- Double hélice\n- Réplication\n\nChapitre 2 — Expression génétique\n- Transcription\n- Traduction'),bk(2,'s2','Le Kairoseki : propriétés et usages','Cdt. L. Aurel','Minéralogie','Chapitre I — Formation\nLe Kairoseki se forme au fond des mers. Il neutralise le pouvoir des fruits du démon.\n\nChapitre II — Applications\n- Menottes\n- Blindage des cellules\n- Armement naval'),bk(3,'s1','Le pH et les Solutions','Dr. K. Mizuno','Chimie','Le pH mesure l’acidité d’une solution.\n- pH < 7 : acide\n- pH = 7 : neutre\n- pH > 7 : basique')],
cas:[{id:'c1',nom:'Lt. Aurel',titre:'Alliages navals',desc:'Notes sur le blindage des coques',art:'abysse',tone:'l',date:D(),en:[{t:'Test de résistance',b:'Coque en acier trempé : tenue à 4 000 kg/cm².',img:null,date:D()},{t:'Revêtement',b:'Couche anticorrosion testée en eau salée.',img:null,date:D()}]},{id:'c2',nom:'Cdt. Mizuno',titre:'Biologie marine',desc:'Faune des abysses',art:'pavillon',tone:'d',date:D(),en:[{t:'Relevé n°1',b:'Observation en eaux profondes.',img:null,date:D()}]}],
att:[],...normalizeHierarchy({roles:[]}),qs:QS}}
async function db(w,v){return new Promise((resolve,reject)=>{const q=indexedDB.open('MarineSci',1);q.onupgradeneeded=()=>q.result.createObjectStore('k');q.onsuccess=()=>{const o=q.result.transaction('k',w?'readwrite':'readonly').objectStore('k'),g=w?o.put(v,'s'):o.get('s');g.onsuccess=()=>resolve(g.result);g.onerror=()=>reject(g.error)};q.onerror=()=>reject(q.error)})}
async function save(){
try{
if(!supabaseClient||!canEdit()){await db(1,S);return}
const{att,...data}=S;
if(new Blob([JSON.stringify(data)]).size>750*1024)throw new Error('Le contenu et les images dépassent 750 Ko. Réduis la taille ou le nombre d’images avant de publier.');
await db(1,S);
const{error}=await supabaseClient.from('dsm_site_state').upsert({id:true,data,updated_at:new Date().toISOString()});
if(error)throw error
}catch(error){reportError(error)}
}
function adm(){if(!isEditor){if(currentUser)alert('Ce compte n’est pas autorisé à modifier le site.');else login();return}adminOn=!adminOn;document.body.classList.toggle('adm',adminOn);if(!adminOn&&remoteUpdatePending){remoteUpdatePending=false;loadSharedState().catch(reportError)}}
const TABS=[['bib','Bibliothèque'],['tst','Tests'],['cas','Casiers'],['hie','Hiérarchie'],['arc','Archives'],['adm','Administration']];
function renderTabs(){$('#tabs').innerHTML=TABS.filter(([k])=>k!=='adm'||isAdmin).map(([k,l])=>`<button class="${k==tab?'on':''}" onclick="go('${k}')">${l}</button>`).join('')}
function go(t){if(t==='adm'&&!isAdmin){alert('Accès réservé à l’administrateur.');return}tab=t;renderTabs();R()}
const hero=(e,t,k,p)=>`<div class="hero"><svg viewBox="0 0 48 30"><use href="#em"/></svg><div class="ey">${e}</div><h1>${t}<i>${k||'海軍'}</i></h1><p>${p}</p></div>`;
function R(){clearInterval(R.t);const a=$('#app');if(tab==='adm'){window.renderAdmin(a);return}({bib:rBib,tst:rTst,cas:rCas,hie:rHie,arc:rArc})[tab](a)}
/* ---- Form générique ---- */
function form(t,f,cb,permission){if(!requirePermission(permission))return;const m=$('#m');m.innerHTML=`<div class=md><h3>${t}<button class=x onclick=cl()>✕</button></h3><form class=mb>${f.map(x=>`<label>${x.l}${x.t=='area'?`<textarea name=${x.k}>${E(x.v)}</textarea>`:x.t=='sel'?`<select name=${x.k}>${x.o.map(o=>`<option value="${E(o[0])}" ${o[0]==x.v?'selected':''}>${E(o[1])}</option>`).join('')}</select>`:x.t=='file'?`<input type=file name=${x.k} accept="image/*"${x.m?' multiple':''}>`:`<input name=${x.k} value="${E(x.v)}" ${x.t=='color'?'type=color':''}>`}</label>`).join('')}<button class=b style="text-align:center">Valider</button></form></div>`;m.classList.add('on');
m.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!requirePermission(permission))return;const o={};for(const x of f){const el=e.target.elements[x.k];const rf=f=>new Promise(r=>{const fr=new FileReader;fr.onload=()=>r(fr.result);fr.readAsDataURL(f)});o[x.k]=x.t=='file'?(x.m?await Promise.all([...el.files].map(rf)):(el.files[0]?await rf(el.files[0]):null)):el.value}cl();await cb(o);await save();R()}}
const cl=()=>$('#m').classList.remove('on');
const ask=m=>confirm(m);
/* ---- Bibliothèque ---- */
function updateBookCarousel(carousel){
const track=carousel.querySelector('.sh');
const [previous,next]=carousel.querySelectorAll('.book-controls button');
previous.disabled=track.scrollLeft<=4;
next.disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-1;
}
function scrollBooks(button,direction){
const carousel=button.closest('.book-carousel');
const track=carousel.querySelector('.sh');
track.scrollLeft+=direction*track.clientWidth*.8;
updateBookCarousel(carousel);
}
function rBib(a){
a.innerHTML=hero('Archive scientifique','Bibliothèque','','Collection de cours et de documents de la Division Scientifique. Ouvre un livre pour le feuilleter.')+`<div class=w><div class=bar><b class=cg style="font-size:22px">${S.books.length} ouvrage${S.books.length>1?'s':''}</b><span><button class="b s" onclick="addSec()">+ Section</button> <button class="b s g" onclick="bookF()">+ Livre</button></span></div>`+S.secs.map(s=>{
const books=S.books.filter(b=>b.sec==s.id);
return `<div class=sl>${E(s.name)}<small>${books.length}</small><button class="b s g ad" onclick="delSec('${s.id}')">✕</button></div><div class=book-carousel><div class=book-controls aria-label="Navigation des livres"><button type=button aria-label="Livres précédents" onclick="scrollBooks(this,-1)">←</button><button type=button aria-label="Livres suivants" onclick="scrollBooks(this,1)">→</button></div><div class=sh>${books.map(b=>`<div class=bk onclick="read('${b.id}')"><div class=cv style="background-color:${b.color};${b.img?`background-image:url(${b.img});`:''}color:${lum(b.color)>.55?'#101820':'#fff'}"><svg viewBox="0 0 48 30"><use href="#em"/></svg><b>${b.img?'':E(b.title)}</b></div><p>${E(b.title)}<br>${E(b.author)}</p></div>`).join('')}<div class=add onclick="bookF(null,'${s.id}')">+ Ajouter</div></div></div>`
}).join('')+'</div>';
a.querySelectorAll('.book-carousel').forEach(carousel=>{
const track=carousel.querySelector('.sh');
track.addEventListener('scroll',()=>updateBookCarousel(carousel),{passive:true});
updateBookCarousel(carousel);
});
}
const lum=h=>(.299*parseInt(h.slice(1,3),16)+.587*parseInt(h.slice(3,5),16)+.114*parseInt(h.slice(5,7),16))/255;
const addSec=()=>form('Nouvelle section',[{k:'n',l:'Nom de la section',v:''}],o=>{if(o.n.trim())S.secs.push({id:U('s'),name:o.n.trim()})},'library');
const delSec=id=>{if(!requirePermission('library'))return;if(ask('Supprimer cette section et ses livres ?')){S.secs=S.secs.filter(s=>s.id!=id);S.books=S.books.filter(b=>b.sec!=id);save();R()}};
function bookF(id,sec){const b=S.books.find(x=>x.id==id)||{title:'',author:'',theme:'',color:'#0d2b4e',text:'',sec:sec||S.secs[0]?.id};if(!S.secs.length)return addSec();
form(id?'Modifier le livre':'Ajouter un livre',[{k:'title',l:'Titre',v:b.title},{k:'author',l:'Auteur / Scientifique',v:b.author},{k:'theme',l:'Thème',v:b.theme},{k:'sec',l:'Section',t:'sel',o:S.secs.map(s=>[s.id,s.name]),v:b.sec},{k:'color',l:'Couleur de couverture',t:'color',v:b.color},{k:'img',l:'Image de couverture',t:'file'},...(b.pages?[]:[{k:'text',l:'Contenu du cours',t:'area',v:b.text}])],o=>{if(!o.title.trim())return;if(id)Object.assign(b,o,{img:o.img||b.img});else S.books.push({id:U('b'),...o,date:D()})},'library')}
function read(id){
const b=S.books.find(x=>x.id==id);
if(!b)return;
const chapters=(b.text||'').match(/[\s\S]{1,650}(\n|$)/g)||[];
const cover=`<div class="flipbook-page flipbook-cover" style="background-color:${b.color};${b.img?'':'background-image:linear-gradient(145deg,#ffffff20,#00000066),linear-gradient(35deg,#071421, '+b.color+')'};color:${lum(b.color)>.55?'#101820':'#fff'}">${b.img?`<img class="flipbook-cover-image" src="${b.img}" alt="">`:''}<span class="flipbook-cover-label">Division Scientifique de la Marine</span><div><h2>${E(b.title)}</h2><p>${E(b.author)}</p></div><small>${E(b.theme)} · DSM</small></div>`;
const pages=(b.pages||chapters.map(text=>({b:text}))).map((page,index)=>`<div class="flipbook-page">${page.t?`<h3>${E(page.t)}</h3>`:''}${page.img?`<img src="${page.img}" alt="">`:''}${E(page.b||'')}<small>${E(b.title)} — p.${index+1}</small></div>`);
const bookPages=[cover,...pages];
cur=0;
let turning=false;
const rd=$('#rd');
const draw=()=>{
const previous=cur>0?bookPages[cur-1]:'';
const next=cur<bookPages.length-1?bookPages[cur+1]:'';
rd.innerHTML=`<button class=x style="position:absolute;top:18px;right:24px;font-size:22px" aria-label="Fermer le livre" onclick="$('#rd').classList.remove('on')">✕</button><div class="flipbook-stage ${cur===0?'is-cover':''}" role="group" aria-label="${E(b.title)} — page ${cur+1} sur ${bookPages.length}"><div class="flipbook-page">${next||bookPages[cur]}</div><div class="flipbook-leaf"><div class="flipbook-face">${bookPages[cur]}</div><div class="flipbook-face flipbook-face-back">${next||bookPages[cur]}</div></div><button class="flipbook-turn-button prev" type="button" aria-label="Tourner la page précédente" ${cur===0?'disabled':''}>‹</button><button class="flipbook-turn-button next" type="button" aria-label="Tourner la page suivante" ${cur===bookPages.length-1?'disabled':''}>›</button></div><div class="flipbook-toolbar"><button class="b s g" type="button" aria-label="Page précédente" ${cur===0?'disabled':''}>←</button><span>Page ${cur+1} / ${bookPages.length}</span><button class="b s g" type="button" aria-label="Page suivante" ${cur===bookPages.length-1?'disabled':''}>→</button>${!isEditor?'':`<button class="b s g" onclick="bookF('${id}');$('#rd').classList.remove('on')">Modifier</button><button class="b s g" onclick="pagesF('${id}');$('#rd').classList.remove('on')">Pages</button><button class="b s g ad" onclick="delBook('${id}')">Supprimer</button>`}</div>`;
const stage=rd.querySelector('.flipbook-stage');
const turn=(direction)=>{
if(turning)return;
const target=cur+direction;
if(target<0||target>=bookPages.length)return;
turning=true;
const leaf=stage.querySelector('.flipbook-leaf');
stage.querySelector('.flipbook-page').innerHTML=bookPages[target];
leaf.innerHTML=`<div class="flipbook-face">${bookPages[cur]}</div><div class="flipbook-face flipbook-face-back">${bookPages[target]}</div>`;
leaf.classList.add(`turn-${direction>0?'forward':'backward'}`);
let fallback;
const finish=()=>{
clearTimeout(fallback);
cur=target;
turning=false;
draw();
};
leaf.addEventListener('animationend',finish,{once:true});
fallback=setTimeout(finish,700);
};
stage.querySelector('.prev').addEventListener('click',()=>turn(-1));
stage.querySelector('.next').addEventListener('click',()=>turn(1));
rd.querySelector('[aria-label="Page précédente"]').addEventListener('click',()=>turn(-1));
rd.querySelector('[aria-label="Page suivante"]').addEventListener('click',()=>turn(1));
let startX=null;
stage.addEventListener('pointerdown',event=>{
if(event.target.closest('.flipbook-turn-button'))return;
startX=event.clientX;
});
stage.addEventListener('pointerup',event=>{
if(startX===null)return;
const distance=event.clientX-startX;
const origin=startX;
startX=null;
if(Math.abs(distance)>35){turn(distance<0?1:-1);return}
const bounds=stage.getBoundingClientRect();
turn(origin<bounds.left+bounds.width/2?-1:1);
});
stage.addEventListener('pointercancel',()=>{startX=null});
};
window.fl=direction=>{
if(direction>0)rd.querySelector('.flipbook-turn-button.next')?.click();
else rd.querySelector('.flipbook-turn-button.prev')?.click();
};
draw();
rd.classList.add('on');
}
document.addEventListener('keydown',e=>{if(!$('#rd').classList.contains('on'))return;if(e.key=='ArrowRight')fl(1);if(e.key=='ArrowLeft')fl(-1);if(e.key=='Escape')$('#rd').classList.remove('on')});
const delBook=id=>{if(!requirePermission('library'))return;if(ask('Supprimer ce livre ?')){S.books=S.books.filter(b=>b.id!=id);$('#rd').classList.remove('on');save();R()}};
function pagesF(id){if(!requirePermission('library'))return;const b=S.books.find(x=>x.id==id);if(!b.pages){b.pages=((b.text||'').match(/[\s\S]{1,650}(\n|$)/g)||[]).map((t,i)=>({t:'Page '+(i+1),b:t,img:null}));b.text=''}
$('#m').innerHTML=`<div class=md><h3>${E(b.title)} — pages<button class=x onclick=cl()>✕</button></h3><div class=mb><span><button class="b s" onclick="pgF('${id}')">+ Page</button> <button class="b s g" onclick="cl();read('${id}')">Lire</button></span>${b.pages.map((p,i)=>`<div class=en><b>${E(p.t)}</b><span style="float:right"><button class=x onclick="mv('${id}',${i},-1)">↑</button><button class=x onclick="mv('${id}',${i},1)">↓</button><button class=x onclick="pgF('${id}',${i})">✎</button><button class=x onclick="pgDel('${id}',${i})">✕</button></span>${p.img?`<img src="${p.img}">`:''}<p style="white-space:pre-wrap">${E((p.b||'').slice(0,160))}</p></div>`).join('')||'<p style="color:var(--mut)">Aucune page.</p>'}</div></div>`;$('#m').classList.add('on');save()}
const pgF=(id,i)=>{const b=S.books.find(x=>x.id==id),p=i!=null?b.pages[i]:{t:'',b:'',img:null};form(i!=null?'Modifier la page':'Nouvelle page',[{k:'t',l:'Titre de la page',v:p.t},{k:'b',l:'Texte',t:'area',v:p.b},{k:'img',l:p.img?'Remplacer l’image':'Image',t:'file'},...(p.img?[{k:'rm',l:'Image actuelle',t:'sel',o:[['0','Conserver'],['1','Retirer']],v:'0'}]:[])],o=>{const n={t:o.t,b:o.b,img:o.img||(o.rm=='1'?null:p.img)};if(i!=null)Object.assign(p,n);else b.pages.push(n);pagesF(id)},'library')};
const mv=(id,i,d)=>{if(!requirePermission('library'))return;const a=S.books.find(x=>x.id==id).pages,j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];pagesF(id)};
const pgDel=(id,i)=>{if(!requirePermission('library'))return;if(ask('Supprimer cette page ?')){S.books.find(x=>x.id==id).pages.splice(i,1);pagesF(id)}};
/* ---- Tests ---- */
const need=()=>Math.ceil(S.qs.length*.72);
function rTst(a){const canManage=adminOn&&hasPermission('quiz');a.innerHTML=hero('Évaluation scientifique','Tests & Quiz','','Démontre tes connaissances pour intégrer la Division Scientifique.')+`<div class=w><div class=gr><div class=cd onclick="quiz()" style="text-align:center;padding:32px"><h3>Whitelist Test</h3><p>${S.qs.length} questions · 15 minutes · minimum ${need()}/${S.qs.length}</p><br><span class=b>Commencer</span></div></div>${canManage?`<div class=sl>Questions <button class="b s add" onclick="quizF()">+ Question</button></div><div class=gr>${S.qs.map((q,i)=>`<div class=cd><h3>Q${i+1}. ${E(q.q)}</h3><p>${q.o.map((option,index)=>`${index+1}. ${E(option)}`).join('<br>')}</p><p>Réponse correcte : ${q.c+1}</p><button class="b s add" onclick="quizF(${i})">Modifier</button> <button class="b s add" onclick="quizDel(${i})">Supprimer</button></div>`).join('')}</div>`:''}<div class=sl>Résultats</div><div class=gr>${S.att.map(t=>`<div class=cd style="--c:${t.ok?'var(--aq)':'var(--rd)'}" onclick="rev('${t.id}')"><button class="ad quiz-delete" onclick="event.stopPropagation();delAtt('${t.id}')">✕</button><h3>${E(t.nom)}</h3><b style="font:600 28px 'JetBrains Mono';color:${t.ok?'var(--aq)':'var(--rd)'}">${t.pct}%</b><p>${t.sc}/${t.n} · ${t.ok?'Admis(e)':'Refusé(e)'} · ${t.date}</p></div>`).join('')||'<p style="color:var(--mut)">Aucun résultat pour l’instant.</p>'}</div></div>`}
const quizF=index=>{
if(!requirePermission('quiz'))return;
const question=index==null?{q:'',o:[],c:0}:S.qs[index];
const m=$('#m');
m.innerHTML=`<div class=md><h3>${index==null?'Ajouter une question':'Modifier une question'}<button class=x onclick=cl()>✕</button></h3><form class=mb><label>Question<input name=q value="${E(question.q)}" required></label><label>Réponses (une par ligne)<textarea name=options required>${E(question.o.join('\n'))}</textarea></label><label>Numéro de la bonne réponse (à partir de 1)<input name=correct type=number min=1 value="${question.c+1}" required></label><button class=b style="text-align:center">Enregistrer</button></form></div>`;
m.classList.add('on');
m.querySelector('form').onsubmit=async event=>{
event.preventDefault();
if(!requirePermission('quiz'))return;
const values=new FormData(event.currentTarget),prompt=String(values.get('q')||'').trim(),options=String(values.get('options')||'').split(/\r?\n/).map(option=>option.trim()).filter(Boolean),correct=Number(values.get('correct'))-1;
if(!prompt||options.length<2||!Number.isInteger(correct)||correct<0||correct>=options.length){alert('Indique une question, au moins deux réponses et un numéro de réponse correcte valide.');return}
const updated={q:prompt,o:options,c:correct};
if(index==null)S.qs.push(updated);else S.qs[index]=updated;
cl();await save();R()
}
};
const quizDel=index=>{if(!requirePermission('quiz'))return;if(S.qs.length<=1){alert('Le quiz doit conserver au moins une question.');return}if(ask('Supprimer cette question ?')){S.qs.splice(index,1);save();R()}};
function quiz(){const m=$('#m');m.innerHTML=`<div class=md><h3>Whitelist Test<button class=x onclick=cl()>✕</button></h3><div class=mb><label>Nom du candidat<input id=qn></label>${S.qs.map((q,i)=>`<div class=q><b>Q${i+1}. ${E(q.q)}</b>${q.o.map((o,j)=>`<label><input type=radio name=q${i} value=${j}>${E(o)}</label>`).join('')}</div>`).join('')}<button class=b style="text-align:center" onclick="sub()">Soumettre</button></div></div>`;m.classList.add('on')}
async function sub(){const nom=$('#qn').value.trim();if(!nom)return $('#qn').focus();let sc=0;const d=S.qs.map((q,i)=>{const c=document.querySelector(`input[name=q${i}]:checked`),g=c?+c.value:-1;if(g==q.c)sc++;return{l:q.q,g:g<0?'Non répondu':q.o[g],c:q.o[q.c],ok:g==q.c}});
const t={id:U('t'),nom,sc,n:S.qs.length,pct:Math.round(sc/S.qs.length*100),ok:sc>=need(),d,date:D()};S.att.unshift(t);await save();rev(t.id);R()}
function rev(id){const t=S.att.find(x=>x.id==id);$('#m').innerHTML=`<div class=md><h3>${E(t.nom)} · ${t.date}<button class=x onclick=cl()>✕</button></h3><div class=mb><div style="text-align:center"><b style="font:700 54px 'JetBrains Mono';color:${t.ok?'var(--aq)':'var(--rd)'}">${t.pct}%</b><p>${t.ok?'Admis(e)':'Refusé(e)'} — ${t.sc}/${t.n}</p></div>${t.d.map((x,i)=>`<div class=q style="border-color:${x.ok?'var(--aq)':'var(--rd)'}"><b>Q${i+1}. ${E(x.l)}</b><p>Réponse : ${E(x.g)}</p><p style="color:var(--aq)">Correcte : ${E(x.c)}</p></div>`).join('')}</div></div>`;$('#m').classList.add('on')}
const delAtt=id=>{if(!requirePermission('quiz'))return;if(ask('Supprimer ce résultat ?')){S.att=S.att.filter(t=>t.id!=id);save();R()}};
/* ---- Casiers : Glass Folder Cards ---- */
const NB=['abysse','ecume','pavillon','or'];
function folder(o){const k=o.w/340,f=(o.files||[]).slice(-4),el=document.createElement('div');el.className='gf'+(o.create?' gf-create':'');el.dataset.t=o.tone;el.style.cssText=`width:${o.w}px;height:${326*k}px;--art:${ART[o.art]||ART.abysse}`;
el.innerHTML=`<div class=gs style="transform:translateY(${54*k}px) scale(${k})"><div class=gk><div class=gsh></div><div class=gb></div><div class=gfl>${f.map((x,v)=>{const r=(n)=>((Math.sin((x.n.length+v)*12.9898+n)*43758.5453)%1+1)%1;return`<button class=sh2 style="--sl:${f.length>1?v/(f.length-1)*2-1:0};--d:${f.length-1-v};--jx:${((r(1)-.5)*10).toFixed(1)};--jr:${((r(2)-.5)*3.2).toFixed(1)};z-index:${v+1};${x.img?`background-image:url(${x.img})`:''}" data-i="${x.i}"><span>${E(x.n)}<em>${E(x.m||'')}</em></span></button>`}).join('')}</div><div class=gfr><button class=hit aria-label="${E(o.label)}"></button><div class=lb><b>${E(o.label)}</b><small>${E(o.meta)}</small></div></div>${o.add?`<button class=key aria-label="Ajouter">+</button>`:''}</div></div>`;
const hit=el.querySelector('.hit');hit.onclick=()=>o.press?o.press():el.toggleAttribute('data-o');
el.querySelector('.key')?.addEventListener('click',o.add);el.querySelectorAll('.sh2').forEach(s=>s.onclick=()=>o.pick(+s.dataset.i));
el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect();el.style.setProperty('--px',((e.clientX-r.left)/r.width*2-1).toFixed(2));el.style.setProperty('--py',((e.clientY-r.top)/r.height*2-1).toFixed(2))});el.addEventListener('pointerleave',()=>{el.style.setProperty('--px',0);el.style.setProperty('--py',0)});
new IntersectionObserver((es,io)=>{if(es[0].isIntersecting){setTimeout(()=>el.dataset.in=1,o.delay||0);io.disconnect()}},{threshold:.2}).observe(el);return el}
document.addEventListener('pointerdown',e=>document.querySelectorAll('.gf[data-o]').forEach(f=>{if(!f.contains(e.target))f.removeAttribute('data-o')}));
function rCas(a){a.innerHTML=hero('Recherche personnelle','Casiers de recherche','','Chaque dossier regroupe les notes, formules et découvertes d’un chercheur. Survole pour entrouvrir, clique pour feuilleter.')+'<div class=w><div class=fg id=fg></div></div>';const w=innerWidth<600?290:330,g=$('#fg');
S.cas.forEach((c,i)=>g.append(folder({w,label:c.titre,meta:`${c.nom} · ${c.en.length} entrée${c.en.length>1?'s':''}`,art:c.art,tone:c.tone,delay:i*140,files:c.en.map((e,j)=>({n:e.t,m:e.date,img:IM(e)[0],i:j})).reverse(),add:()=>casier(c.id),pick:()=>casier(c.id),press:null})));
g.append(folder({w,label:'Nouveau casier',meta:'Cliquer pour créer',art:'abysse',tone:'d',delay:S.cas.length*140,files:[],press:()=>casF(),create:true}))}
const casF=id=>{const c=S.cas.find(x=>x.id==id)||{nom:'',titre:'',desc:'',art:NB[S.cas.length%4],tone:'l'};form(id?'Modifier le casier':'Créer un casier',[{k:'nom',l:'Ton nom',v:c.nom},{k:'titre',l:'Titre',v:c.titre},{k:'desc',l:'Description',t:'area',v:c.desc},{k:'art',l:'Apparence du dossier',t:'sel',o:[['abysse','Abysse'],['ecume','Écume'],['pavillon','Pavillon'],['or','Or']],v:c.art},{k:'tone',l:'Verre',t:'sel',o:[['l','Clair'],['d','Fumé']],v:c.tone}],o=>{if(!o.nom.trim()||!o.titre.trim())return;if(id)Object.assign(c,o);else S.cas.unshift({id:U('c'),...o,en:[],date:D()})},'lockers')};
function casier(id){const c=S.cas.find(x=>x.id==id);$('#m').innerHTML=`<div class=md><h3>${E(c.titre)}<button class=x onclick=cl()>✕</button></h3><div class=mb><p style="color:var(--aq)">${E(c.nom)} · ${E(c.desc)}</p><span><button class="b s" onclick="entF('${id}')">+ Entrée</button> <button class="b s g" onclick="casF('${id}')">Modifier le casier</button> <button class="b s g ad" onclick="delCas('${id}')">Supprimer le casier</button></span>${c.en.map((e,i)=>`<div class=en><b>${E(e.t)}</b><span style="float:right"><button class=x onclick="entF('${id}',${i})">✎</button><button class="x ad" onclick="delEn('${id}',${i})">✕</button></span>${IM(e).map(s=>`<img src="${s}">`).join('')}<p style="white-space:pre-wrap">${E(e.b)}</p><small style="color:var(--mut)">${e.date}</small></div>`).join('')||'<p style="color:var(--mut)">Aucune entrée. Documente tes travaux.</p>'}</div></div>`;$('#m').classList.add('on')}
const IM=e=>e.imgs||(e.img?[e.img]:[]);
const entF=(id,i)=>{const c=S.cas.find(x=>x.id==id),e=i!=null?c.en[i]:{t:'',b:''};form(i!=null?'Modifier l’entrée':'Nouvelle entrée',[{k:'t',l:'Titre',v:e.t},{k:'b',l:'Texte',t:'area',v:e.b},{k:'imgs',l:'Ajouter des images',t:'file',m:1},...(IM(e).length?[{k:'rm',l:'Images existantes ('+IM(e).length+')',t:'sel',o:[['0','Conserver'],['1','Retirer']],v:'0'}]:[])],o=>{if(!o.t.trim()||!o.b.trim())return;const im=[...(o.rm=='1'?[]:IM(e)),...o.imgs];if(i!=null)Object.assign(e,{t:o.t,b:o.b,imgs:im,img:null});else c.en.unshift({t:o.t,b:o.b,imgs:im,date:D()});casier(id)},'lockers')};
const delEn=(id,i)=>{if(!requirePermission('lockers'))return;if(ask('Supprimer cette entrée ?')){S.cas.find(x=>x.id==id).en.splice(i,1);save();casier(id);R()}};
const delCas=id=>{if(!requirePermission('lockers'))return;if(ask('Supprimer ce casier ?')){S.cas=S.cas.filter(c=>c.id!=id);cl();save();R()}};
/* ---- Hiérarchie ---- */
function rHie(a){
const canManage=adminOn&&hasPermission('hierarchy');
a.innerHTML=hero('Organisation','Hiérarchie & Grades','','Grades des membres de la Division Scientifique.')+`<div class=w><div class=bar><b class=cg style="font-size:22px">Grades</b>${canManage?'<span><button class="b s" onclick="roleF()">+ Grade</button></span>':''}</div><div class=gr>${[...S.roles].map(grade=>`<div class="cd" data-role-id="${E(grade.id)}" style="--c:${E(grade.color)}"><h3>${E(grade.title)}</h3></div>`).join('')||'<p style="color:var(--mut)">Aucun grade défini.</p>'}</div></div>`;
if(canManage)a.querySelectorAll('[data-role-id]').forEach(card=>card.addEventListener('click',()=>roleF(card.dataset.roleId)))
}
const hierarchyPermissions=['library','lockers','quiz','hierarchy'];
async function clearHierarchyPermissions(scope,subject){
for(const permission of hierarchyPermissions){
const{error}=await supabaseClient.rpc('dsm_admin_set_permission',{p_scope:scope,p_subject:subject,p_permission:permission,p_allowed:false});
if(error)throw error
}
}
const roleF=id=>{
if(!requirePermission('hierarchy'))return;
const grade=S.roles.find(x=>x.id==id)||{title:'',desc:'',lv:S.lvs[0],color:'#1e9fd8'};
form(id?'Modifier le grade':'Ajouter un grade',[{k:'title',l:'Nom du grade',v:grade.title},{k:'desc',l:'Description',t:'area',v:grade.desc},{k:'color',l:'Couleur',t:'color',v:grade.color}],o=>{const title=o.title.trim();if(!title)return;if(S.roles.some(item=>item.id!==grade.id&&item.title.toLocaleLowerCase()===title.toLocaleLowerCase())){alert('Ce grade existe déjà.');return}if(id){if(title!==grade.title){alert('Un grade existant ne peut pas être renommé. Supprime-le puis crée le nouveau grade.');return}Object.assign(grade,o,{title,lv:title})}else{const newGrade={id:gradeId(title),lv:title,...o,title};S.roles.push(newGrade);S.lvs.push(title)}},'hierarchy');
if(id){
const button=document.createElement('button');
button.className='b s g ad';
button.type='button';
button.textContent='Supprimer ce grade';
button.addEventListener('click',async()=>{
if(!requirePermission('hierarchy')||!ask(`Supprimer le grade « ${grade.title} » ? Les membres concernés devront recevoir un autre grade dans l’administration.`))return;
button.disabled=true;
try{
if(S.roles.length<=1){alert('Conserve au moins un grade pour pouvoir attribuer les membres.');button.disabled=false;return}
await clearHierarchyPermissions('role',grade.id);
await clearHierarchyPermissions('grade',grade.lv);
S.roles=S.roles.filter(item=>item.id!==grade.id);
S.lvs=S.lvs.filter(level=>level!==grade.lv);
cl();await save();R()
}catch(error){button.disabled=false;reportError(error)}
});
$('#m .mb').append(button)
}
};
/* ---- Archives : le coffre ---- */
const items=()=>[...S.books.map(b=>({k:'Livre',i:'book',t:b.title,s:b.author,f:()=>read(b.id)})),...S.cas.flatMap(c=>c.en.map(e=>({k:'Casier',i:'dos',t:e.t,s:c.titre,f:()=>casier(c.id)}))),...S.att.map(t=>({k:'Résultat',i:'tst',t:t.nom+' — '+t.pct+'%',s:t.ok?'Admis(e)':'Refusé(e)',f:()=>rev(t.id)}))];
function rArc(a){const it=items();a.innerHTML=hero('Punk Records · Archives','Coffre des Archives','','Chaque document déposé rejoint le coffre. Survole-le pour suspendre le défilement.')+`<div class=w><div class=cx id=cx><svg viewBox="0 0 520 340"><defs><radialGradient id=gl><stop offset=0 stop-color=#ffe9a0 /><stop offset=.5 stop-color=#d9b24c stop-opacity=.45 /><stop offset=1 stop-color=#d9b24c stop-opacity=0 /></radialGradient><linearGradient id=wd x1=0 y1=0 x2=0 y2=1><stop offset=0 stop-color=#17365f /><stop offset=1 stop-color=#06132a /></linearGradient><linearGradient id=gd x1=0 y1=0 x2=1 y2=1><stop offset=0 stop-color=#f3dc8b /><stop offset=.5 stop-color=#c9a03c /><stop offset=1 stop-color=#8a6a1f /></linearGradient></defs><ellipse class=pl cx=260 cy=150 rx=250 ry=130 fill=url(#gl) /><path d="M50 190C50 50 140 6 260 6s210 44 210 184z" fill=url(#wd) stroke=url(#gd) stroke-width=5 /><path d="M92 190C92 84 160 42 260 42s168 42 168 148z" fill=#030a16 /><path d="M140 190C140 92 196 58 260 58s120 34 120 132z" fill=url(#gl) opacity=.7 /><g fill=url(#gd)><rect x=118 y=62 width=26 height=128 /><rect x=376 y=62 width=26 height=128 /><rect x=50 y=164 width=420 height=12 /></g><rect x=50 y=176 width=420 height=20 fill=#02060f /><g fill=url(#gd)>${Array.from({length:22},(_,i)=>`<ellipse cx=${96+i*15.5} cy=${176+Math.sin(i*1.7)*5} rx=13 ry=6 />`).join('')}</g></svg><div class=cp id=cp></div><svg class=fr viewBox="0 0 520 340"><path d="M50 184h420v128a20 20 0 0 1-20 20H70a20 20 0 0 1-20-20z" fill=url(#wd) stroke=url(#gd) stroke-width=4 /><g fill=url(#gd)><rect x=50 y=184 width=420 height=16 rx=4 /><rect x=118 y=184 width=26 height=148 /><rect x=376 y=184 width=26 height=148 /><rect x=50 y=300 width=420 height=14 /></g><g stroke=#ffffff12>${[226,252,278].map(y=>`<path d="M52 ${y}H468" />`).join('')}</g><rect x=228 y=200 width=64 height=66 rx=10 fill=url(#gd) stroke=#6b4f12 stroke-width=2 /><svg x=238 y=214 width=44 height=28 viewBox="0 0 48 30" fill=#071428><use href="#em" /></svg><circle cx=260 cy=254 r=4 fill=#071428 /></svg></div><div class=st><span>Livres <b>${S.books.length}</b></span><span>Casiers <b>${S.cas.length}</b></span><span>Entrées <b>${S.cas.reduce((n,c)=>n+c.en.length,0)}</b></span><span>Résultats <b>${S.att.length}</b></span></div><div class=sl>Registre</div><div class=reg>${it.map((x,i)=>`<div onclick="items()[${i}].f()"><em>${x.k}</em>${E(x.t)}<small>${E(x.s)}</small></div>`).join('')}</div></div>`;
if(!it.length)return;let n=0,paused=false;const cx=$('#cx'),cp=$('#cp');cx.onmouseenter=()=>paused=true;cx.onmouseleave=()=>paused=false;
const drop=()=>{if(paused||tab!='arc')return;const x=it[n++%it.length],c=document.createElement('div');c.className='chip';c.innerHTML=`<i>${IC[x.i]}</i><div><b>${E(x.t)}</b><small>${x.k} · ${E(x.s)}</small></div>`;c.onclick=x.f;cp.append(c);
c.animate([{transform:'translateY(-110px) scale(.8)',opacity:0},{transform:'translateY(6px) scale(1.1)',opacity:1}],{duration:600,easing:'cubic-bezier(.34,1.3,.5,1)',fill:'forwards'});
setTimeout(()=>{if(c.matches(':hover'))return c.dataset.h=1;c.animate([{transform:'translateY(6px) scale(1.1)',opacity:1},{transform:'translateY(110px) scale(.8)',opacity:0}],{duration:700,fill:'forwards'}).onfinish=()=>c.remove()},2400);};
drop();R.t=setInterval(()=>{cp.querySelectorAll('[data-h]').forEach(c=>{if(!c.matches(':hover'))c.remove()});drop()},2900)}
async function initialize(){
const local=await db(0);
if(local&&local.secs)S=local;else seed();
if(!S.qs)S.qs=QS;
await db(1,S);
go('bib');
if(supabaseClient){
subscribeToSharedState();
const{data,error}=await supabaseClient.auth.getSession();
if(error){reportError(error);return}
await updateSession(data.session,false).catch(reportError);
supabaseClient.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>updateSession(session).catch(reportError),0)})
}
await handleRegistrationLink();
}
initialize().catch(reportError);
