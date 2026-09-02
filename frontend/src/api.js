// API client for the Swiss-Manager Flask backend.
const BASE = (location.port === "5173") ? "" : "";  // dev uses Vite proxy; prod same-origin
const API = BASE + "/api";

async function j(url, opts) {
  const res = await fetch(url, opts);
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
