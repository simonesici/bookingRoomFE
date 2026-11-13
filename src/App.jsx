import React, { useState, useEffect, useCallback } from 'react';
import { api, setToken } from './services/api';

function getTodayStr() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export default function App() {
  // Navigazione a schede (stile Bootstrap nav-tabs)
  const [activeTab, setActiveTab] = useState('disponibili');

  // Stato di autenticazione JWT
  const [user, setUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Messaggi feedback (Alert Bootstrap)
  const [alert, setAlert] = useState(null);

  // Dati principali dal backend
  const [stanze, setStanze] = useState([]);
  const [prenotazioni, setPrenotazioni] = useState([]);
  const [utenti, setUtenti] = useState([]);

  // Tab 1: Ricerca disponibilità e prenotazione rapida
  const [searchDate, setSearchDate] = useState(getTodayStr());
  const [searchStartTime, setSearchStartTime] = useState('09:00');
  const [searchEndTime, setSearchEndTime] = useState('10:00');
  const [searchCapienza, setSearchCapienza] = useState('');
  const [stanzeDisponibili, setStanzeDisponibili] = useState([]);
  const [selectedUtenteId, setSelectedUtenteId] = useState('');

  // Tab 2: Filtri Timeline
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filterAnno, setFilterAnno] = useState(currentYear);
  const [filterMese, setFilterMese] = useState(currentMonth);
  const [filterStanzaId, setFilterStanzaId] = useState('');

  // Tab 3: Form Nuova Stanza
  const [roomNome, setRoomNome] = useState('');
  const [roomCapienza, setRoomCapienza] = useState('');
  const [roomDescrizione, setRoomDescrizione] = useState('');
  const [capienzaFilterList, setCapienzaFilterList] = useState('');

  // Tab 4: Form Nuovo Utente
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('USER');

  const showMessage = (type, text) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  // Carica stanze pubbliche
  const loadStanze = useCallback(async (capMin = '') => {
    try {
      const data = await api.getStanze(capMin || undefined);
      setStanze(data || []);
    } catch (err) {
      showMessage('danger', err.message);
    }
  }, []);

  // Carica prenotazioni per timeline
  const loadTimeline = useCallback(async () => {
    try {
      if (filterStanzaId) {
        const data = await api.getPrenotazioniByStanza(filterStanzaId);
        setPrenotazioni(data || []);
      } else if (filterAnno && filterMese) {
        const data = await api.getTimelineAnnoMese(filterAnno, filterMese);
        setPrenotazioni(data || []);
      } else {
        const data = await api.getPrenotazioni();
        setPrenotazioni(data || []);
      }
    } catch (err) {
      showMessage('danger', err.message);
    }
  }, [filterAnno, filterMese, filterStanzaId]);

  // Carica utenti (richiede autenticazione JWT)
  const loadUtenti = useCallback(async () => {
    try {
      const data = await api.getUtenti();
      setUtenti(data || []);
      if (data && data.length > 0 && !selectedUtenteId) {
        setSelectedUtenteId(String(data[0].id));
      }
    } catch {
      setUtenti([]);
    }
  }, [selectedUtenteId]);

  // Verifica se c'è già un token salvato in localStorage all'avvio
  useEffect(() => {
    api
      .me()
      .then((profile) => {
        setUser(profile);
        if (profile && profile.id) {
          setSelectedUtenteId(String(profile.id));
        }
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      });
    loadStanze();
    loadTimeline();
  }, [loadStanze, loadTimeline]);

  useEffect(() => {
    if (user) {
      loadUtenti();
    }
  }, [user, loadUtenti]);

  // Ricerca stanze disponibili (/api/stanze/disponibili)
  const handleSearchAvailable = async (e) => {
    if (e) e.preventDefault();
    const dataI = `${searchDate}T${searchStartTime}:00`;
    const dataF = `${searchDate}T${searchEndTime}:00`;
    try {
      const result = await api.getStanzeDisponibili(dataI, dataF, searchCapienza || undefined);
      setStanzeDisponibili(result || []);
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  // Esegui una prima ricerca disponibilità all'avvio
  useEffect(() => {
    handleSearchAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login JWT
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.login(loginUsername, loginPassword);
      setToken(res.token);
      const profile = await api.me();
      setUser(profile);
      if (profile && profile.id) {
        setSelectedUtenteId(String(profile.id));
      }
      setShowLoginModal(false);
      setLoginUsername('');
      setLoginPassword('');
      showMessage('success', `Benvenuto, ${profile.name || profile.username}!`);
    } catch (err) {
      showMessage('danger', err.message || 'Credenziali non valide');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setUtenti([]);
    showMessage('info', 'Disconnessione effettuata.');
  };

  // Prenota stanza in 1 click dalla scheda disponibilità
  const handleQuickBook = async (stanza) => {
    if (!user) {
      setShowLoginModal(true);
      showMessage('warning', 'Effettua il login per prenotare una stanza.');
      return;
    }
    const idUtente = Number(selectedUtenteId || user.id);
    if (!idUtente) {
      showMessage('warning', 'Seleziona o crea prima un utente nel sistema (tab Utenti).');
      setActiveTab('utenti');
      return;
    }
    const dataI = `${searchDate}T${searchStartTime}:00`;
    const dataF = `${searchDate}T${searchEndTime}:00`;
    try {
      await api.createPrenotazione({
        idUtente,
        idStanza: stanza.id,
        dataI,
        dataF,
      });
      showMessage(
        'success',
        `Prenotazione confermata per "${stanza.nome}" (${searchDate} ${searchStartTime}–${searchEndTime})!`
      );
      handleSearchAvailable();
      loadTimeline();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  // Cancella prenotazione
  const handleDeleteBooking = async (id) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      await api.deletePrenotazione(id);
      showMessage('success', 'Prenotazione cancellata.');
      loadTimeline();
      handleSearchAvailable();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  // Crea nuova stanza
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      await api.createStanza({
        nome: roomNome,
        capienza: roomCapienza ? Number(roomCapienza) : null,
        descrizione: roomDescrizione || null,
      });
      setRoomNome('');
      setRoomCapienza('');
      setRoomDescrizione('');
      showMessage('success', 'Stanza creata con successo!');
      loadStanze(capienzaFilterList);
      handleSearchAvailable();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  const handleDeleteRoom = async (id) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    try {
      await api.deleteStanza(id);
      showMessage('success', 'Stanza eliminata.');
      loadStanze(capienzaFilterList);
      handleSearchAvailable();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  // Crea nuovo utente
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createUtente({
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      showMessage('success', `Utente ${created.name} (${created.email}) creato!`);
      loadUtenti();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await api.deleteUtente(id);
      showMessage('success', 'Utente eliminato.');
      loadUtenti();
    } catch (err) {
      showMessage('danger', err.message);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column">
      {/* NAVBAR BOOTSTRAP */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div className="container">
          <a className="navbar-brand fw-bold d-flex align-items-center gap-2" href="#top">
            <i className="bi bi-calendar2-check-fill fs-4"></i>
            BookingRoom
          </a>

          <div className="d-flex align-items-center gap-3 ms-auto">
            {user ? (
              <>
                <span className="badge bg-light text-primary px-3 py-2">
                  <i className="bi bi-person-check-fill me-1"></i>
                  {user.name || user.username}
                  {user.role && <span className="ms-1 text-muted">({user.role})</span>}
                </span>
                <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-1"></i>Esci
                </button>
              </>
            ) : (
              <button
                className="btn btn-light btn-sm fw-semibold text-primary"
                onClick={() => setShowLoginModal(true)}
              >
                <i className="bi bi-person-lock me-1"></i>Accedi (JWT)
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* CONTENUTO PRINCIPALE */}
      <div className="container py-4 flex-grow-1">
        {/* ALERT FEEDBACK */}
        {alert && (
          <div className={`alert alert-${alert.type} alert-dismissible fade show shadow-sm`} role="alert">
            {alert.text}
            <button type="button" className="btn-close" onClick={() => setAlert(null)}></button>
          </div>
        )}

        {/* MENU A TAB BOOTSTRAP */}
        <ul className="nav nav-pills mb-4 bg-white p-2 rounded shadow-sm">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'disponibili' ? 'active' : ''}`}
              onClick={() => setActiveTab('disponibili')}
            >
              <i className="bi bi-search me-2"></i>Trova & Prenota
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('timeline');
                loadTimeline();
              }}
            >
              <i className="bi bi-clock-history me-2"></i>Timeline Prenotazioni
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'stanze' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('stanze');
                loadStanze(capienzaFilterList);
              }}
            >
              <i className="bi bi-door-open me-2"></i>Sale Riunioni ({stanze.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'utenti' ? 'active' : ''}`}
              onClick={() => {
                if (!user) {
                  setShowLoginModal(true);
                } else {
                  setActiveTab('utenti');
                  loadUtenti();
                }
              }}
            >
              <i className="bi bi-people me-2"></i>Utenti
            </button>
          </li>
        </ul>

        {/* TAB 1: TROVA STANZE DISPONIBILI & PRENOTA CON 1 CLICK */}
        {activeTab === 'disponibili' && (
          <div>
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-body">
                <h5 className="card-title fw-bold mb-3">
                  <i className="bi bi-funnel text-primary me-2"></i>Cerca Sale Libere per Fascia Oraria
                </h5>
                <form className="row g-3 align-items-end" onSubmit={handleSearchAvailable}>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold">Data</label>
                    <input
                      type="date"
                      className="form-control"
                      value={searchDate}
                      onChange={(e) => setSearchDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">Ora Inizio</label>
                    <input
                      type="time"
                      className="form-control"
                      value={searchStartTime}
                      onChange={(e) => setSearchStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">Ora Fine</label>
                    <input
                      type="time"
                      className="form-control"
                      value={searchEndTime}
                      onChange={(e) => setSearchEndTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label fw-semibold">Capienza Min.</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Es. 6"
                      value={searchCapienza}
                      onChange={(e) => setSearchCapienza(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3 d-grid">
                    <button type="submit" className="btn btn-primary">
                      <i className="bi bi-search me-1"></i>Verifica Disponibilità
                    </button>
                  </div>
                </form>

                {user && utenti.length > 0 && (
                  <div className="mt-3 pt-3 border-top d-flex align-items-center gap-2">
                    <span className="small text-muted fw-semibold">Prenota a nome di:</span>
                    <select
                      className="form-select form-select-sm w-auto"
                      value={selectedUtenteId}
                      onChange={(e) => setSelectedUtenteId(e.target.value)}
                    >
                      {utenti.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="row g-3">
              {stanzeDisponibili.length === 0 ? (
                <div className="col-12">
                  <div className="alert alert-secondary text-center py-4">
                    <i className="bi bi-info-circle fs-4 d-block mb-2"></i>
                    Nessuna sala libera trovata per l&apos;intervallo selezionato (oppure non sono ancora state create stanze).
                  </div>
                </div>
              ) : (
                stanzeDisponibili.map((stanza) => (
                  <div className="col-md-4" key={stanza.id}>
                    <div className="card h-100 border-0 shadow-sm">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="card-title fw-bold mb-0">{stanza.nome}</h5>
                          <span className="badge bg-success">Libera</span>
                        </div>
                        <p className="text-muted small mb-2">
                          <i className="bi bi-people-fill me-1"></i>
                          Capienza: <strong>{stanza.capienza || 'N/D'} posti</strong>
                        </p>
                        {stanza.descrizione && (
                          <p className="small text-secondary mb-3">
                            <i className="bi bi-tv me-1"></i>
                            {stanza.descrizione}
                          </p>
                        )}
                        <div className="mt-auto d-grid">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => handleQuickBook(stanza)}
                          >
                            <i className="bi bi-calendar-plus me-1"></i>
                            Prenota ({searchStartTime}–{searchEndTime})
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 2: TIMELINE PRENOTAZIONI */}
        {activeTab === 'timeline' && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="row g-3 align-items-end mb-4">
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Anno</label>
                  <input
                    type="number"
                    className="form-control"
                    value={filterAnno}
                    onChange={(e) => setFilterAnno(Number(e.target.value))}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold">Mese (1-12)</label>
                  <select
                    className="form-select"
                    value={filterMese}
                    onChange={(e) => setFilterMese(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Mese {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label fw-semibold">Filtra per Stanza (opzionale)</label>
                  <select
                    className="form-select"
                    value={filterStanzaId}
                    onChange={(e) => setFilterStanzaId(e.target.value)}
                  >
                    <option value="">Tutte le stanze (usa Anno/Mese)</option>
                    {stanze.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 d-grid">
                  <button className="btn btn-primary" onClick={loadTimeline}>
                    <i className="bi bi-arrow-clockwise me-1"></i>Aggiorna
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>ID</th>
                      <th>Stanza</th>
                      <th>Utente</th>
                      <th>Inizio</th>
                      <th>Fine</th>
                      <th className="text-end">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prenotazioni.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">
                          Nessuna prenotazione trovata per i filtri selezionati.
                        </td>
                      </tr>
                    ) : (
                      prenotazioni.map((p) => (
                        <tr key={p.id}>
                          <td>#{p.id}</td>
                          <td>
                            <span className="fw-semibold">{p.stanza?.nome || '-'}</span>
                          </td>
                          <td>
                            {p.utente?.name} <span className="text-muted small">({p.utente?.email})</span>
                          </td>
                          <td>{p.dataI?.replace('T', ' ').slice(0, 16)}</td>
                          <td>{p.dataF?.replace('T', ' ').slice(0, 16)}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleDeleteBooking(p.id)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GESTIONE STANZE */}
        {activeTab === 'stanze' && (
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title fw-bold mb-3">Nuova Sala Riunioni</h5>
                  <form onSubmit={handleCreateRoom}>
                    <div className="mb-3">
                      <label className="form-label">Nome Stanza *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Es. Sala Leonardo"
                        value={roomNome}
                        onChange={(e) => setRoomNome(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Capienza (posti)</label>
                      <input
                        type="number"
                        min="1"
                        className="form-control"
                        placeholder="Es. 12"
                        value={roomCapienza}
                        onChange={(e) => setRoomCapienza(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Dotazioni / Descrizione</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Es. Proiettore 4K, Lavagna"
                        value={roomDescrizione}
                        onChange={(e) => setRoomDescrizione(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-100">
                      <i className="bi bi-plus-circle me-1"></i>Aggiungi Stanza
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-md-8">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="card-title fw-bold mb-0">Elenco Sale</h5>
                    <div className="d-flex gap-2">
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        placeholder="Filtra capienza min."
                        value={capienzaFilterList}
                        onChange={(e) => {
                          setCapienzaFilterList(e.target.value);
                          loadStanze(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Capienza</th>
                          <th>Dotazioni</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stanze.map((s) => (
                          <tr key={s.id}>
                            <td>#{s.id}</td>
                            <td className="fw-semibold">{s.nome}</td>
                            <td>
                              <span className="badge bg-secondary">{s.capienza || '-'} posti</span>
                            </td>
                            <td className="text-muted small">{s.descrizione || '-'}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDeleteRoom(s.id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GESTIONE UTENTI */}
        {activeTab === 'utenti' && (
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title fw-bold mb-3">Registra Nuovo Utente</h5>
                  <form onSubmit={handleCreateUser}>
                    <div className="mb-3">
                      <label className="form-label">Nome *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className="form-control"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Ruolo</label>
                      <select
                        className="form-select"
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary w-100">
                      <i className="bi bi-person-plus me-1"></i>Crea Utente
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="col-md-8">
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="card-title fw-bold mb-3">Utenti Registrati</h5>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Ruolo</th>
                          <th className="text-end">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {utenti.map((u) => (
                          <tr key={u.id}>
                            <td>#{u.id}</td>
                            <td className="fw-semibold">{u.name}</td>
                            <td>{u.email}</td>
                            <td>
                              <span className="badge bg-info text-dark">{u.role || 'USER'}</span>
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleDeleteUser(u.id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALE LOGIN BOOTSTRAP */}
      {showLoginModal && (
        <div
          className="modal d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-shield-lock me-2"></i>Accesso BookingRoom
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowLoginModal(false)}
                ></button>
              </div>
              <form onSubmit={handleLogin}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Email o Username</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="admin oppure email utente"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-text">
                    Credenziali di bootstrap predefinite: <code>admin</code> / <code>admin</code>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowLoginModal(false)}
                  >
                    Annulla
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Accedi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
