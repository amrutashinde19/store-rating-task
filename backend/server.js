const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-store-rating-secret';
const db = new sqlite3.Database(path.join(__dirname, 'store-rating.sqlite'));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Store Rating API is running',
    health: '/api/health',
    frontend: 'http://127.0.0.1:5173/',
  });
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

const roles = ['admin', 'user', 'owner'];
const sortColumns = {
  users: {
    name: 'u.name',
    email: 'u.email',
    address: 'u.address',
    role: 'u.role',
  },
  stores: {
    name: 's.name',
    email: 's.email',
    address: 's.address',
    rating: 'average_rating',
  },
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function validatePassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 16 &&
    /[A-Z]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function validateUserPayload(body, includeRole = false) {
  const errors = [];
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const address = String(body.address || '').trim();
  const password = String(body.password || '');
  const role = body.role || 'user';

  if (name.length < 20 || name.length > 60) {
    errors.push('Name must be between 20 and 60 characters.');
  }
  if (!validateEmail(email)) errors.push('Email address is invalid.');
  if (!validatePassword(password)) {
    errors.push('Password must be 8-16 characters and include one uppercase letter and one special character.');
  }
  if (address.length > 400) errors.push('Address cannot exceed 400 characters.');
  if (includeRole && !roles.includes(role)) errors.push('Role is invalid.');

  return { errors, value: { name, email, address, password, role } };
}

function validateStorePayload(body) {
  const errors = [];
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const address = String(body.address || '').trim();
  const ownerId = Number(body.ownerId || body.owner_id || 0) || null;

  if (name.length < 2) errors.push('Store name is required.');
  if (email && !validateEmail(email)) errors.push('Store email address is invalid.');
  if (address.length > 400) errors.push('Store address cannot exceed 400 characters.');

  return { errors, value: { name, email, address, ownerId } };
}

function signUser(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    address: user.address,
    role: user.role,
  };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Authentication required.' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, name, email, address, role FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ message: 'User not found.' });
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired session.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource.' });
    }
    return next();
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function orderClause(group, sortBy, order) {
  const column = sortColumns[group][sortBy] || sortColumns[group].name;
  const direction = String(order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `${column} ${direction}`;
}

async function createUser({ name, email, address, password, role }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await run(
    'INSERT INTO users (name, email, password_hash, address, role) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, address, role]
  );
  return get('SELECT id, name, email, address, role FROM users WHERE id = ?', [result.lastID]);
}

async function initDb() {
  await run('PRAGMA foreign_keys = ON');
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    address TEXT DEFAULT '',
    role TEXT NOT NULL CHECK(role IN ('admin', 'user', 'owner')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
  )`);

  const existingUsers = await get('SELECT COUNT(*) AS count FROM users');
  if (existingUsers.count === 0) {
    const admin = await createUser({
      name: 'System Administrator One',
      email: 'admin@store.test',
      password: 'Admin@123',
      address: 'Head office, Platform Operations',
      role: 'admin',
    });
    const owner = await createUser({
      name: 'Neighborhood Store Owner',
      email: 'owner@store.test',
      password: 'Owner@123',
      address: '42 Market Street, Retail District',
      role: 'owner',
    });
    const user = await createUser({
      name: 'Everyday Normal User Account',
      email: 'user@store.test',
      password: 'User@123',
      address: '18 Customer Lane, City Center',
      role: 'user',
    });

    const firstStore = await run(
      'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
      ['Central Market', 'hello@central.test', 'Main Road, City Center', owner.id]
    );
    await run(
      'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
      ['Fresh Basket', 'team@freshbasket.test', 'Lake View Avenue', owner.id]
    );
    await run('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)', [user.id, firstStore.lastID, 4]);
    console.log('Seeded demo accounts: admin@store.test, owner@store.test, user@store.test');
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: 'connected' });
});

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const { errors, value } = validateUserPayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(' ') });

  try {
    const user = await createUser({ ...value, role: 'user' });
    return res.status(201).json({ user: publicUser(user), token: signUser(user) });
  } catch (error) {
    if (error.message.includes('UNIQUE')) return res.status(409).json({ message: 'Email is already registered.' });
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await get('SELECT * FROM users WHERE email = ?', [email]);
  const valid = user ? await bcrypt.compare(String(req.body.password || ''), user.password_hash) : false;

  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });
  return res.json({ user: publicUser(user), token: signUser(user) });
}));

app.get('/api/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch('/api/me/password', auth, asyncRoute(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const user = await get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!valid) return res.status(400).json({ message: 'Current password is incorrect.' });
  if (!validatePassword(newPassword)) {
    return res.status(400).json({ message: 'New password must be 8-16 characters and include one uppercase letter and one special character.' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
  return res.json({ message: 'Password updated.' });
}));

app.get('/api/admin/dashboard', auth, requireRole('admin'), asyncRoute(async (req, res) => {
  const [users, stores, ratings] = await Promise.all([
    get('SELECT COUNT(*) AS count FROM users'),
    get('SELECT COUNT(*) AS count FROM stores'),
    get('SELECT COUNT(*) AS count FROM ratings'),
  ]);
  res.json({
    totalUsers: users.count,
    totalStores: stores.count,
    totalRatings: ratings.count,
  });
}));

app.post('/api/admin/users', auth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { errors, value } = validateUserPayload(req.body, true);
  if (errors.length) return res.status(400).json({ message: errors.join(' ') });

  try {
    const user = await createUser(value);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.message.includes('UNIQUE')) return res.status(409).json({ message: 'Email is already registered.' });
    throw error;
  }
}));

app.get('/api/admin/users', auth, requireRole('admin'), asyncRoute(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const role = String(req.query.role || '').trim();
  const params = [q, q, q];
  let where = 'WHERE (u.name LIKE ? OR u.email LIKE ? OR u.address LIKE ?)';

  if (role && roles.includes(role)) {
    where += ' AND u.role = ?';
    params.push(role);
  }

  const users = await all(
    `SELECT u.id, u.name, u.email, u.address, u.role,
      CASE WHEN u.role = 'owner' THEN ROUND(AVG(r.rating), 2) ELSE NULL END AS owner_store_rating
     FROM users u
     LEFT JOIN stores s ON s.owner_id = u.id
     LEFT JOIN ratings r ON r.store_id = s.id
     ${where}
     GROUP BY u.id
     ORDER BY ${orderClause('users', req.query.sortBy, req.query.order)}`,
    params
  );
  res.json({ users });
}));

app.post('/api/admin/stores', auth, requireRole('admin'), asyncRoute(async (req, res) => {
  const { errors, value } = validateStorePayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join(' ') });

  if (value.ownerId) {
    const owner = await get('SELECT id FROM users WHERE id = ? AND role = ?', [value.ownerId, 'owner']);
    if (!owner) return res.status(400).json({ message: 'Store owner must be an existing owner user.' });
  }

  const result = await run(
    'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
    [value.name, value.email, value.address, value.ownerId]
  );
  const store = await get('SELECT * FROM stores WHERE id = ?', [result.lastID]);
  res.status(201).json({ store });
}));

app.get('/api/admin/stores', auth, requireRole('admin'), asyncRoute(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const stores = await all(
    `SELECT s.id, s.name, s.email, s.address, s.owner_id AS ownerId, u.name AS ownerName,
      ROUND(AVG(r.rating), 2) AS average_rating, COUNT(r.id) AS rating_count
     FROM stores s
     LEFT JOIN users u ON u.id = s.owner_id
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE s.name LIKE ? OR s.email LIKE ? OR s.address LIKE ?
     GROUP BY s.id
     ORDER BY ${orderClause('stores', req.query.sortBy, req.query.order)}`,
    [q, q, q]
  );
  res.json({ stores });
}));

app.get('/api/stores', auth, asyncRoute(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const stores = await all(
    `SELECT s.id, s.name, s.email, s.address,
      ROUND(AVG(r.rating), 2) AS averageRating,
      COUNT(r.id) AS ratingCount,
      mine.rating AS myRating
     FROM stores s
     LEFT JOIN ratings r ON r.store_id = s.id
     LEFT JOIN ratings mine ON mine.store_id = s.id AND mine.user_id = ?
     WHERE s.name LIKE ? OR s.address LIKE ?
     GROUP BY s.id
     ORDER BY ${orderClause('stores', req.query.sortBy, req.query.order)}`,
    [req.user.id, q, q]
  );
  res.json({ stores });
}));

app.put('/api/stores/:id/rating', auth, requireRole('user'), asyncRoute(async (req, res) => {
  const storeId = Number(req.params.id);
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be a number from 1 to 5.' });
  }

  const store = await get('SELECT id FROM stores WHERE id = ?', [storeId]);
  if (!store) return res.status(404).json({ message: 'Store not found.' });

  await run(
    `INSERT INTO ratings (user_id, store_id, rating, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, store_id)
     DO UPDATE SET rating = excluded.rating, updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, storeId, rating]
  );
  res.json({ message: 'Rating saved.' });
}));

app.get('/api/owner/dashboard', auth, requireRole('owner'), asyncRoute(async (req, res) => {
  const stores = await all(
    `SELECT s.id, s.name, s.address, ROUND(AVG(r.rating), 2) AS averageRating, COUNT(r.id) AS ratingCount
     FROM stores s
     LEFT JOIN ratings r ON r.store_id = s.id
     WHERE s.owner_id = ?
     GROUP BY s.id
     ORDER BY s.name ASC`,
    [req.user.id]
  );
  const ratings = await all(
    `SELECT r.id, r.rating, r.updated_at AS updatedAt, s.name AS storeName,
      u.name AS userName, u.email AS userEmail, u.address AS userAddress
     FROM ratings r
     JOIN stores s ON s.id = r.store_id
     JOIN users u ON u.id = r.user_id
     WHERE s.owner_id = ?
     ORDER BY r.updated_at DESC`,
    [req.user.id]
  );
  const average = await get(
    `SELECT ROUND(AVG(r.rating), 2) AS rating
     FROM ratings r
     JOIN stores s ON s.id = r.store_id
     WHERE s.owner_id = ?`,
    [req.user.id]
  );
  res.json({ stores, ratings, averageRating: average.rating || 0 });
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Unexpected server error.' });
});

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
