# Site d'apprentissage de l'allemand A1–B2 — H-conseil et Formations

Interface en malgache. Chaque élève se connecte avec son **ID + mot de passe** et ne voit **que son niveau**.
Chaque jour d'étude = 1 leçon en 4 étapes : vocabulaire (8 mots), lecture du PDF Drive, exercices Educaplay, « Vita ny lesona ».
Le prof virtuel **Prof Hery** (Gemini) connaît la position et les notes de l'élève pour le conseiller.
Une **page d'essai gratuite** (bouton « Andramo maimaim-poana ») ouvre le Kapitel 1 de chaque niveau : c'est le lien à mettre dans les pubs.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html`, `app.js`, `style.css` | Le site élève (malgache) |
| `admin.html` | Votre page d'administration (créer les élèves, voir la progression, corriger le vocabulaire) |
| `courses.js` | Tous les liens : 32 PDF Drive + quiz Educaplay (A1, A2, B2) + exercices B1 |
| `vocab-demo.js` | Vocabulaire déjà écrit pour l'A1 Kapitel 1 |
| `config.js` | Réglages : **numéro WhatsApp** du bouton « Hisoratra anarana », Kapitel d'essai |
| `netlify/functions/api.mjs` | Serveur : connexion, progression, Prof Hery, vocabulaire, admin |

## Mise en ligne (une seule fois, ~20 minutes)

1. **Clé Gemini** : sur https://aistudio.google.com → *Get API key* → *Create API key*. Copiez-la.
2. **GitHub** : créez un dépôt (ex. `hcf-deutsch`, privé de préférence) et envoyez-y **tout le contenu de ce dossier** (bouton *Add file → Upload files*, glissez les fichiers et le dossier `netlify`).
3. **Netlify** : *Add new site → Import an existing project → GitHub* → choisissez le dépôt → *Deploy* (aucun réglage à changer, `netlify.toml` s'en occupe).
4. Dans Netlify → *Site configuration → Environment variables*, ajoutez :

| Variable | Valeur |
|---|---|
| `GEMINI_API_KEY` | votre clé Gemini |
| `SESSION_SECRET` | une longue phrase secrète au hasard (32 caractères ou plus) |
| `ADMIN_PASSWORD` | votre mot de passe administrateur (8 caractères minimum) |
| `GEMINI_MODEL` | *(facultatif)* par défaut `gemini-2.5-flash` |
| `CHAT_LIMIT` | *(facultatif)* messages Prof Hery par élève et par jour, défaut 80 |
| `DEMO_CHAT_LIMIT` | *(facultatif)* messages par visiteur d'essai et par jour, défaut 15 |

5. *Deploys → Trigger deploy* pour prendre en compte les variables.
6. Ouvrez `https://VOTRE-SITE.netlify.app/admin.html`, entrez `ADMIN_PASSWORD`, créez vos élèves.

## Utilisation au quotidien

- **Créer un élève** : `admin.html` → ID (ex. `A1-001`), nom, niveau, mot de passe (bouton *Générer*), date de fin d'accès si besoin. Transmettez l'ID et le mot de passe à l'élève.
- **Changer de niveau** : modifiez le niveau de l'élève ; son ancienne progression est archivée.
- **Bloquer / prolonger** : case *Bloqué* ou date *Accès jusqu'au*.
- **Suivi** : le tableau montre la leçon en cours, la moyenne des quiz et la dernière activité (rouge = plus de 7 jours sans activité → à relancer).
- **Vocabulaire** : il est créé par Gemini la première fois qu'un élève ouvre une leçon, puis gardé. Relisez-le dans `admin.html` (surtout le malgache) et corrigez si besoin.

## Liens pour les pubs

- Essai direct : `https://VOTRE-SITE.netlify.app/#andramo` (ouvre le choix du niveau)
- Connexion élève : `https://VOTRE-SITE.netlify.app/#hiditra`

## À savoir

- Les PDF restent sur votre Drive (lecture seule). Le site cache les boutons aux non-inscrits, mais un élève connecté peut toujours copier un lien Drive : c'est une limite de Drive.
- Les quiz Educaplay s'ouvrent dans un nouvel onglet ; l'élève saisit ensuite sa note (Educaplay ne la renvoie pas automatiquement).
- La version gratuite de Gemini est limitée en nombre de requêtes et Google peut utiliser les échanges pour améliorer ses modèles ; pour plus de 200 élèves actifs, activez la facturation sur Google AI Studio (coût faible avec Flash).
- Les données (élèves, progression, vocabulaire) sont stockées dans Netlify Blobs, inclus gratuitement dans Netlify.
- Pour modifier un lien PDF ou un quiz : éditez `courses.js` sur GitHub ; Netlify republie automatiquement.
