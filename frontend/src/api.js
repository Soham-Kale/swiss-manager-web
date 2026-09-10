// API client for the Chess Pairing Manager Flask backend.
// Works however you run the UI:
//   - served by Flask on :5000  -> same-origin /api
//   - Vite dev server on :5173  -> talk to Flask directly (CORS is enabled)
//   - opened as a file://        -> talk to Flask directly
function apiBase() {
  const { protocol, port, origin } = location;
  if (protocol === "file:") return "http://127.0.0.1:5000/api";
  if (port === "5000") return "/api";
  if (port === "5173") return "http://127.0.0.1:5000/api";
  return origin + "/api";
}
const API = apiBase();

async function j(url, opts) {
  let res;
  try {
    res = await fetch(url, opts);
  } catch (e) {
    // Network-level failure ("Failed to fetch") = backend not reachable.
    throw new Error(`Cannot reach the backend at ${API}. Start it first: in the backend folder run  flask --app app.server run --port 5000`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(data.text || `HTTP ${res.status}`);
  }
  return data.data;
}

export const api = {
  createTournament: (body) =>
    j(`${API}/tournaments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  listTournaments: () => j(`${API}/tournaments`),
  getTournament: (id) => j(`${API}/tournaments/${id}`),
  updateTournament: (id, body) =>
    j(`${API}/tournaments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  setPlayers: (id, players, reseed = true) =>
    j(`${API}/tournaments/${id}/players`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ players, reseed }) }),
  importPlayers: (id, file) => {
    const fd = new FormData(); fd.append("file", file);
    return j(`${API}/tournaments/${id}/players/import`, { method: "POST", body: fd });
  },
  nextRound: (id, engine = "dutch") =>
    j(`${API}/tournaments/${id}/rounds/next?engine=${engine}`, { method: "POST" }),
  getRound: (id, n) => j(`${API}/tournaments/${id}/rounds/${n}`),
  setResults: (id, n, results) =>
    j(`${API}/tournaments/${id}/rounds/${n}/results`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ results }) }),
  finalizeRound: (id, n) =>
    j(`${API}/tournaments/${id}/rounds/${n}/finalize`, { method: "POST" }),
  standings: (id) => j(`${API}/tournaments/${id}/standings`),
  exportTrf: (id) => j(`${API}/tournaments/${id}/export/trf`),
};
