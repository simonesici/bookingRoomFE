const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('bookingroom_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('bookingroom_token', token);
  } else {
    localStorage.removeItem('bookingroom_token');
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorMsg =
      (data && data.message) ||
      (typeof data === 'string' && data) ||
      `Errore HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.validationErrors = data && data.validationErrors;
    throw err;
  }

  return data;
}

export const api = {
  // Autenticazione (/api/auth)
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/api/auth/me'),

  // Stanze (/api/stanze)
  getStanze: (capienzaMinima) => {
    const query = capienzaMinima ? `?capienzaMinima=${encodeURIComponent(capienzaMinima)}` : '';
    return request(`/api/stanze${query}`);
  },
  getStanzeDisponibili: (dataI, dataF, capienzaMinima) => {
    const params = new URLSearchParams({ dataI, dataF });
    if (capienzaMinima) {
      params.append('capienzaMinima', capienzaMinima);
    }
    return request(`/api/stanze/disponibili?${params.toString()}`);
  },
  createStanza: (stanza) =>
    request('/api/stanze', {
      method: 'POST',
      body: JSON.stringify(stanza),
    }),
  updateStanza: (id, stanza) =>
    request(`/api/stanze/${id}`, {
      method: 'PUT',
      body: JSON.stringify(stanza),
    }),
  deleteStanza: (id) =>
    request(`/api/stanze/${id}`, {
      method: 'DELETE',
    }),

  // Prenotazioni (/api/prenotazioni)
  getPrenotazioni: () => request('/api/prenotazioni'),
  getTimelineAnnoMese: (anno, mese) =>
    request(`/api/prenotazioni/timeline/${anno}/${mese}`),
  getPrenotazioniByStanza: (stanzaId) =>
    request(`/api/prenotazioni/stanza/${stanzaId}`),
  getPrenotazioniByUtente: (utenteId) =>
    request(`/api/prenotazioni/utente/${utenteId}`),
  createPrenotazione: (prenotazione) =>
    request('/api/prenotazioni', {
      method: 'POST',
      body: JSON.stringify(prenotazione),
    }),
  deletePrenotazione: (id) =>
    request(`/api/prenotazioni/${id}`, {
      method: 'DELETE',
    }),

  // Utenti (/api/utenti)
  getUtenti: () => request('/api/utenti'),
  createUtente: (utente) =>
    request('/api/utenti', {
      method: 'POST',
      body: JSON.stringify(utente),
    }),
  deleteUtente: (id) =>
    request(`/api/utenti/${id}`, {
      method: 'DELETE',
    }),
};
