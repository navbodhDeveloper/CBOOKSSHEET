const express = require('express');
const cors = require('cors');
const path = require('path');
const { init } = require('./db');

const metaRoutes = require('./routes/meta');
const challanRoutes = require('./routes/challans');
const exportRoutes = require('./routes/export');

async function start() {
  await init(); // load/seed the JSON database

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', metaRoutes);
  app.use('/api/challans', challanRoutes);
  app.use('/api/export', exportRoutes);
  app.get('/health', (req, res) => res.json({ ok: true }));

  // Serve the built React app (client/dist) in production
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Challan app running at http://localhost:${PORT}`);
  });
}

start();
