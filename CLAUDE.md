# CLAUDE.md — FoodCheck

Guide de travail pour Claude Code sur ce dépôt. À lire avant toute modification.

## Le projet en bref

FoodCheck est une PWA personnelle de suivi nutritionnel hebdomadaire, utilisée sur un téléphone Android. Elle remplace une affiche papier collée sur le frigo où l'on barrait au feutre ce qu'on avait mangé : ce qui n'est pas encore barré oriente les choix en cuisine.

- Hébergement : GitHub Pages, branche `main`, dossier racine → `https://makayelle.github.io/foodcheck/`
- Utilisateur unique : le propriétaire du dépôt. Pas de compte, pas de serveur, aucune donnée envoyée sur internet.
- Langue de l'interface et des échanges : **français**.

## Philosophie produit (ne pas trahir)

Ces principes ont été validés au fil de nombreuses itérations. Toute évolution doit les respecter.

- **Fréquences par catégorie, jamais de grammes ni de calories.** Une pastille = une prise typique. Pas de pesée, pas de base de données d'aliments, pas de profil poids/taille (les repères "paume / poignée" font l'auto-calibration).
- **Saisie en quelques taps.** Chaque ajout de pastille a un coût d'usage quotidien. Préférer modifier/renommer une catégorie existante plutôt qu'en ajouter.
- **L'unité de réussite est la semaine**, pas le jour. Pas de note quotidienne calculée.
- **Zéro culpabilité.** Les jokers (alcool, sucré, ultra-transformé) sont un budget à dépenser, pas une faute. Ils ne pénalisent aucune quête ni le badge.
- **Recommandations officielles** : PNNS / Santé publique France / ANSES, complétées par l'OMS (renforcement musculaire). Repères généraux pour tous, pas de réglages nutritionnels individualisés.
- **Données 100 % locales** (localStorage du navigateur).

## Architecture

Pas de framework, pas de build, pas de dépendances.

```
index.html              # toute l'app : HTML + CSS + JS inline (~1250 lignes)
manifest.json           # manifest PWA (name/short_name "FoodCheck", icônes maskable)
sw.js                   # service worker, cache-first, constante CACHE versionnée
icon-192.png, icon-512.png  # icônes plein cadre (fond vert jusqu'aux bords, masques Android)
GUIDE-MISE-EN-LIGNE.md  # guide utilisateur historique
```

Seule ressource externe : Google Fonts (Fredoka, Nunito), mise en cache par le service worker.

### Vues (`.view`, bascule via `switchView(id)`)

| Vue | Accès | Contenu |
|---|---|---|
| `view-week` | onglet Semaine | Quêtes, Chaque jour (grille 2×4 + check-in ⚡😊), Renforcement, Féculents, Protéines, Variété micro, Jokers, teaser "Repères rapides" |
| `view-history` | onglet Historique | Une carte par semaine archivée, repliable ; la plus récente dépliée au démarrage |
| `view-settings` | onglet Réglages | Sections **dans le même ordre que la vue Semaine** : Renforcement, Féculents, Protéines, Variété micro, Jokers, puis Quantités recommandées, puis Semaine en cours |
| `view-info` | icône ℹ️ de l'en-tête (pas d'onglet) | Repères PNNS/OMS, repères de portion, liens mangerbouger.fr / santepubliquefrance.fr |

## Modèle de données

Clé localStorage : `nutri-suivi-v1` (**ne jamais la changer**, elle porte toutes les données de l'utilisateur). Note : localStorage est lié à l'origine `makayelle.github.io`, partagée avec d'éventuelles autres apps Pages du même compte.

```js
state = {
  config: {
    proteinsTarget: 14,        // cible hebdo protéines, réglable 7–21
    carbsVarietyTarget: 6,     // nb de types de féculents différents visé, réglable 3–10
    autoResetCounts: false,    // repartir des quantités recommandées chaque lundi
    proteins: [{id, name, emoji, count}], carbs: [...], micro: [...], jokers: [...], muscu: [...]
  },
  week: {
    key: "2026-10-12",         // lundi de la semaine, date LOCALE (voir pièges)
    daily: { 0..6: { veg:[b,b,b], fruit:[b,b], dairy:[b,b], move:[b] } },
    pools: { proteins: { poulet:[b,b,b,b], ... }, carbs:{...}, micro:{...}, jokers:{...}, muscu:{...} },
    checkin: { 0..6: { energy:0-5, mood:0-5 } }   // 0 = non saisi
  },
  history: [ { key, stats } ]  // plus récente en premier, 26 semaines max
}
```

- `GROUPS` mappe chaque groupe de pool vers son conteneur DOM (`proteinsPool`, `carbsPool`, `microPool`, `jokersPool`, `muscuPool`).
- **Chaque pastille est un booléen indépendant** dans un tableau (pas un compteur) : on peut cocher/décocher n'importe laquelle. `nDone(arr)` compte les `true`.
- Les aliments ajoutés à la main reçoivent un id généré (`"c" + Date.now().toString(36)`) ; ils comptent dans la variété et les compteurs mais ne sont reliés à **aucune quête**.
- Le lundi (`load()`), la semaine écoulée est archivée avec `computeStats()` puis remplacée par `freshWeek(config)`. Si `autoResetCounts`, `applyRecommendedCounts()` est appliqué avant.

## Logique de calcul (`computeStats`)

- **Quotidien** : pastilles cochées / 56 (8 par jour).
- **Protéines** : `min(pastilles protéines cochées + 0,5 × légumineuses cochées, proteinsTarget)` / `proteinsTarget`. La cible est **découplée** du nombre d'aliments configurés : ajouter un aliment ne dilue pas le %. Les plafonds par aliment (viande rouge ×2) restent des garde-fous.
- **Légumineuses** : cochées **une seule fois**, dans Féculents. Elles comptent comme féculent ET pour ½ protéine (≈ 8 g contre ≈ 30 g pour une portion de viande). Ne jamais demander une double saisie.
- **Féculents (Historique)** : variété = nombre de types touchés au moins une fois, plafonné à `carbsVarietyTarget`. Pas de quantité : manger moins de glucides n'est pas "mauvais".
- **Origine des protéines** (`proteinSplit`) : animal = poulet + boeuf + oeufs + poissongras + poisson ; végétal = `vegetal` + 0,5 × légumineuses. Ligne **informative** dans l'Historique (repère PNNS ≈ 50/50), non notée, hors badge.
- **Jokers** : affichés en détail consommé ("1 🍷 · 2 🍰"), jamais en %.
- **Badge de semaine** : moyenne pondérée de Quêtes, Quotidien, Féculents (variété), Protéines, Variété micro (poids 1) et Renforcement (**poids 0,5**, car 2 pastilles seulement = 0/50/100 %). Jokers exclus. Seuils : ≥ 90 🌟 Excellente, ≥ 75 👍 Bonne, ≥ 50 😐 Moyenne, sinon 😴 En retrait.
- **Couleur des barres** : ≥ 80 vert, ≥ 50 ambre, sinon terracotta.
- **Check-in ⚡😊** : moyennes des jours renseignés uniquement (0 ignoré). Visible pour aujourd'hui et les jours passés. Re-taper la même note l'efface.
- **Quantités recommandées** : `applyRecommendedCounts()` remet le `count` des aliments **par défaut** à leur valeur de `DEFAULT_CONFIG`. Ne touche jamais : les aliments ajoutés à la main, les cibles, les **jokers** (budget personnel, `RESET_EXCLUDED`), et ne recrée pas un aliment supprimé. Les pastilles déjà cochées sont conservées.

### Quêtes (13)

Chaque quête additionne des sources pondérées (`w`, total 1), chacune plafonnée à son objectif hebdo `need`. `srcDone()` gère les sources spéciales `daily` (dont `vegfruit` = légumes + fruits) et `__animal` (poulet + boeuf + oeufs + poisson + poissongras).

Vit. D, Oméga-3, Vit. C, Folates, Fer, B12, Calcium, Fibres, Magnésium, Vit. A, Vit. E, Bouger (7/7 jours), Muscu (2/2 séances). Voir `QUESTS` pour les poids exacts.

Choix nutritionnels assumés à ne pas défaire :
- Oméga-3 : seuls poisson gras, `noix` (noix/lin/chia/chanvre) et `huile` (colza/noix). Amande/cajou (`autresoleagineux`) et olive/avocat (`huileolive`) **ne comptent pas**.
- Fer : bœuf (0,25) pèse plus que poulet (0,15), reflet du fer héminique.
- B12 : la protéine végétale n'y contribue pas.
- Vit. C : tous les fruits du quotidien comptent pareil (approximation acceptée).
- Avoine : source directe de Fibres et Magnésium (pas besoin de cocher "complet" en plus).

## Règles de développement

1. **Les ids sont éternels.** Ne jamais renommer un `id` d'aliment, de groupe ou de quête : il indexe les données de l'utilisateur. Pour changer un libellé, modifier `name` (et `SHORT_NAMES` pour l'affichage en carte).
2. **Toute évolution de structure passe par `migrate(s)`.** Les étapes doivent être idempotentes, commentées avec la version (`// v27 → v28 : …`), et **préserver les pastilles déjà cochées** (redimensionner les tableaux en tronquant/complétant, ne jamais les recréer vides). Une nouvelle entrée par défaut doit aussi être ajoutée à `DEFAULT_CONFIG` et à `SHORT_NAMES`.
3. **Bumper `CACHE` dans `sw.js` à chaque déploiement** (`nutri-suivi-vN`, actuellement v27). Sans ça, la PWA installée continue de servir l'ancienne version hors-ligne.
4. **Dates en local.** Utiliser `weekKey()` / `isoLocal()`, jamais `toISOString()` : en France, lundi 00:00 = dimanche 22:00 UTC.
5. **Échapper tout texte saisi** par l'utilisateur avec `esc()` avant de l'injecter en HTML.
6. **Emojis** : éviter les emojis Unicode 13+ (🫒 🫘 …), mal affichés sur certains appareils. Pas de doublon d'emoji dans un même pool.
7. **Ordre des sections** : Réglages suit toujours l'ordre de la vue Semaine. Dans Variété micro, les paires restent côte à côte (grille 2 colonnes) : noix | autres oléagineux, huile colza | huile olive.
8. **Style** : réutiliser les variables CSS de `:root` (`--green`, `--amber`, `--line`, `--green-soft`…). Avant d'ajouter une règle CSS, vérifier qu'aucune règle existante ne cible le même sélecteur : un doublon oublié a déjà cassé une mise en page.
9. Rester en **fichier unique**, vanilla JS, sans dépendance ni étape de build.

## Validation avant chaque commit

Le rendu visuel a déjà été cassé par des bugs que la seule logique ne détectait pas. Lancer systématiquement :

1. **Syntaxe JS** : extraire le `<script>` de `index.html` et lancer `node --check`.
2. **Audit HTML/CSS** : sélecteurs CSS dupliqués, `getElementById("…")` sans élément correspondant, `id` HTML dupliqués, handlers `onclick`/`onchange` sans fonction définie, cibles de `switchView()` sans vue.
3. **Tests logiques** en `TZ=Europe/Paris` : exécuter la partie données du script (avant `// ---------- rendu ----------`) sous Node avec localStorage simulé, et vérifier les calculs concernés par le changement.
4. **Test de migration** : reconstruire un état sauvegardé réaliste de la version précédente (config + semaine avec des pastilles cochées), le passer dans `migrate()`, vérifier que rien n'est perdu.
5. `manifest.json` doit rester un JSON valide.

Il est recommandé de regrouper ces contrôles dans un script (`scripts/validate.py` ou `.mjs`) si ce n'est pas déjà fait. La validation finale reste un test sur le téléphone.

## Déploiement

- `git push` sur `main` → GitHub Pages redéploie (vérifier l'onglet Actions ; des échecs transitoires "Deployment failed, try again later" arrivent, relancer le job).
- Sur Android, l'app se met à jour au relancement (parfois deux ouvertures, le temps que le service worker bascule).
- **Icône et nom** sont figés dans le WebAPK généré par Chrome à l'installation : un changement d'icône ou de `name` nécessite souvent de désinstaller puis réinstaller l'app depuis Chrome. Les données ne sont pas perdues (localStorage).

## Façon de travailler avec le propriétaire

- Répondre en français, de façon concise : il lit souvent sur mobile.
- Pour toute évolution qui touche le modèle, les calculs ou l'interface de façon notable : **expliquer la proposition et les options avant de coder**, puis attendre sa validation. Il demande souvent explicitement "ne lance rien, propose".
- Les petites corrections claires (texte, emoji, ordre) peuvent être faites directement.
- Après un changement : résumer ce qui change pour lui, ce qui est préservé (ses données), et rappeler la version.
