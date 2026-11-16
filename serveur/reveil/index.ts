/* Ében-Ézer — la fonction qui sonne (13.ey)
 *
 * Elle ne sait rien, et c'est tout le propos. Elle lit les lignes dont
 * l'heure est passée, et envoie à chacune un message SANS CONTENU — ce que
 * la norme du Web Push appelle un push vide : pas de corps, donc pas de
 * chiffrement, donc rien à lire pour personne, nulle part. Le téléphone se
 * réveille, son service worker lit le miroir posé sur l'appareil, et c'est
 * LUI qui écrit la phrase. Le nom de l'activité n'a jamais quitté le
 * téléphone (13.bh).
 *
 * Sans dépendance, comme l'application : WebCrypto suffit à signer le jeton
 * VAPID, et fetch à le poster.
 *
 * Secrets attendus :
 *   VAPID_JWK    la clé privée au format JWK (kty, crv, x, y, d)
 *   VAPID_SUJET  une adresse de contact — par défaut celle du dépôt
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par la plateforme.
 */
const JWK = JSON.parse(Deno.env.get("VAPID_JWK") ?? "null");
const SUJET = Deno.env.get("VAPID_SUJET") ?? "https://landrya0.github.io/eben-ezer/";
const BASE = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const enc = new TextEncoder();
function b64u(b: Uint8Array): string {
  let s = "";
  for (const o of b) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deb64u(t: string): Uint8Array {
  const s = String(t).replace(/-/g, "+").replace(/_/g, "/");
  const r = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(r, (c) => c.charCodeAt(0));
}

/* La clé publique se déduit de la privée : point non compressé, 0x04 puis
   les deux coordonnées. Un secret de moins à tenir à jour. */
function publique(): string {
  const x = deb64u(JWK.x), y = deb64u(JWK.y);
  const out = new Uint8Array(65);
  out[0] = 4; out.set(x, 1); out.set(y, 33);
  return b64u(out);
}

let cle: CryptoKey | null = null;
async function laCle(): Promise<CryptoKey> {
  if (!cle) {
    cle = await crypto.subtle.importKey(
      "jwk",
      { kty: JWK.kty, crv: JWK.crv, x: JWK.x, y: JWK.y, d: JWK.d, key_ops: ["sign"], ext: true },
      { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  return cle;
}
/* Le jeton VAPID prouve au service de push que l'envoi vient de cette
   application. Il est daté, et il nomme le service auquel il est destiné :
   celui d'un autre ne l'accepterait pas. */
async function jeton(aud: string): Promise<string> {
  const h = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64u(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: SUJET
  })));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, await laCle(), enc.encode(h + "." + p));
  return h + "." + p + "." + b64u(new Uint8Array(sig));
}

async function table(chemin: string, opt: RequestInit = {}): Promise<Response> {
  return fetch(BASE + "/rest/v1/reveils" + chemin, {
    ...opt,
    headers: {
      apikey: SERVICE, Authorization: "Bearer " + SERVICE,
      "Content-Type": "application/json", ...(opt.headers ?? {})
    }
  });
}

/* Appelée par l'horloge de la base, avec la clé de service. La passerelle a
   déjà vérifié la signature du jeton ; il reste à refuser celui d'un simple
   compte — n'importe quel disciple connecté en a un, et personne d'autre que
   l'horloge n'a à déclencher les réveils de tout le monde. */
function cEstLHorloge(req: Request): boolean {
  const t = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const p = t.split(".")[1];
  if (!p) return false;
  try { return JSON.parse(new TextDecoder().decode(deb64u(p))).role === "service_role"; }
  catch { return false; }
}

Deno.serve(async (req: Request) => {
  if (!JWK || !BASE || !SERVICE) return new Response("pas réglé", { status: 500 });
  if (!cEstLHorloge(req)) return new Response("non", { status: 403 });

  const r = await table("?select=abo&quand=lte." + encodeURIComponent(new Date().toISOString()));
  if (!r.ok) return new Response(await r.text(), { status: 502 });
  const lignes: { abo: string }[] = await r.json();

  const k = publique();
  let sonnes = 0, morts = 0;
  for (const l of lignes) {
    let aud: string;
    try { aud = new URL(l.abo).origin; } catch { aud = ""; }
    if (!aud) { morts++; await table("?abo=eq." + encodeURIComponent(l.abo), { method: "DELETE" }); continue; }
    let code = 0;
    try {
      const p = await fetch(l.abo, {
        method: "POST",
        headers: {
          Authorization: "vapid t=" + await jeton(aud) + ", k=" + k,
          TTL: "86400", "Content-Length": "0"
        }
      });
      code = p.status;
    } catch { code = 0; }
    if (code === 404 || code === 410) {
      /* L'abonnement est mort — application désinstallée, navigateur vidé.
         La ligne ne sert plus à rien et ne reviendra pas : on l'enlève. */
      morts++;
      await table("?abo=eq." + encodeURIComponent(l.abo), { method: "DELETE" });
    } else if (code >= 200 && code < 300) {
      /* Sonné une fois, et une seule : l'heure s'efface. Si le compteur
         tourne toujours, c'est l'application qui en reposera une — et elle
         ne le fait que pour ce qui dépassera plus tard, donc elle ne
         harcèle pas celui qui a déjà vu (13.ey). */
      sonnes++;
      await table("?abo=eq." + encodeURIComponent(l.abo),
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ quand: null }) });
    }
    /* Tout autre code — le service de push en panne, une limite atteinte —
       laisse la ligne telle quelle : le tour suivant réessaiera. */
  }
  return new Response(JSON.stringify({ vus: lignes.length, sonnes, morts }),
    { headers: { "Content-Type": "application/json" } });
});
