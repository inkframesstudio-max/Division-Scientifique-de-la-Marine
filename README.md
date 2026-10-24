# Division Scientifique de la Marine

Site HTML statique, hébergeable sur Vercel. Supabase stocke le contenu publié,
diffuse ses modifications en temps réel et réserve l'édition aux comptes autorisés.

## Préparer Supabase

1. Crée un projet Supabase et active le fournisseur d'authentification par e-mail/mot de passe.
2. Exécute `supabase-setup.sql` dans le SQL Editor du projet.
3. Dans **Authentication > Users**, invite les personnes autorisées à modifier le site.
4. Dans le SQL Editor, autorise chaque compte invité avec son adresse :

   ```sql
   insert into public.dsm_editors (user_id)
   select id from auth.users where lower(email) = lower('adresse@example.com')
   on conflict (user_id) do nothing;
   ```

5. Renseigne l'URL du projet et sa clé publique (publishable/anon) dans
   `supabase-config.js`. Cette clé est visible dans le navigateur : c'est la
   sécurité RLS de `supabase-setup.sql` qui protège l'édition. Ne mets jamais une
   clé `service_role` dans ce fichier.
6. Ouvre le site : la bibliothèque de démonstration s'affiche tant que le contenu
   partagé n'a pas encore été créé. Connecte-toi avec un compte autorisé, active
   le mode édition en cliquant le titre DSM, puis enregistre une modification
   pour publier l'état initial dans Supabase.

Les visiteurs peuvent lire le contenu publié. Seuls les identifiants ajoutés à
`dsm_editors` peuvent l'écrire. Les changements enregistrés par un éditeur sont
reçus en direct par les visiteurs et les autres éditeurs. Les résultats de quiz
restent locaux au navigateur et ne sont pas envoyés à la base partagée.
Les images sont intégrées au document partagé ; l'application refuse de publier
un état total supérieur à 750 Ko pour préserver la diffusion en temps réel.

## Déployer sur Vercel

1. Crée un dépôt GitHub **dédié à ce projet** et place-y uniquement le contenu
   de ce dossier. Ne publie pas `C:\Users\antho` : c'est le dépôt parent du
   dossier personnel, pas un dépôt DSM.
2. Dans Vercel, importe ce dépôt. Il n'y a pas de build à lancer : laisse le
   dossier racine du projet sur `.` et publie les fichiers statiques.
3. Chaque `push` sur la branche de production déclenchera un nouveau déploiement.

La mise en ligne nécessite tes propres comptes GitHub, Vercel et Supabase ; aucun
identifiant ni secret de compte n'est stocké dans ce projet.
