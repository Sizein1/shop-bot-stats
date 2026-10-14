// Outils communs aux pages du site : échappement HTML et accès admin.
// L'accès admin repose sur une clé GitHub que seul le propriétaire possède : sans elle, impossible d'écrire dans le dépôt.
// La clé (et le webhook Discord) restent dans CE navigateur (localStorage), jamais dans le site publié.
const REPO = "Sizein1/shop-bot-stats";
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};
const b64enc = s => btoa(Array.from(new TextEncoder().encode(s), c => String.fromCharCode(c)).join(""));
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));

async function gh(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { cache: "no-store", ...opts,
    headers: { Authorization: "Bearer " + store.get("gh_token"), Accept: "application/vnd.github+json" } });
  if (!r.ok) throw Object.assign(new Error(r.status === 401 ? "clé GitHub refusée ou expirée"
    : r.status === 403 || r.status === 404 ? "cette clé n'a pas le droit de modifier shop-bot-stats" : `GitHub a répondu ${r.status}`), { status: r.status });
  return r.json();
}

// Relit un fichier de données « window.NOM = {...}; » sur GitHub, applique le changement et le réenregistre.
async function editDataFile(file, name, change, message) {
  for (let attempt = 0; ; attempt++) {
    const f = await gh("/contents/" + file);
    const text = b64dec(f.content);
    const data = JSON.parse(text.slice(text.indexOf("=") + 1, text.lastIndexOf(";")));
    change(data);
    try {
      await gh("/contents/" + file, { method: "PUT", body: JSON.stringify({ message,
        content: b64enc(`window.${name} = ${JSON.stringify(data)};\n`), sha: f.sha }) });
      window[name] = data;
      return data;
    } catch (e) { if (![409, 422].includes(e.status) || attempt) throw e; }  // modifié au même moment ailleurs : on relit et on recommence
  }
}

const TOKEN_HELP = `<details><summary>Comment créer ma clé GitHub ?</summary><ol>
  <li>Sur github.com : ta photo de profil → <b>Settings</b> → <b>Developer settings</b> → <b>Personal access tokens</b> → <b>Fine-grained tokens</b> → <b>Generate new token</b>.</li>
  <li>Nom : « Stats Shop admin », expiration au choix.</li>
  <li><b>Repository access</b> : <i>Only select repositories</i> → <b>shop-bot-stats</b>.</li>
  <li><b>Permissions</b> → <b>Contents</b> : <i>Read and write</i>. Rien d'autre.</li>
  <li><b>Generate token</b>, copie la clé et colle-la ici.</li></ol></details>`;
