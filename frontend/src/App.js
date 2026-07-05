import React, { useState, useEffect } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";

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
                <button className="btn btn-outline-light" onClick={() => { localStorage.removeItem("token"); setToken(""); }}>
                  Выйти
                </button>
              )}
            </div>
          </div>
        </nav>

        <div className="container flex-grow-1 py-4">
          <Routes>
            <Route path="/" element={<Home games={games} />} />
            <Route path="/register" element={<Register setToken={setToken} />} />
            <Route path="/login" element={<Login setToken={setToken} />} />
            <Route path="/games/:id" element={<GameDetail token={token} />} />
            {role === "admin" && (
              <Route path="/admin" element={<AdminPanel token={token} fetchGames={fetchGames} />} />
            )}
          </Routes>
        </div>

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
              <Link to={`/games/${game.id}`} className="text-decoration-none">
                <div className="card h-100 border-0 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
                  <img
                    src={game.cover_url || "https://via.placeholder.com/300x200?text=No+Cover"}
                    className="card-img-top"
                    alt={game.title}
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                  <div className="card-body">
                    <h5 className="card-title fw-bold">{game.title}</h5>
                    <p className="card-text small text-white-50">{game.description?.slice(0, 80)}...</p>
                    <p className="card-text">
                      <span className="badge bg-success fs-6">${game.price}</span>
                    </p>
                  </div>
                </div>
              </Link>
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
    if (!username.trim()) { setError("Логин обязателен"); return; }
    if (password !== confirmPassword) { setError("Пароли не совпадают"); return; }
    if (password.length < 6) { setError("Пароль должен быть не менее 6 символов"); return; }
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
              <div className="mb-3"><label className="form-label">Логин</label><input className="form-control" placeholder="Придумайте логин" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label">Email</label><input type="email" className="form-control" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label">Пароль</label><input type="password" className="form-control" placeholder="Минимум 6 символов" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label">Повторите пароль</label><input type="password" className="form-control" placeholder="Повторите пароль" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
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
              <div className="mb-3"><label className="form-label">Email</label><input type="email" className="form-control" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="mb-3"><label className="form-label">Пароль</label><input type="password" className="form-control" placeholder="Ваш пароль" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <button type="submit" className="btn btn-primary w-100">Войти</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Страница игры -----
function GameDetail({ token }) {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ rating: 5, text: "" });
  const [message, setMessage] = useState("");

  const fetchGame = async () => {
    try {
      const { data } = await API.get(`/games/${id}`);
      setGame(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data } = await API.get(`/games/${id}/reviews`);
      setReviews(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGame();
    fetchReviews();
  }, [id]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setMessage("Чтобы оставить отзыв, войдите в систему.");
      return;
    }
    try {
      await API.post(`/games/${id}/reviews`, newReview, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewReview({ rating: 5, text: "" });
      setMessage("Отзыв добавлен!");
      fetchReviews();
    } catch (err) {
      setMessage(err.response?.data?.detail || "Ошибка");
    }
  };

  if (!game) return <p className="text-white">Загрузка...</p>;

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="text-white">
      <Link to="/" className="btn btn-outline-light mb-3">← Назад</Link>
      <div className="row">
        <div className="col-md-4">
          <img src={game.cover_url || "https://via.placeholder.com/300x400?text=No+Cover"} alt={game.title} className="img-fluid rounded" />
        </div>
        <div className="col-md-8">
          <h1>{game.title}</h1>
          <p className="text-white-50">{game.description}</p>
          <ul className="list-unstyled">
            <li><strong>Цена:</strong> ${game.price}</li>
            <li><strong>Разработчик:</strong> {game.developer || "—"}</li>
            <li><strong>Издатель:</strong> {game.publisher || "—"}</li>
            <li><strong>Дата выхода:</strong> {game.release_date || "—"}</li>
            {avgRating && <li><strong>Рейтинг:</strong> ⭐ {avgRating} ({reviews.length} отзывов)</li>}
          </ul>
        </div>
      </div>

      <hr className="my-4" />

      <h4>Отзывы</h4>
      {message && <div className="alert alert-info">{message}</div>}

      {token ? (
        <form onSubmit={handleReviewSubmit} className="mb-4">
          <div className="row g-2 align-items-center">
            <div className="col-auto">
              <label>Оценка:</label>
              <select className="form-select" value={newReview.rating} onChange={(e) => setNewReview({ ...newReview, rating: parseInt(e.target.value) })}>
                {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} звёзд</option>)}
              </select>
            </div>
            <div className="col">
              <textarea className="form-control" placeholder="Ваш отзыв (необязательно)" value={newReview.text} onChange={(e) => setNewReview({ ...newReview, text: e.target.value })} />
            </div>
            <div className="col-auto">
              <button type="submit" className="btn btn-primary">Отправить</button>
            </div>
          </div>
        </form>
      ) : (
        <p><Link to="/login">Войдите</Link>, чтобы оставить отзыв.</p>
      )}

      {reviews.length === 0 ? (
        <p>Пока нет отзывов.</p>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="card mb-2 text-white" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <strong>{review.username}</strong>
                <span>{'⭐'.repeat(review.rating)}</span>
              </div>
              {review.text && <p className="mt-1 mb-0">{review.text}</p>}
              <small className="text-white-50">{new Date(review.created_at).toLocaleDateString()}</small>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ----- Админ-панель (без изменений, но оставлю для полноты) -----
function AdminPanel({ token, fetchGames }) {
  const [games, setGames] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    release_date: "",
    developer: "",
    publisher: "",
    cover_url: "",
    genre_ids: [],
  });
  const [message, setMessage] = useState("");

  const loadGames = async () => {
    try {
      const { data } = await API.get("/games");
      setGames(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadGames(); }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({
      title: "", description: "", price: "", release_date: "",
      developer: "", publisher: "", cover_url: "", genre_ids: [],
    });
    setEditingGame(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        release_date: form.release_date,
        developer: form.developer,
        publisher: form.publisher,
        cover_url: form.cover_url,
        genre_ids: form.genre_ids,
      };
      if (editingGame) {
        await API.put(`/games/${editingGame}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setMessage("Игра обновлена!");
      } else {
        await API.post("/games", payload, { headers: { Authorization: `Bearer ${token}` } });
        setMessage("Игра добавлена!");
      }
      resetForm();
      loadGames();
      if (fetchGames) fetchGames();
    } catch (err) {
      setMessage("Ошибка: " + (err.response?.data?.detail || "Неизвестная ошибка"));
    }
  };

  const handleEdit = (game) => {
    setEditingGame(game.id);
    setForm({
      title: game.title || "",
      description: game.description || "",
      price: game.price || "",
      release_date: game.release_date || "",
      developer: game.developer || "",
      publisher: game.publisher || "",
      cover_url: game.cover_url || "",
      genre_ids: game.genre_ids || [],
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить игру?")) return;
    try {
      await API.delete(`/games/${id}`, { headers: { Authorization: `Bearer ${token}` }, data: {} });
      setMessage("Игра удалена");
      loadGames();
      if (fetchGames) fetchGames();
    } catch (err) {
      setMessage("Ошибка удаления: " + (err.response?.data?.detail || ""));
    }
  };

  return (
    <div>
      <h3 className="text-white mb-3">Управление играми</h3>
      {message && <div className="alert alert-info">{message}</div>}

      <div className="card border-0 shadow-lg mb-4" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", color: "white" }}>
        <div className="card-body">
          <h5>{editingGame ? "Редактировать игру" : "Добавить игру"}</h5>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Название</label>
                <input name="title" className="form-control" value={form.title} onChange={handleChange} required />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Цена</label>
                <input name="price" type="number" step="0.01" className="form-control" value={form.price} onChange={handleChange} required />
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">Описание</label>
                <textarea name="description" className="form-control" value={form.description} onChange={handleChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Дата выхода</label>
                <input name="release_date" type="date" className="form-control" value={form.release_date} onChange={handleChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Разработчик</label>
                <input name="developer" className="form-control" value={form.developer} onChange={handleChange} />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Издатель</label>
                <input name="publisher" className="form-control" value={form.publisher} onChange={handleChange} />
              </div>
              <div className="col-12 mb-3">
                <label className="form-label">URL обложки</label>
                <input name="cover_url" className="form-control" value={form.cover_url} onChange={handleChange} placeholder="https://..." />
                {form.cover_url && <img src={form.cover_url} alt="preview" className="mt-2" style={{ maxHeight: "100px" }} />}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button type="submit" className="btn btn-success">{editingGame ? "Сохранить" : "Добавить"}</button>
              {editingGame && <button type="button" className="btn btn-secondary" onClick={resetForm}>Отмена</button>}
            </div>
          </form>
        </div>
      </div>

      <h4 className="text-white">Список игр</h4>
      <div className="table-responsive">
        <table className="table table-dark table-striped">
          <thead>
            <tr><th>ID</th><th>Обложка</th><th>Название</th><th>Цена</th><th>Действия</th></tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>{game.id}</td>
                <td><img src={game.cover_url || "https://via.placeholder.com/50x50?text=?"} alt="" style={{ width: "50px", height: "50px", objectFit: "cover" }} /></td>
                <td>{game.title}</td>
                <td>${game.price}</td>
                <td>
                  <button className="btn btn-sm btn-outline-light me-2" onClick={() => handleEdit(game)}>✏️</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(game.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;