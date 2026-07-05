import React, { useState, useEffect } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";

const API = axios.create({ baseURL: "http://localhost/api" });

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch (e) {
    return null;
  }
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [games, setGames] = useState([]);
  const [role, setRole] = useState("");

  const fetchGames = async () => {
    try {
      const { data } = await API.get("/games");
      setGames(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (token) {
      const payload = parseJwt(token);
      setRole(payload?.role || "user");
    } else {
      setRole("");
    }
  }, [token]);

  return (
    <BrowserRouter>
      <div className="min-vh-100 d-flex flex-column" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>
        {/* Навбар */}
        <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="container">
            <Link className="navbar-brand fw-bold" to="/">🎮 Game Store</Link>
            <div className="d-flex gap-2">
              {role === "admin" && (
                <Link className="btn btn-outline-warning" to="/admin">Админ-панель</Link>
              )}
              {!token ? (
                <>
                  <Link className="btn btn-outline-light" to="/register">Регистрация</Link>
                  <Link className="btn btn-outline-light" to="/login">Вход</Link>
                </>
              ) : (
                <button
                  className="btn btn-outline-light"
                  onClick={() => {
                    localStorage.removeItem("token");
                    setToken("");
                  }}
                >
                  Выйти
                </button>
              )}
            </div>
          </div>
        </nav>

        {/* Контент */}
        <div className="container flex-grow-1 py-4">
          <Routes>
            <Route path="/" element={<Home games={games} />} />
            <Route path="/register" element={<Register setToken={setToken} />} />
            <Route path="/login" element={<Login setToken={setToken} />} />
            {role === "admin" && (
              <Route path="/admin" element={<AdminPanel token={token} fetchGames={fetchGames} />} />
            )}
          </Routes>
        </div>

        {/* Футер */}
        <footer className="text-center text-white-50 py-3" style={{ background: "rgba(0,0,0,0.5)" }}>
          <small>© 2026 Game Store. Учебный проект.</small>
        </footer>
      </div>
    </BrowserRouter>
  );
}

// ----- Главная страница -----
function Home({ games }) {
  return (
    <div>
      <h2 className="text-white mb-4">🔥 Популярные игры</h2>
      {games.length === 0 ? (
        <div className="text-center text-white-50 mt-5">
          <h4>Игр пока нет</h4>
          <p>Администратор ещё не добавил ни одной игры.</p>
        </div>
      ) : (
        <div className="row">
          {games.map((game) => (
            <div key={game.id} className="col-md-4 col-lg-3 mb-4">
              <div className="card h-100 border-0 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
                <div className="card-body">
                  <h5 className="card-title fw-bold">{game.title}</h5>
                  <p className="card-text small text-white-50">{game.description?.slice(0, 80)}...</p>
                  <p className="card-text">
                    <span className="badge bg-success fs-6">${game.price}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- Регистрация -----
function Register({ setToken }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Логин обязателен");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    try {
      await API.post("/register", { username, email, password });
      alert("Регистрация успешна! Теперь войдите.");
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Ошибка регистрации");
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card border-0 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
          <div className="card-body p-4">
            <h3 className="text-center mb-4">Регистрация</h3>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Логин</label>
                <input className="form-control" placeholder="Придумайте логин" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Пароль</label>
                <input type="password" className="form-control" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Повторите пароль</label>
                <input type="password" className="form-control" placeholder="Повторите пароль" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-success w-100">Зарегистрироваться</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Вход -----
function Login({ setToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await API.post("/login", { email, password });
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Ошибка входа");
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card border-0 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
          <div className="card-body p-4">
            <h3 className="text-center mb-4">Вход</h3>
            {error && <div className="alert alert-danger">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Пароль</label>
                <input type="password" className="form-control" placeholder="Ваш пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary w-100">Войти</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Админ-панель -----
function AdminPanel({ token, fetchGames }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [developer, setDeveloper] = useState("");
  const [publisher, setPublisher] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await API.post(
        "/games",
        {
          title,
          description,
          price: parseFloat(price),
          release_date: releaseDate,
          developer,
          publisher,
          genre_ids: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("Игра успешно добавлена!");
      setTitle(""); setDescription(""); setPrice(""); setReleaseDate("");
      setDeveloper(""); setPublisher("");
      fetchGames();
    } catch (err) {
      setMessage("Ошибка: " + (err.response?.data?.detail || "Неизвестная ошибка"));
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6">
        <div className="card border-0 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
          <div className="card-body p-4">
            <h3 className="text-center mb-4">Добавить игру</h3>
            {message && <div className="alert alert-info">{message}</div>}
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label">Название</label>
                <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Описание</label>
                <textarea className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Цена</label>
                <input type="number" step="0.01" className="form-control" value={price} onChange={(e) => setPrice(e.target.value)} required />
              </div>
              <div className="mb-3">
                <label className="form-label">Дата выхода</label>
                <input type="date" className="form-control" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Разработчик</label>
                <input className="form-control" value={developer} onChange={(e) => setDeveloper(e.target.value)} />
              </div>
              <div className="mb-3">
                <label className="form-label">Издатель</label>
                <input className="form-control" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-success w-100">Добавить</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;