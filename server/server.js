const express = require('express');
const cors = require('cors');
const path = require('path');
const { init } = require('./db');
const schoolRoutes = require('./routes/schools');
const exportSchoolsRoutes = require('./routes/export-schools');
const partyRoutes = require('./routes/parties');
const exportPartiesRoutes = require('./routes/export-parties');
const metaRoutes = require('./routes/meta');
const challanRoutes = require('./routes/challans');
const exportRoutes = require('./routes/export');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const { requireAuth, setupAuth } = require('./auth');
// const orderDetailRoutes = require('./routes/order-details');
// const exportOrderDetailRoutes = require('./routes/export-order-details');

async function start() {
  await init(); // load/seed the JSON database
  await setupAuth(); // users table + first admin (see auth.js)

  const app = express();
  app.set('trust proxy', 1); // behind Caddy: use the real visitor IP for login throttling
  app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '15mb' }));


  // Login is public; EVERYTHING else under /api needs a valid login token.
  app.use('/api/auth', authRoutes);
  app.use('/api', requireAuth);
  app.use('/api/users', userRoutes);

  // app.use('/api/order-details', orderDetailRoutes);
  // app.use('/api/export', exportOrderDetailRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/export', exportSchoolsRoutes);
  app.use('/api', metaRoutes);
  app.use('/api/parties', partyRoutes); 
  app.use('/api/export', exportPartiesRoutes);  
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