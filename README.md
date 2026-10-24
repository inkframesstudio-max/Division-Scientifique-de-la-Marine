# Division Scientifique de la Marine

Site HTML statique, hébergeable sur Vercel. Supabase stocke le contenu publié,
diffuse ses modifications en temps réel et réserve l'édition aux comptes autorisés.

## Préparer Supabase

1. Ouvre le projet Supabase existant :
   <https://supabase.com/dashboard/project/cciziofqreoxvwpbkgsu>.
2. Les tables `dsm_editors` et `dsm_site_state` ont été créées et vérifiées
   dans ce projet. Pour recréer la configuration sur un nouveau projet, exécute
   `supabase-setup.sql` dans son SQL Editor.
3. Dans **Authentication > Users**, invite les personnes autorisées à modifier le site.
4. Dans le SQL Editor, autorise chaque compte invité avec son adresse :

   ```sql
   insert into public.dsm_editors (user_id)
   select id from auth.users where lower(email) = lower('adresse@example.com')
   on conflict (user_id) do nothing;
   ```

5. L'URL du projet et sa clé publique (publishable/anon) sont renseignées dans
   `supabase-config.js` et publiées sur GitHub. Cette clé est visible dans le navigateur : c'est
   la sécurité RLS de `supabase-setup.sql` qui protège l'édition. Ne mets jamais
   une clé `service_role` dans ce fichier.
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

Le dépôt DSM dédié existe déjà :
<https://github.com/inkframesstudio-max/Division-Scientifique-de-la-Marine>.
Le site est actuellement accessible via GitHub Pages. La configuration
Supabase doit être mise à jour dans ce dépôt pour activer la synchronisation.

1. Le code de synchronisation est dans `app.js`. Chaque commit sur `main`
   déclenche la mise à jour de GitHub Pages et, si le dépôt est connecté à
   Vercel, un nouveau déploiement.
2. Dans Vercel, le site est configuré comme site statique : aucun build n'est
   nécessaire et le dossier racine est `.`.

Ne publie pas `C:\Users\antho` : c'est le dépôt parent du dossier personnel,
pas le dépôt DSM.

Les comptes d'équipe doivent être invités dans Supabase puis ajoutés à
`dsm_editors` avec la requête ci-dessus. Ne partage jamais un mot de passe ni
une clé `service_role`.
