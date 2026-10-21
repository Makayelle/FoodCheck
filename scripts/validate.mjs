#!/usr/bin/env node
/* Validation FoodCheck — à lancer avant chaque commit.
     node scripts/validate.mjs            contrôles statiques + logique + migration
     node scripts/validate.mjs --render   + rendu Chromium (Playwright) des 4 vues
   Sortie volontairement compacte : une ligne par échec, une ligne de bilan.
   Code de sortie 1 si un contrôle échoue. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.env.TZ = "Europe/Paris"; // dates locales françaises (piège lundi 00:00 = dimanche 22:00 UTC)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const fails = [];
let passed = 0;
const check = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { fails.push(`✗ ${name} : ${e.message.split("\n")[0]}`); }
};

const html = read("index.html");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const js = scriptMatch[1];
const markup = html.slice(0, scriptMatch.index);
const [dataJs] = js.split("// ---------- rendu ----------");

// ---------- 1. syntaxe JS ----------
check("syntaxe JS", () => { new vm.Script(js, { filename: "index.html<script>" }); });

// ---------- 2. audit HTML/CSS ----------
const dups = arr => [...new Set(arr.filter((x, i) => arr.indexOf(x) !== i))];
check("sélecteurs CSS dupliqués", () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const mediaRe = /@media[^{]+\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g;
  const blocks = [css.replace(mediaRe, ""), ...[...css.matchAll(mediaRe)].map(m => m[1])];
  for (const b of blocks) {
    const sels = [...b.matchAll(/([^{}]+)\{[^{}]*\}/g)].map(m => m[1].trim().replace(/\s+/g, " "));
    const d = dups(sels);
    assert.equal(d.length, 0, d.join(" | "));
  }
});
const htmlIds = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const allIds = new Set([...htmlIds, ...[...js.matchAll(/id="([^"$]+)"/g)].map(m => m[1])]);
check("id HTML dupliqués", () => { const d = dups(htmlIds); assert.equal(d.length, 0, d.join(", ")); });
check("getElementById sans élément", () => {
  const miss = [...new Set([...js.matchAll(/getElementById\("([^"]+)"\)/g)].map(m => m[1]))].filter(id => !allIds.has(id));
  assert.equal(miss.length, 0, miss.join(", "));
});
check("handlers sans fonction", () => {
  const defined = new Set([...js.matchAll(/function\s+(\w+)/g), ...js.matchAll(/(?:const|let)\s+(\w+)\s*=/g)].map(m => m[1]));
  const miss = [...new Set([...html.matchAll(/on(?:click|change|input)="\s*(\w+)\s*\(/g)].map(m => m[1]))].filter(f => !defined.has(f));
  assert.equal(miss.length, 0, miss.join(", "));
});
check("switchView sans vue", () => {
  const miss = [...new Set([...html.matchAll(/switchView\(\s*['"]([^'"]+)/g)].map(m => m[1]))].filter(v => !allIds.has("view-" + v));
  assert.equal(miss.length, 0, miss.join(", "));
});
check("tailles de police : échelle --fs-* uniquement", () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const raw = [...css.matchAll(/font-size:\s*([^;}]+)/g)].map(m => m[1].trim()).filter(v => !/^var\(--fs-[\w]+\)$/.test(v) && v !== "16px");
  assert.equal(raw.length, 0, raw.join(", "));
});
check("manifest.json valide", () => { JSON.parse(read("manifest.json")); });
const cacheVer = (read("sw.js").match(/const CACHE = "nutri-suivi-v(\d+)"/) || [])[1];
check("CACHE sw.js lisible", () => assert.ok(cacheVer, "constante CACHE introuvable"));
check("CHANGELOG à jour pour la version CACHE", () => {
  assert.ok(new RegExp(`^## v${cacheVer}\\b`, "m").test(read("CHANGELOG.md")), `pas d'entrée « ## v${cacheVer} » dans CHANGELOG.md`);
});
check("CACHE bumpé si l'app a changé", () => {
  // compare à origin/main (ignoré si git ou la branche distante est indisponible)
  let diff, mainSw;
  try {
    diff = execSync("git diff --name-only origin/main -- index.html manifest.json icon-192.png icon-512.png", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    mainSw = execSync("git show origin/main:sw.js", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch { return; }
  const mainVer = (mainSw.match(/nutri-suivi-v(\d+)/) || [])[1];
  if (diff) assert.ok(+cacheVer > +mainVer, `${diff.replace(/\n/g, ", ")} modifié mais CACHE toujours v${cacheVer}`);
});

// ---------- 3. logique (partie données du script, localStorage simulé) ----------
const store = {};
const ctx = vm.createContext({ structuredClone, console, localStorage: {
  getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } } });
let T = null;
check("chargement partie données", () => {
  vm.runInContext(dataJs + ";globalThis.T={STORE_KEY,DEFAULT_CONFIG,SHORT_NAMES,GROUPS,QUESTS,freshWeek,computeStats,questProgress,migrate,load,weekKey,applyRecommendedCounts,weekScore,pearson}", ctx);
  T = ctx.T;
});
if (T) {
  const { STORE_KEY, DEFAULT_CONFIG, SHORT_NAMES, GROUPS, QUESTS, freshWeek, computeStats, questProgress, migrate, load, weekKey, applyRecommendedCounts, weekScore, pearson } = T;
  const fresh = () => { const c = structuredClone(DEFAULT_CONFIG); return [c, freshWeek(c)]; };
  const q = id => QUESTS.find(x => x.id === id);

  check("clé localStorage inchangée", () => assert.equal(STORE_KEY, "nutri-suivi-v1"));
  check("dates locales (lundi)", () => {
    assert.equal(weekKey(new Date(2026, 9, 12, 0, 30)), "2026-10-12");
    assert.equal(weekKey(new Date(2026, 9, 18, 23, 59)), "2026-10-12");
    assert.equal(weekKey(new Date(2026, 9, 19, 0, 1)), "2026-10-19");
  });
  check("DEFAULT_CONFIG : ids uniques, SHORT_NAMES, pas de doublon d'emoji", () => {
    const ids = Object.keys(GROUPS).flatMap(g => DEFAULT_CONFIG[g].map(it => it.id));
    assert.deepEqual(dups(ids), []);
    for (const g of Object.keys(GROUPS)) {
      assert.deepEqual(dups(DEFAULT_CONFIG[g].map(it => it.emoji)), [], `emoji en double dans ${g}`);
      for (const it of DEFAULT_CONFIG[g]) assert.ok(SHORT_NAMES[it.id] || it.name.length <= 20, `SHORT_NAMES.${it.id} manquant (nom long)`);
    }
  });
  check("emojis Unicode 13+ absents", () => {
    // la migration cite volontairement 🫒/🫘 pour les remplacer : on contrôle le HTML et DEFAULT_CONFIG
    const cfg = Object.keys(GROUPS).flatMap(g => DEFAULT_CONFIG[g].map(it => it.emoji)).join("");
    const bad = [...new Set((markup + cfg).match(/[\u{1FA70}-\u{1FAFF}]/gu) || [])];
    assert.equal(bad.length, 0, bad.join(" "));
  });
  check("quêtes : 13, poids total 1, sources existantes", () => {
    assert.equal(QUESTS.length, 13);
    for (const x of QUESTS) {
      assert.ok(Math.abs(x.srcs.reduce((a, s) => a + s.w, 0) - 1) < 1e-9, `poids ${x.id}`);
      for (const s of x.srcs) if (s.g !== "daily" && s.id !== "__animal")
        assert.ok(DEFAULT_CONFIG[s.g].some(it => it.id === s.id), `${x.id} → ${s.g}.${s.id}`);
    }
  });
  check("semaine vide", () => {
    const [c, w] = fresh(), s = computeStats(w, c);
    assert.equal(s.daily.tot, 56); assert.equal(s.proteins.done, 0); assert.equal(s.quests.done, 0);
    assert.equal(s.checkin.energy, null);
  });
  check("protéines : légumineuses ½, cible découplée, plafond", () => {
    let [c, w] = fresh();
    w.pools.proteins.poulet = [true, true, true, true]; w.pools.carbs.legum = [true, true, false];
    let s = computeStats(w, c);
    assert.equal(s.proteins.done, 5); assert.equal(JSON.stringify(s.proteinSplit), '{"animal":4,"vegetal":1}');
    c.proteins.push({ id: "cx", name: "Autre", emoji: "🦐", count: 3 });
    w.pools.proteins.cx = [false, false, false];
    assert.equal(computeStats(w, c).proteins.tot, 14, "ajouter un aliment ne doit pas diluer");
    for (const k in w.pools.proteins) w.pools.proteins[k] = w.pools.proteins[k].map(() => true);
    assert.equal(computeStats(w, c).proteins.done, 14);
  });
  check("féculents : variété plafonnée à la cible", () => {
    const [c, w] = fresh();
    for (const k in w.pools.carbs) w.pools.carbs[k][0] = true;
    assert.deepEqual({ ...computeStats(w, c).carbsVariety }, { done: 6, tot: 6 });
  });
  check("oméga-3 : amande/olive ne comptent pas", () => {
    const [, w] = fresh();
    w.pools.micro.autresoleagineux.fill(true); w.pools.micro.huileolive.fill(true);
    assert.equal(questProgress(w, q("o3")), 0);
  });
  check("B12 : protéine végétale n'y contribue pas", () => {
    const [, w] = fresh(); w.pools.proteins.vegetal.fill(true);
    assert.equal(questProgress(w, q("b12")), 0);
  });
  check("jokers : détail consommé", () => {
    const [c, w] = fresh();
    w.pools.jokers.alcool[0] = true; w.pools.jokers.sucre = [true, true, false];
    assert.equal(JSON.stringify(computeStats(w, c).jokersSpent), JSON.stringify([{ emoji: "🍷", n: 1 }, { emoji: "🍰", n: 2 }]));
  });
  check("check-in : 0 ignoré", () => {
    const [c, w] = fresh(); w.checkin[0].energy = 4; w.checkin[1].energy = 2;
    assert.equal(computeStats(w, c).checkin.energy, 3);
  });
  check("quantités recommandées : jokers et ajouts manuels intacts", () => {
    const c = structuredClone(DEFAULT_CONFIG);
    c.proteins[0].count = 9; c.jokers[0].count = 1; c.carbs.push({ id: "cx", name: "Quinoa", emoji: "🍙", count: 5 });
    applyRecommendedCounts(c);
    assert.equal(c.proteins[0].count, 4); assert.equal(c.jokers[0].count, 1); assert.equal(c.carbs.at(-1).count, 5);
  });

  check("score de semaine : Renforcement poids ½, jokers exclus", () => {
    const [c, w] = fresh();
    for (const k in w.daily) for (const cat in w.daily[k]) w.daily[k][cat].fill(true);
    for (const g of ["proteins", "carbs", "micro"]) for (const id in w.pools[g]) w.pools[g][id].fill(true);
    w.pools.jokers.alcool.fill(true);
    const st = computeStats(w, c);
    // tout à 100 % sauf Quêtes (pas de muscu → Muscu non validée) et Renforcement à 0
    const expected = (100 * st.quests.done / st.quests.tot * 1 + 100 * 4 + 0 * .5) / 5.5;
    assert.ok(Math.abs(weekScore(st) - Math.round(expected * 100) / 100) < 1, `${weekScore(st)} ≠ ${expected}`);
    w.pools.jokers.alcool.fill(false);
    assert.equal(weekScore(computeStats(w, c)), weekScore(st), "les jokers ne doivent pas changer le score");
  });
  check("corrélation score ↔ ressenti", () => {
    assert.equal(pearson([1, 2, 3], [1, 2, 3]), null, "< 4 points → null");
    assert.ok(Math.abs(pearson([10, 20, 30, 40], [2, 3, 4, 5]) - 1) < 1e-9);
    assert.ok(Math.abs(pearson([10, 20, 30, 40], [5, 4, 3, 2]) + 1) < 1e-9);
    assert.equal(pearson([10, 10, 10, 10], [1, 2, 3, 4]), null, "variance nulle → null");
  });

  // ---------- 4. migration ----------
  check("migration : état récent conservé + idempotente", () => {
    const [c, w] = fresh();
    delete c.autoResetCounts;
    c.carbs.push({ id: "cabc", name: "Quinoa", emoji: "🍙", count: 2 });
    w.pools.carbs.cabc = [true, false];
    w.daily[0].veg = [true, true, false]; w.daily[2].move = [true];
    w.pools.proteins.poulet = [true, false, true, false]; w.pools.micro.noix = [true, true, false, false];
    w.pools.jokers.alcool = [false, true, false, false]; w.checkin[1] = { energy: 3, mood: 4 };
    const before = JSON.stringify(w);
    const s = migrate({ config: c, week: structuredClone(w), history: [{ key: "2026-10-05", stats: {} }] });
    assert.equal(JSON.stringify(s.week), before, "pastilles modifiées");
    assert.equal(s.history.length, 1);
    assert.equal(JSON.stringify(migrate(structuredClone(s))), JSON.stringify(s), "non idempotente");
    for (const g of Object.keys(GROUPS)) for (const it of DEFAULT_CONFIG[g])
      assert.ok(s.config[g].some(x => x.id === it.id), `${g}.${it.id} absent après migration`);
  });
  check("migration : ancien format compteurs (v2)", () => {
    const s = migrate({ config: {
        proteins: [{ id: "poulet", name: "Poulet", emoji: "🍗", count: 4 }, { id: "poisson", name: "Poisson", emoji: "🐟", count: 3 }],
        carbs: [{ id: "riz", name: "Riz", emoji: "🍚", count: 4 }] },
      week: { key: weekKey(new Date()), daily: { 0: { veg: 2 } }, pools: { proteins: { poulet: 3, poisson: 2 }, carbs: { riz: 1 } } },
      history: [] });
    assert.deepEqual([...s.week.pools.proteins.poulet], [true, true, true, false]);
    assert.equal(s.week.pools.proteins.poissongras[0], true);
    assert.deepEqual([...s.week.daily[0].veg], [true, true, false]);
    assert.deepEqual([...s.week.pools.carbs.riz], [true, false, false, false]);
  });
  check("load : archivage au changement de semaine", () => {
    const [c, w] = fresh();
    w.key = "2026-10-05"; w.pools.proteins.poulet[0] = true;
    store[STORE_KEY] = JSON.stringify({ config: c, week: w, history: [] });
    const s = load();
    assert.equal(s.history[0].key, "2026-10-05"); assert.equal(s.history[0].stats.proteins.done, 1);
    assert.equal(s.week.key, weekKey(new Date())); assert.equal(nDoneAll(s.week), 0);
  });
}
function nDoneAll(week) {
  let n = 0;
  for (const g in week.pools) for (const k in week.pools[g]) n += week.pools[g][k].filter(Boolean).length;
  return n;
}

// ---------- 5. rendu (optionnel) ----------
if (process.argv.includes("--render")) {
  let chromium = null;
  for (const p of ["playwright", "/opt/node-tools/node_modules/playwright/index.mjs"]) {
    try { ({ chromium } = await import(p)); break; } catch {}
  }
  if (!chromium) fails.push("✗ rendu : Playwright introuvable");
  else {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
    const errs = [];
    p.on("pageerror", e => errs.push(e.message));
    await p.route(/fonts\.g/, r => r.fulfill({ body: "" })); // pas de réseau requis
    await p.goto("file://" + path.join(ROOT, "index.html"));
    for (const v of ["week", "history", "settings", "info"]) {
      await p.evaluate(v => switchView(v), v);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) fails.push(`✗ rendu ${v} : débordement horizontal de ${over}px`); else passed++;
    }
    await p.evaluate(() => switchView("week"));
    for (const el of (await p.$$("#view-week [onclick]")).slice(0, 40)) await el.click({ timeout: 300 }).catch(() => {});
    const small = await p.evaluate(() => [...document.querySelectorAll("#view-week button, header button, nav button")]
      .map(e => e.getBoundingClientRect()).filter(r => r.width && (r.width < 24 || r.height < 24)).length);
    if (small) fails.push(`✗ rendu : ${small} zone(s) tactile(s) < 24 px (WCAG 2.2)`); else passed++;
    const saved = await p.evaluate(k => localStorage.getItem(k), "nutri-suivi-v1");
    if (!saved) fails.push("✗ rendu : aucun état sauvegardé après clics"); else passed++;
    if (errs.length) fails.push("✗ rendu : erreurs JS — " + errs.join(" | ")); else passed++;
    await b.close();
  }
}

for (const f of fails) console.log(f);
console.log(fails.length ? `ÉCHEC : ${fails.length} échec(s), ${passed} OK` : `OK : ${passed} contrôles (CACHE v${cacheVer})`);
process.exit(fails.length ? 1 : 0);
