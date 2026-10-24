const DSM_PERMISSIONS=[
{key:'library',label:'Bibliothèque'},
{key:'lockers',label:'Casiers de recherche'},
{key:'quiz',label:'Questions de quiz et résultats locaux'},
{key:'hierarchy',label:'Grades et rôles'}
];
const permissionStyles=document.createElement('style');
permissionStyles.textContent='body:not(.adm) #app .quiz-delete,body:not(.adm) #app .gf-create,body:not(.adm) #m button[onclick*="pgF"],body:not(.adm) #m button[onclick*="mv"],body:not(.adm) #m button[onclick*="pgDel"],body.adm:not(.perm-quiz) #app .quiz-delete,body.adm:not(.perm-lockers) #app .gf-create,body.adm:not(.perm-library) #m button[onclick*="pgF"],body.adm:not(.perm-library) #m button[onclick*="mv"],body.adm:not(.perm-library) #m button[onclick*="pgDel"]{display:none!important}';
document.head.append(permissionStyles);

window.renderAdmin=async function(a){
if(!isAdmin){a.innerHTML='<div class="w"><p>Accès réservé à l’administrateur.</p></div>';return}
a.innerHTML=`<div class="hero"><div class="ey">Administration</div><h1>Comptes & permissions</h1><p>Les droits d’un membre cumulent ceux de son grade et de son rôle. Une dérogation individuelle prévaut sur les deux.</p></div><div class="admin-panel"><p class="hint">L’administrateur principal conserve tous les droits. Les nouveaux comptes n’ont aucun droit tant que tu ne leur en accordes pas.</p><section><h2>Lien d’inscription privé</h2><p class="hint">Toute personne qui possède ce lien peut créer un compte sans recevoir d’e-mail. Ne le publie pas. Créer un nouveau lien désactive immédiatement le précédent.</p><button class="b s" id="generate-registration-link" type="button">Créer un lien privé</button><div id="registration-link-panel" hidden><label for="registration-link">Lien d’inscription</label><div class="registration-actions"><input id="registration-link" type="url" readonly><button class="b s" id="copy-registration-link" type="button">Copier le lien</button></div></div></section><section><h2>Membres et affectations</h2><div id="admin-members"><p class="hint">Chargement…</p></div></section><section><h2>Pouvoirs par grade et par rôle</h2><p class="hint">Coche une permission pour l’accorder. Les droits de grade et de rôle s’additionnent.</p><div id="admin-permissions"></div></section><section><h2>Dérogations individuelles</h2><p class="hint">Choisis « Par défaut » pour retirer une dérogation et revenir aux permissions cumulées du grade et du rôle.</p><div id="admin-overrides"></div></section></div>`;

const registrationButton=a.querySelector('#generate-registration-link');
const registrationPanel=a.querySelector('#registration-link-panel');
const registrationInput=a.querySelector('#registration-link');
registrationButton.onclick=async()=>{
registrationButton.disabled=true;
try{
const {data,error}=await supabaseClient.functions.invoke('dsm-registration',{body:{action:'generate-link'}});
if(error){reportError(new Error(await window.edgeFunctionErrorMessage(error)));return}
if(typeof data?.token!=='string')throw new Error('La fonction n’a pas renvoyé de lien d’inscription.');
registrationInput.value=`${location.origin}${location.pathname}#inscription=${encodeURIComponent(data.token)}`;
registrationPanel.hidden=false;
registrationButton.textContent='Régénérer le lien privé';
}catch(error){reportError(error)}
finally{registrationButton.disabled=false}
};
a.querySelector('#copy-registration-link').onclick=async()=>{
registrationInput.select();
try{
await navigator.clipboard.writeText(registrationInput.value);
alert('Lien privé copié. Toute personne qui le possède peut créer un compte.');
}catch(clipboardError){
try{
if(!document.execCommand('copy'))throw clipboardError;
alert('Lien privé copié. Toute personne qui le possède peut créer un compte.');
}catch(error){
reportError(new Error('La copie automatique a échoué. Le lien reste sélectionné : copie-le manuellement.'));
}
}
};

const {data,error}=await supabaseClient.rpc('dsm_admin_list_permissions');
if(error){reportError(error);return}
const settings=data||{grades:[],roles:[],overrides:[],members:[]};
const gradeRights=new Set(settings.grades.map(item=>`${item.grade}:${item.permission}`));
const roleRights=new Set(settings.roles.map(item=>`${item.role_id}:${item.permission}`));
const overrides=new Map(settings.overrides.map(item=>[`${item.user_id}:${item.permission}`,item.allowed]));

const members=document.querySelector('#admin-members');
members.innerHTML=settings.members.length?settings.members.map(member=>`<div class="member-row" data-member="${E(member.user_id)}"><span class="member-email">${E(member.email||'Compte sans adresse e-mail')}${member.is_admin?' · Administrateur principal':member.is_member?'':' · À affecter'}</span>${member.is_admin?'<span class="hint">Tous les droits</span>':`<label>Grade <select data-grade ${!S.lvs.length?'disabled':''}>${S.lvs.map(grade=>`<option value="${E(grade)}" ${grade===member.grade?'selected':''}>${E(grade)}</option>`).join('')}</select></label><label>Rôle <select data-role><option value="">Aucun rôle</option>${S.roles.map(role=>`<option value="${E(role.id)}" ${role.id===member.role_id?'selected':''}>${E(role.title)}</option>`).join('')}</select></label><button class="b s" data-save-member>${member.is_member?'Enregistrer':'Associer au site'}</button>`}</div>`).join(''):'<p class="hint">Aucun compte Supabase trouvé.</p>';

const matrix=(scope,items,rights)=>{
if(!items.length)return '';
return `<h3>${scope==='grade'?'Permissions par grade':'Permissions par rôle'}</h3><table class="matrix"><thead><tr><th>${scope==='grade'?'Grade':'Rôle'}</th>${DSM_PERMISSIONS.map(permission=>`<th>${permission.label}</th>`).join('')}</tr></thead><tbody>${items.map(item=>{
const subject=scope==='grade'?item:item.id,label=scope==='grade'?item:item.title;
return `<tr><th>${E(label)}</th>${DSM_PERMISSIONS.map(permission=>`<td><input type="checkbox" aria-label="${E(label)} — ${E(permission.label)}" data-scope="${scope}" data-subject="${E(subject)}" data-permission="${permission.key}" ${rights.has(`${subject}:${permission.key}`)?'checked':''}></td>`).join('')}</tr>`
}).join('')}</tbody></table>`
};
document.querySelector('#admin-permissions').innerHTML=matrix('grade',S.lvs,gradeRights)+matrix('role',S.roles,roleRights);

const assignable=settings.members.filter(member=>!member.is_admin&&member.is_member);
document.querySelector('#admin-overrides').innerHTML=assignable.length?assignable.map(member=>`<div class="override-row"><strong class="member-email">${E(member.email||'Compte sans adresse e-mail')}</strong>${DSM_PERMISSIONS.map(permission=>{
const key=`${member.user_id}:${permission.key}`,value=overrides.has(key)?String(overrides.get(key)):'';
return `<label>${permission.label}<select data-override-user="${E(member.user_id)}" data-override-permission="${permission.key}"><option value="" ${value===''?'selected':''}>Par défaut</option><option value="true" ${value==='true'?'selected':''}>Autorisé</option><option value="false" ${value==='false'?'selected':''}>Refusé</option></select></label>`
}).join('')}</div>`).join(''):'<p class="hint">Aucun membre à configurer.</p>';

members.querySelectorAll('[data-save-member]').forEach(button=>button.addEventListener('click',async event=>{
const row=event.currentTarget.closest('[data-member]');
const {error:updateError}=await supabaseClient.rpc('dsm_admin_set_member_access',{
p_user_id:row.dataset.member,
p_grade:row.querySelector('[data-grade]').value,
p_role_id:row.querySelector('[data-role]').value||null
});
if(updateError)reportError(updateError);
await window.renderAdmin(a)
}));

document.querySelector('#admin-permissions').querySelectorAll('input[type=checkbox]').forEach(checkbox=>checkbox.addEventListener('change',async event=>{
const input=event.currentTarget;
const {error:updateError}=await supabaseClient.rpc('dsm_admin_set_permission',{
p_scope:input.dataset.scope,
p_subject:input.dataset.subject,
p_permission:input.dataset.permission,
p_allowed:input.checked
});
if(updateError){input.checked=!input.checked;reportError(updateError)}
}));

document.querySelector('#admin-overrides').querySelectorAll('select[data-override-user]').forEach(select=>select.addEventListener('change',async event=>{
const input=event.currentTarget;
const value=input.value===''?null:input.value==='true';
const {error:updateError}=await supabaseClient.rpc('dsm_admin_set_member_override',{
p_user_id:input.dataset.overrideUser,
p_permission:input.dataset.overridePermission,
p_allowed:value
});
if(updateError){reportError(updateError);await window.renderAdmin(a)}
}));
};
