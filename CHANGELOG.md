# Changelog — FoodCheck

Une entrée par version déployée (= valeur de `CACHE` dans `sw.js`). Pour chaque version : ce qui change, **pourquoi**, et ce qui est préservé. Les versions sautées (v2–3, v6–8, v14, v25) correspondent à des itérations locales jamais déployées seules.

Les choix écartés sont notés en bas, pour ne pas les rediscuter.

---

## v33 — 2026-10-21 · ℹ️ agrandi, axes du graphique
- ℹ️ sans cercle ni anneau vert : l'icône seule, agrandie à la taille de sa zone tactile (32 px, nouveau `--fs-icon`).
- Axes de l'évolution plus clairs : ordonnée en % avec repères 0 · 50 · 80 · 100, et zone ≥ 80 % légèrement teintée en vert (même seuil que les barres) ; ressenti gradué 1–5 avec l'unité « /5 » ; abscisse avec un trait par semaine et des dates lisibles (« 12 oct. »), la dernière toujours affichée.
- Préservé : données, calculs.

## v32 — 2026-10-21 · Évolution : ajustements
- Filtres de la courbe sur une grille de 4 colonnes en pleine largeur (il restait un vide à droite).
- Plus de saccade au toucher de ⚡😊 : la largeur du graphique est fixe, et la place de la légende et de la phrase de corrélation est toujours réservée (masquée sans le ressenti).
- Jokers : chaque barre affiche son nombre, avec la moyenne par semaine, au lieu de barres sans échelle.
- Préservé : données, calculs.

## v31 — 2026-10-21 · Évolution dans l'Historique
- Ligne discrète « 📈 Évolution », **repliée par défaut** en haut de l'Historique : les cartes de semaine restent le cœur de l'onglet.
- Une fois dépliée : une courbe sur les 12 dernières semaines, au choix : Score (le même calcul que le badge, points colorés selon les mêmes seuils), Quêtes, Quotidien, Féculents, Protéines, Micro, Renfo.
- Bouton ⚡😊 : superpose énergie et humeur (axe 1–5 à droite) et indique s'il y a un lien entre le score et le ressenti (corrélation, à partir de 4 semaines notées). C'est un constat indicatif, pas une preuve.
- Jokers en **barres neutres**, informatives, et non en courbe : ce n'est pas un score « plus bas = mieux ».
- Moins de 3 semaines archivées : un simple message.
- Le calcul du score est désormais partagé entre le badge et la courbe (`weekScore()`), et testé dans `validate.mjs`.
- Préservé : données (aucune migration : tout vient des semaines déjà archivées).

## v30 — 2026-10-21 · Ouverture centrée, ℹ️ en bascule
- Le jour courant s'affiche **au centre** de l'écran à l'ouverture, et non plus collé en haut (perturbant) : on voit la veille au-dessus et le lendemain en dessous.
- ℹ️ fonctionne comme un interrupteur : un nouvel appui referme les Repères et ramène à la vue et à la position d'avant. Le libellé « ← Retour » est supprimé, et un anneau vert autour de ℹ️ indique que les Repères sont ouverts.
- Préservé : données, calculs.

## v29 — 2026-10-20 · Ajustements design
Suite à une critique design (usage, hiérarchie, accessibilité).
- La vue Semaine **s'ouvre sur aujourd'hui** (`scrollToToday()`, au démarrage et via l'onglet) : le geste quotidien passait après tout un écran de quêtes.
- Zones tactiles : check-in ⚡😊 26×36 (rond visible 22 px, au lieu de 21 px), ℹ️ 44 px, pastilles des pools 44 px.
- Contrastes WCAG AA : vert texte `#2C7339`, nouvel `--amber-ink` pour le texte ambre (jokers étaient à 2,98:1).
- Échelle typographique `--fs-xs … --fs-2xl` : 8 tailles au lieu de 21, minimum 12 px.
- Cohérences : 🏃 non cochée sur fond neutre (le vert signifie « accompli ») ; compteurs verts seulement à l'objectif ; ✓ des quêtes seulement à 13/13 ; compteur Renforcement affiché (il était vide), carte pleine largeur.
- Toast d'aide 3,5 s ; libellés accessibles en français.
- `validate.mjs` contrôle désormais l'échelle typo et les zones tactiles.
- Préservé : données, calculs, clé de stockage.

## v28 — 2026-10-17 · Script de validation
- Ajout de `scripts/validate.mjs` : syntaxe, audit HTML/CSS, bump de `CACHE`, logique, migration, rendu (`--render`). Sortie compacte pour économiser des tokens.
- `CLAUDE.md` créé puis mis à jour (le guide de mise en ligne qu'il mentionnait n'existait pas).
- Placeholder 🫐 (Unicode 13) remplacé par 🍇.

## v27 — 2026-10-13
- Les **jokers** sont exclus de « Rétablir les quantités recommandées » : c'est un budget personnel, pas une quantité conseillée.

## v26 — 2026-10-11 · Quantités recommandées
- Section Réglages « ♻️ Quantités recommandées » : bouton « Rétablir maintenant » + option « repartir des quantités recommandées chaque lundi » (désactivée par défaut, migration v25 → v26).
- Ne touche jamais aux aliments ajoutés à la main, aux cibles, ni aux pastilles déjà cochées.
- Réglages réordonnés pour suivre la vue Semaine.

## v24 — 2026-09-26 · Protéine végétale et légumineuses
- Pastille officielle 🌱 « Protéine végétale (tofu, tempeh, seitan…) » ; une entrée créée à la main équivalente est fusionnée dedans avec ses pastilles cochées (migration v23 → v24).
- Les **légumineuses** (cochées une seule fois, dans Féculents) comptent aussi pour ½ protéine : ≈ 8 g contre ≈ 30 g pour une portion de viande. Pas de double saisie.
- Historique : ligne informative « Origine des protéines » (repère PNNS ≈ 50/50), non notée.

## v23 — 2026-08-15 · Pain et variété des féculents
- Ajout du 🥖 pain / wrap comme féculent à part entière.
- Cible de **variété** des féculents découplée et réglable (défaut 6 types) : ajouter un aliment ne doit pas rendre le 100 % plus difficile. On compte la variété, pas la quantité.

## v22 — 2026-08-03 · Historique repliable, badge pondéré
- Cartes de l'Historique repliables, la plus récente dépliée.
- Badge de semaine en moyenne **pondérée** : Renforcement pèse 0,5 (2 pastilles seulement = 0/50/100 %, trop brutal à poids plein).

## v21 — 2026-08-01 · Renforcement musculaire
- Section 💪 Renforcement (2 séances/semaine, repère OMS) et quête Muscu (migration v20 → v21).

## v20 — 2026-07-20
- Variété micro réordonnée pour garder les paires côte à côte dans la grille 2 colonnes (noix | autres oléagineux, huile colza | huile olive).

## v19 — 2026-07-20 · Oméga-3 plus juste, cible protéines
- Scission des oléagineux (noix/lin/chia vs amande/cajou) et des huiles (colza/noix vs olive/avocat) : seuls les premiers apportent des oméga-3. Les ids `noix` et `huile` sont conservés, seuls leurs libellés changent.
- Cible protéines **découplée** du nombre d'aliments (défaut 14 = 2 portions/jour) : ajouter un aliment ne dilue plus le %.
- Fer : le bœuf (héminique) pèse plus que le poulet.

## v18 — 2026-07-16
- Le bœuf devient « Viande rouge (bœuf, porc…) », même plafond cumulé ; le bandeau « plafond conseillé » est retiré au profit de la vue Repères.

## v17 — 2026-07-16
- La semoule cède son emoji 🥣 à l'avoine (plus représentatif du porridge) et prend 🍲.

## v16 — 2026-07-16 · Avoine
- Flocons d'avoine intégrés aux féculents, source directe de Fibres et Magnésium ; une entrée créée à la main est fusionnée (migration v14 → v15).

## v15 — 2026-07-15 · Vue Repères
- Icône ℹ️ → vue Repères : PNNS résumé, repères de portion (paume / poignée), liens mangerbouger.fr et santepubliquefrance.fr.
- Teaser « Repères rapides » en bas de la vue Semaine.
- Féculents notés en variété, pas en quantité : manger moins de glucides n'est pas « mauvais ».

## v13 — 2026-07-14 · Nouveau nom
- « Mon suivi nutrition » devient **FoodCheck** (titre, en-tête, manifest). Sur Android, réinstaller l'app pour voir le nouveau nom.

## v12 — 2026-07-14
- Historique dans le même ordre que la saisie ; jokers affichés à part, en détail consommé (« 1 🍷 · 2 🍰 »), jamais en %.

## v11 — 2026-07-13
- Nouvelles icônes plein cadre (fond vert jusqu'aux bords, compatibles avec les masques Android).

## v10 — 2026-07-13 · Badge de semaine
- Historique : badge 🌟 Excellente / 👍 Bonne / 😐 Moyenne / 😴 En retrait, moyenne de tout sauf les jokers.

## v9 — 2026-07-09 · Check-in du soir
- Notes ⚡ énergie et 😊 humeur (1–5) pour aujourd'hui et les jours passés ; re-taper la même note l'efface. Moyennes dans l'Historique.

## v5 — 2026-07-06 · Jokers et activité
- Jokers 🍷 🍰 🍕 : un budget à dépenser, pas une faute. Ils ne pénalisent ni les quêtes ni le badge.
- Pastille 🏃 « 30 min d'activité » dans la grille quotidienne, qui devient 2×4, et quête Bouger.

## v4 — 2026-07-06
- Pools en cartes sur une grille 2 colonnes ; noms courts (`SHORT_NAMES`) en carte.

## v1 — 2026-07-06 · Première version
- Grille quotidienne (légumes, fruits, laitiers), pools hebdo (protéines, féculents), quêtes vitamines et minéraux, variété micro, Historique, Réglages, PWA hors-ligne.
- Dans la foulée : pastilles indépendantes (booléens, plus de compteurs), dates en heure locale (le calcul UTC décalait d'un jour), échappement des textes saisis, emojis Unicode 13+ remplacés.

---

## Décisions écartées
- **Grammes, calories, base d'aliments, profil poids/taille** : contraire au principe « fréquences par catégorie » et au coût de saisie.
- **Note quotidienne** : l'unité de réussite est la semaine.
- **Jokers comptés comme une faute ou dans le badge** : contraire au principe « zéro culpabilité ».
- **Graphify** (graphe de connaissances du code), 2026-10-20 : inadapté à un dépôt de 5 fichiers. Le savoir utile (le pourquoi des choix) vit dans `CLAUDE.md` et ce changelog, et maintenir un graphe coûterait plus qu'il ne ferait gagner.
- **Vidéo Remotion versionnée dans le dépôt**, 2026-10-18 : testé (vidéo promo de 31 s, OK) mais non conservé ; aurait ajouté une dépendance npm au dépôt.
