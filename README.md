# Division Scientifique de la Marine

Site statique hébergé sur Vercel. Supabase stocke le contenu partagé, gère les
comptes et vérifie les autorisations côté base de données.

## Mettre à jour Supabase

Dans le projet existant
<https://supabase.com/dashboard/project/cciziofqreoxvwpbkgsu>, exécute le
fichier `supabase-setup.sql` dans **SQL Editor**. Le script est réexécutable :
il ajoute les tables de rôles et de permissions tout en conservant les éditeurs
déjà enregistrés.

### Désigner le premier administrateur

Après l’exécution du script, dans le SQL Editor, remplace l’adresse d’exemple
par celle du compte déjà créé, puis exécute cette requête une seule fois :

```sql
insert into public.dsm_memberships (user_id, grade, is_admin)
select id, 'Amiral en chef', true
from auth.users
where lower(email) = lower('adresse-administrateur@example.com')
on conflict (user_id) do update set is_admin = true;
```

La requête doit affecter une ligne. Elle ne crée pas de mot de passe : le
propriétaire doit toujours se connecter avec son compte Supabase. L’administrateur
principal est protégé contre le retrait de son statut depuis le panneau du site.

Avant d’inscrire d’autres membres, connecte-toi avec ce compte, active le mode
édition en cliquant sur le titre DSM et enregistre une modification pour créer
l’état partagé initial. Les grades et rôles des membres sont validés par rapport
à cette hiérarchie.

### Activer les inscriptions par lien privé

Depuis l’onglet **Administration**, l’administrateur peut créer un lien
d’inscription privé. Toute personne qui le possède peut créer un compte en
indiquant son adresse e-mail et son mot de passe. Aucun e-mail d’invitation ou
de confirmation n’est envoyé. Le lien est réutilisable ; le régénérer invalide
immédiatement l’ancien. Ne le publie pas et partage-le uniquement avec les
personnes autorisées.

L’inscription et la création du lien passent par une Supabase Edge Function.
Le secret du lien n’est stocké qu’en empreinte dans une table protégée par RLS ;
la clé `service_role` reste exclusivement dans l’environnement serveur.

Réexécute d’abord `supabase-setup.sql` dans le SQL Editor Supabase pour créer
la table du lien privé (le script peut être rejoué sans supprimer les comptes).
Puis, avec la CLI Supabase installée et connectée au projet, déploie la fonction :

```text
supabase login
supabase secrets set DSM_SITE_URL=https://division-scientifique-de-la-marine.vercel.app --project-ref cciziofqreoxvwpbkgsu
supabase functions deploy dsm-registration --no-verify-jwt --project-ref cciziofqreoxvwpbkgsu
supabase functions delete dsm-invite-user --project-ref cciziofqreoxvwpbkgsu
```

Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` sont fournies à la fonction par Supabase. Ne copie
jamais la clé `service_role` dans `supabase-config.js` ni dans le navigateur.
La vérification JWT de la passerelle est désactivée pour permettre aux visiteurs
de vérifier le lien et de s’inscrire ; la fonction vérifie elle-même le secret,
et exige un compte administrateur pour en créer ou régénérer un.
Les nouveaux comptes sont créés sans droits ; attribue leur grade et leur rôle
dans la gestion des membres.

## Comptes et permissions

- Seul l’administrateur principal peut générer le lien privé et configurer les
  permissions. Toute personne possédant le lien peut créer un compte.
- Les nouveaux comptes n’obtiennent aucun droit d’édition par défaut.
- Les droits d’un membre cumulent ceux de son grade et de son rôle.
- Une dérogation individuelle (« autorisé » ou « refusé ») prévaut sur ces
  permissions cumulées.
- Les catégories configurables sont la bibliothèque, les casiers de recherche,
  les questions de quiz et la hiérarchie. Les résultats de quiz restent locaux
  au navigateur.
- Les modifications des contenus partagés sont aussi contrôlées par Supabase
  (RLS et déclencheur SQL), pas seulement par les boutons de l’interface.

Le contenu de démonstration reste visible jusqu’à l’initialisation de l’état
partagé. Connecte-toi avec le compte administrateur, clique sur le titre DSM
pour activer le mode édition, puis enregistre une modification. Les résultats
de quiz restent locaux au navigateur. Les images sont intégrées au document
partagé ; l’application refuse de publier un état total supérieur à 750 Ko.

## Déploiement

Le dépôt dédié existe déjà :
<https://github.com/inkframesstudio-max/Division-Scientifique-de-la-Marine>.
Le projet Vercel est statique (racine `.` et aucun build). Publie les fichiers
de ce dossier dans ce dépôt ; un commit sur `main` déclenche un déploiement
automatique si l’intégration Git de Vercel est connectée.

Ne publie pas `C:\Users\antho` : c’est le dossier personnel, pas le dépôt DSM.
