const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-backend' });
});

// Заглушка для pages (позже подключим базу)
app.get('/api/pages', (req, res) => {
  res.json([{ slug: 'about', title: 'About us', content: 'We are a game store.' }]);
});

app.listen(port, () => {
  console.log(`Node backend listening on port ${port}`);
});