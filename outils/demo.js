/* Outil de démonstration — HORS APPLICATION.
   Ce fichier n'est chargé ni par index.html ni par sw.js : il est injecté à la
   main dans le volet navigateur, au moment de montrer une livraison.

   Raison d'être (AGENTS.md §4, « Et montrée ») : dérouler une nouveauté en
   pilotant l'app par du code produit un écran qui change tout seul, sans qu'on
   sache ni où l'on a touché ni pourquoi. Ce n'est pas une démonstration, c'est
   un film sans son. Il manque deux choses, et deux seulement :
     — un pointeur qu'on voit se déplacer et taper,
     — un texte qui dit, à chaque étape, ce qu'on regarde.

   Le pointeur ne simule rien : il se déplace jusqu'à l'élément, puis le VRAI
   `click()` part sur le VRAI élément, donc le délégué et les sondes de
   l'application travaillent comme sous un vrai doigt. */

(function(){
  "use strict";

  const Q = ms => new Promise(r => setTimeout(r, ms));
  const el = (t, c) => { const x = document.createElement(t); if(c) x.className = c; return x; };

  const CSS = `
  #dmCurseur{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;
    z-index:100000;pointer-events:none;opacity:0;
    transition:transform .62s cubic-bezier(.33,.1,.25,1),opacity .25s}
  #dmCurseur i{position:absolute;inset:0;border-radius:50%;
    border:2px solid rgba(255,255,255,.92);background:rgba(255,255,255,.14);
    box-shadow:0 0 0 1px rgba(0,0,0,.45),0 6px 20px rgba(0,0,0,.55);
    transition:transform .14s ease}
  #dmCurseur.tape i{transform:scale(.62);background:rgba(255,255,255,.4)}
  #dmCurseur b{position:absolute;inset:0;border-radius:50%;border:2px solid #fff;opacity:0}
  #dmCurseur.tape b{animation:dmOnde .5s ease-out}
  @keyframes dmOnde{from{opacity:.8;transform:scale(.6)}to{opacity:0;transform:scale(2.6)}}

  .dmCadre{position:fixed;z-index:99998;pointer-events:none;border-radius:14px;
    border:2px solid #e8c37a;box-shadow:0 0 0 4px rgba(232,195,122,.18);
    opacity:0;transition:opacity .3s,all .45s cubic-bezier(.33,.1,.25,1)}
  .dmCadre.vu{opacity:1}

  #dmTexte{position:fixed;left:0;right:0;bottom:0;z-index:99999;
    background:#14161a;border-top:1px solid #2b2f36;
    padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
    font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    color:#e9eaec;transform:translateY(110%);transition:transform .32s ease;
    box-shadow:0 -10px 30px rgba(0,0,0,.5)}
  #dmTexte.vu{transform:translateY(0)}
  #dmTexte .n{display:flex;align-items:center;gap:8px;
    font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#8d929b;margin-bottom:5px}
  #dmTexte .n span.j{color:#e8c37a}
  #dmTexte .t{font-weight:600;margin-bottom:3px;color:#fff}
  #dmTexte .p{color:#b9bdc4}
  #dmTexte.cle{border-top-color:#e8c37a}
  #dmTexte.cle .t{color:#e8c37a}

  #dmPorte{position:fixed;inset:0;z-index:100001;display:flex;align-items:center;
    justify-content:center;padding:24px;background:rgba(6,7,9,.86);
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e9eaec}
  #dmPorte .carte{max-width:320px;width:100%;background:#14161a;border:1px solid #2b2f36;
    border-radius:18px;padding:22px 20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}
  #dmPorte .k{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:#e8c37a;margin-bottom:8px}
  #dmPorte h4{margin:0 0 8px;font-size:19px;color:#fff;font-weight:600}
  #dmPorte p{margin:0 0 18px;color:#b9bdc4;font-size:14px}
  #dmPorte button{width:100%;border:0;border-radius:999px;padding:13px 16px;font-size:15px;
    font-weight:600;background:#e8c37a;color:#1a1408;cursor:pointer;-webkit-appearance:none}
  #dmPorte button.sec{background:transparent;color:#b9bdc4;border:1px solid #2b2f36;
    margin-top:8px;font-weight:500}
  `;

  let curseur, texte, cadre, x = 0, y = 0, pas = 0, total = 0;

  function ouvre(nb){
    ferme();
    total = nb || 0; pas = 0;
    const s = el("style"); s.id = "dmStyle"; s.textContent = CSS;
    document.head.appendChild(s);

    curseur = el("div"); curseur.id = "dmCurseur";
    curseur.innerHTML = "<i></i><b></b>";
    document.body.appendChild(curseur);

    texte = el("div"); texte.id = "dmTexte";
    document.body.appendChild(texte);

    cadre = el("div", "dmCadre");
    document.body.appendChild(cadre);

    x = innerWidth / 2; y = innerHeight - 120;
    curseur.style.transform = `translate(${x}px,${y}px)`;
  }

  function ferme(){
    ["dmStyle", "dmCurseur", "dmTexte"].forEach(function(id){
      const n = document.getElementById(id); if(n) n.remove();
    });
    document.querySelectorAll(".dmCadre").forEach(function(n){ n.remove(); });
    curseur = texte = cadre = null;
  }

  /* La narration. `cle` marque les étapes qui SONT la nouveauté — elles se
     distinguent, sinon on regarde la mise en scène au lieu de la règle. */
  /* Le curseur s'asseyait sur la narration et en cachait une ligne : il se
     gare au bord dès qu'il n'a plus rien à faire. Un outil qui masque ce
     qu'il est venu montrer ne montre rien. */
  function gare(){
    if(!curseur) return;
    const h = texte && texte.classList.contains("vu") ? texte.offsetHeight : 0;
    x = innerWidth - 26;
    y = innerHeight - h - 46;
    curseur.style.transform = `translate(${x}px,${y}px)`;
  }

  async function dit(titre, phrase, cle){
    if(!texte) return;
    gare();
    pas++;
    texte.className = cle ? "cle" : "";
    texte.innerHTML =
      `<div class="n"><span class="${cle ? "j" : ""}">`
      + (cle ? "★ " : "") + "Étape " + pas + (total ? " / " + total : "")
      + `</span></div><div class="t">${titre}</div><div class="p">${phrase}</div>`;
    texte.classList.add("vu");
    await Q(260);
  }

  function noeud(c){ return typeof c === "string" ? document.querySelector(c) : c; }

  /* Le bandeau de narration mange le bas de l'écran. Quand la cible est
     dessous, on l'escamote le temps du geste plutôt que de taper à l'aveugle
     sur quelque chose que le disciple ne voit pas. */
  function gene(r){
    if(!texte || !texte.classList.contains("vu")) return false;
    return r.bottom > innerHeight - texte.offsetHeight - 8;
  }

  async function vers(cible, ms){
    const n = noeud(cible); if(!n) throw new Error("démo : cible introuvable");
    n.scrollIntoView({block: "center", behavior: "smooth"});
    await Q(420);
    let r = n.getBoundingClientRect();
    const cacher = gene(r);
    if(cacher){ texte.classList.remove("vu"); await Q(340); r = n.getBoundingClientRect(); }
    x = r.left + Math.min(r.width / 2, 120);
    y = r.top + r.height / 2;
    curseur.style.opacity = "1";
    curseur.style.transform = `translate(${x}px,${y}px)`;
    await Q(ms === undefined ? 700 : ms);
    return {n: n, cacher: cacher};
  }

  async function tape(cible){
    const {n, cacher} = await vers(cible);
    curseur.classList.add("tape");
    await Q(170);
    curseur.classList.remove("tape");
    n.click();                                   /* le vrai geste, vrai délégué */
    await Q(520);
    if(cacher) texte.classList.add("vu");
    return n;
  }

  /* Montrer sans toucher : « regarde ici ». Indispensable quand la nouveauté
     est ce que l'app a fait TOUTE SEULE — il n'y a, justement, aucun geste. */
  async function montre(cible, ms){
    const n = noeud(cible); if(!n) return;
    n.scrollIntoView({block: "center", behavior: "smooth"});
    await Q(420);
    const r = n.getBoundingClientRect();
    cadre.style.left = (r.left - 6) + "px";
    cadre.style.top = (r.top - 6) + "px";
    cadre.style.width = (r.width + 12) + "px";
    cadre.style.height = (r.height + 12) + "px";
    cadre.classList.add("vu");
    gare();
    await Q(ms === undefined ? 2600 : ms);
  }

  function cache(){ if(cadre) cadre.classList.remove("vu"); }

  async function ecrit(cible, mot, vitesse){
    const {n} = await vers(cible, 420);
    n.focus && n.focus();
    for(let i = 1; i <= mot.length; i++){
      n.value = mot.slice(0, i);
      n.dispatchEvent(new Event("input", {bubbles: true}));
      await Q(vitesse || 34);
    }
    await Q(420);
    return n;
  }

  /* Retrouver une ligne par son texte : les écrans sont redessinés à chaque
     geste, donc aucune référence ne survit d'une étape à l'autre. */
  function ligne(mot, balise){
    /* Par défaut, tout ce qui porte du texte à l'écran : une ligne de liste
       est le cas le plus courant, et c'est elle qu'on veut encadrer. */
    const sel = balise || "li,a,button,div.block,.actions-button,[data-man],[data-tcat]";
    return [].slice.call(document.querySelectorAll(sel))
      .filter(function(n){ return n.textContent.indexOf(mot) !== -1; })
      .sort(function(a, b){ return a.textContent.length - b.textContent.length; })[0];
  }

  function bloc(mot){
    return [].slice.call(document.querySelectorAll(".block-title,.item-title,.list"))
      .filter(function(n){ return n.textContent.indexOf(mot) !== -1; })
      .sort(function(a, b){ return a.textContent.length - b.textContent.length; })[0];
  }

  /* La barrière de départ. « quand tu commence la demo il faut demander une
     action de ma part, car si je ne suis pas devant l'écran ça tourne dans le
     vide. » Trois fois la même cause : une démo qui se lance toute seule se
     joue pour personne. Elle s'installe donc et elle attend — c'est lui qui
     l'ouvre, quand il est là. Le scénario, les données de mise en place
     comprises, ne tourne qu'au clic : rien n'est écrit dans l'archive tant
     qu'il n'a pas commencé. */
  function porte(o){
    const vieux = document.getElementById("dmPorte"); if(vieux) vieux.remove();
    if(!document.getElementById("dmStyle")){
      const s = el("style"); s.id = "dmStyle"; s.textContent = CSS; document.head.appendChild(s);
    }
    const d = el("div"); d.id = "dmPorte";
    d.innerHTML = `<div class="carte">
        <div class="k">${o.k || "Démonstration"}</div>
        <h4>${o.titre}</h4>
        <p>${o.phrase || ""}</p>
        <button id="dmGo">${o.bouton || "Commencer"}</button>
        ${o.second ? `<button class="sec" id="dmSec">${o.second}</button>` : ""}
      </div>`;
    document.body.appendChild(d);
    d.querySelector("#dmGo").addEventListener("click", async function(){
      d.remove();
      ouvre(o.n || 0);
      try { await o.jouer(); }
      catch(e){ await dit("La démo s'est arrêtée", String(e && e.message || e)); return; }
      porte({k:"Terminé", titre:o.fin || "C'est tout.",
             phrase:"Tu peux la revoir, ou effacer ce que la démo a écrit.",
             bouton:"Rejouer", second:"Effacer la démo",
             n:o.n, jouer:o.jouer, fin:o.fin, nettoie:o.nettoie});
    });
    const sec = d.querySelector("#dmSec");
    if(sec) sec.addEventListener("click", function(){
      d.remove(); ferme();
      if(typeof o.nettoie === "function") o.nettoie();
    });
  }

  window.DEMO = {ouvre, ferme, porte, dit, tape, vers, montre, cache, gare, ecrit, ligne, bloc, pause: Q};
})();
