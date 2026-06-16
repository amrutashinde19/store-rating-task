import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import './styles.css';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

function getStoredToken() {
  return localStorage.getItem('token') || '';
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

const blankLogin = { email: 'admin@store.test', password: 'Admin@123' };
const blankSignup = { name: '', email: '', address: '', password: '' };
const blankUser = { name: '', email: '', address: '', password: '', role: 'user' };
const blankStore = { name: '', email: '', address: '', ownerId: '' };

function roleLabel(role) {
  return ({ admin: 'System Administrator', owner: 'Store Owner', user: 'Normal User' })[role] || role;
}

function formatRating(value) {
  return value ? Number(value).toFixed(1).replace('.0', '') : '-';
}

function App() {
  const [token, setToken] = useState(getStoredToken());
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState(blankLogin);
  const [signupForm, setSignupForm] = useState(blankSignup);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : '';
  }, [token]);

  function setSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setMessage('');
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  }

  async function submitLogin(event) {
    event.preventDefault();
    try {
      const { data } = await api.post('/auth/login', loginForm);
      setSession(data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Login failed.');
    }
  }

  async function submitSignup(event) {
    event.preventDefault();
    try {
      const { data } = await api.post('/auth/signup', signupForm);
      setSession(data);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Signup failed.');
    }
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">FullStack Intern Challenge</p>
            <h1>Store Rating</h1>
          </div>
          <div className="segmented">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Login</button>
            <button className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Sign up</button>
          </div>
          {message && <p className="alert">{message}</p>}
          {authMode === 'login' ? (
            <form onSubmit={submitLogin} className="stack">
              <Input label="Email" value={loginForm.email} onChange={(email) => setLoginForm({ ...loginForm, email })} />
              <Input label="Password" type="password" value={loginForm.password} onChange={(password) => setLoginForm({ ...loginForm, password })} />
              <button className="primary">Login</button>
            </form>
          ) : (
            <form onSubmit={submitSignup} className="stack">
              <Input label="Name" value={signupForm.name} onChange={(name) => setSignupForm({ ...signupForm, name })} />
              <Input label="Email" value={signupForm.email} onChange={(email) => setSignupForm({ ...signupForm, email })} />
              <Input label="Address" value={signupForm.address} onChange={(address) => setSignupForm({ ...signupForm, address })} />
              <Input label="Password" type="password" value={signupForm.password} onChange={(password) => setSignupForm({ ...signupForm, password })} />
              <button className="primary">Create Account</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">{roleLabel(user.role)}</p>
          <h1>Store Rating Dashboard</h1>
        </div>
        <div className="account">
          <span>{user.name}</span>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      {user.role === 'admin' && <AdminView />}
      {user.role === 'user' && <UserView />}
      {user.role === 'owner' && <OwnerView />}
    </main>
  );
}

function Input({ label, value, onChange, type = 'text', as = 'input', children }) {
  const Control = as;
  return (
    <label className="field">
      <span>{label}</span>
      <Control value={value} type={type} onChange={(event) => onChange(event.target.value)}>
        {children}
      </Control>
    </label>
  );
}

function Stat({ label, value, detail }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <nav className="tabs" aria-label="Dashboard sections">
      {tabs.map((tab) => (
        <button key={tab.id} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function SortButton({ label, column, sort, onSort }) {
  const active = sort.by === column;
  const marker = active ? (sort.order === 'asc' ? 'up' : 'down') : '';
  return (
    <button className={`sort-button ${active ? 'active' : ''}`} onClick={() => onSort(column)}>
      {label}{marker ? ` ${marker}` : ''}
    </button>
  );
}

function RatingDots({ rating, max = 5 }) {
  return (
    <div className="rating-dots" aria-label={`Rating ${rating || 0} out of ${max}`}>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={index < Number(rating || 0) ? 'filled' : ''} />
      ))}
    </div>
  );
}

function BarList({ items, valueKey = 'value', labelKey = 'label', max }) {
  const largest = max || Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  return (
    <div className="bar-list">
      {items.map((item) => {
        const value = Number(item[valueKey] || 0);
        return (
          <div className="bar-row" key={item[labelKey]}>
            <span>{item[labelKey]}</span>
            <div className="bar-track"><div style={{ width: `${Math.max(4, (value / largest) * 100)}%` }} /></div>
            <strong>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PasswordPanel() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    try {
      const { data } = await api.patch('/me/password', form);
      setMessage(data.message);
      setForm({ currentPassword: '', newPassword: '' });
    } catch (error) {
      setMessage(error.response?.data?.message || 'Password update failed.');
    }
  }

  return (
    <section className="panel compact">
      <div className="panel-title">
        <h2>Update Password</h2>
        <span>8-16 chars, uppercase, special char</span>
      </div>
      {message && <p className="notice">{message}</p>}
      <form onSubmit={submit} className="inline-form">
        <Input label="Current" type="password" value={form.currentPassword} onChange={(currentPassword) => setForm({ ...form, currentPassword })} />
        <Input label="New" type="password" value={form.newPassword} onChange={(newPassword) => setForm({ ...form, newPassword })} />
        <button className="primary">Save</button>
      </form>
    </section>
  );
}

function AdminView() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState({ totalUsers: 0, totalStores: 0, totalRatings: 0 });
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [userForm, setUserForm] = useState(blankUser);
  const [storeForm, setStoreForm] = useState(blankStore);
  const [filters, setFilters] = useState({
    q: '',
    role: '',
    userSort: { by: 'name', order: 'asc' },
    storeSort: { by: 'name', order: 'asc' },
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const ownerOptions = useMemo(() => users.filter((item) => item.role === 'owner'), [users]);
  const roleCounts = useMemo(() => {
    return ['admin', 'owner', 'user'].map((role) => ({
      label: roleLabel(role),
      value: users.filter((item) => item.role === role).length,
    }));
  }, [users]);
  const topStores = useMemo(() => {
    return [...stores]
      .sort((a, b) => Number(b.average_rating || 0) - Number(a.average_rating || 0))
      .slice(0, 5)
      .map((store) => ({ label: store.name, value: Number(store.average_rating || 0) }));
  }, [stores]);

  async function load(nextFilters = filters) {
    setLoading(true);
    const params = {
      q: nextFilters.q,
      role: nextFilters.role,
      sortBy: nextFilters.userSort.by,
      order: nextFilters.userSort.order,
    };
    const storeParams = {
      q: nextFilters.q,
      sortBy: nextFilters.storeSort.by,
      order: nextFilters.storeSort.order,
    };
    try {
      const [dash, userRes, storeRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users', { params }),
        api.get('/admin/stores', { params: storeParams }),
      ]);
      setDashboard(dash.data);
      setUsers(userRes.data.users);
      setStores(storeRes.data.stores);
      setMessage((current) => (current === 'Could not load admin data.' ? '' : current));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {
      setLoading(false);
      setMessage('Could not load admin data.');
    });
  }, [filters.q, filters.role, filters.userSort.by, filters.userSort.order, filters.storeSort.by, filters.storeSort.order]);

  function sortUsers(by) {
    setFilters((current) => ({
      ...current,
      userSort: { by, order: current.userSort.by === by && current.userSort.order === 'asc' ? 'desc' : 'asc' },
    }));
  }

  function sortStores(by) {
    setFilters((current) => ({
      ...current,
      storeSort: { by, order: current.storeSort.by === by && current.storeSort.order === 'asc' ? 'desc' : 'asc' },
    }));
  }

  async function addUser(event) {
    event.preventDefault();
    try {
      await api.post('/admin/users', userForm);
      const nextFilters = { ...filters, q: userForm.email, role: '' };
      setUserForm(blankUser);
      setActiveTab('users');
      setFilters(nextFilters);
      await load(nextFilters);
      setMessage('User added.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'User could not be added.');
    }
  }

  async function addStore(event) {
    event.preventDefault();
    try {
      await api.post('/admin/stores', { ...storeForm, ownerId: storeForm.ownerId || null });
      const createdStoreName = storeForm.name;
      const nextFilters = { ...filters, q: createdStoreName, role: '' };
      setStoreForm(blankStore);
      setActiveTab('stores');
      setFilters(nextFilters);
      await load(nextFilters);
      setMessage('Store added.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Store could not be added.');
    }
  }

  return (
    <div className="workspace">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">System Overview</p>
          <h2>Manage stores, users, and ratings from one workspace</h2>
        </div>
        <button className="primary" onClick={load}>{loading ? 'Refreshing...' : 'Refresh Data'}</button>
      </section>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'users', label: `Users (${users.length})` },
          { id: 'stores', label: `Stores (${stores.length})` },
          { id: 'create', label: 'Create' },
        ]}
      />

      {message && <p className="notice wide">{message}</p>}

      {activeTab === 'overview' && (
        <>
          <section className="stats">
            <Stat label="Users" value={dashboard.totalUsers} detail="All registered roles" />
            <Stat label="Stores" value={dashboard.totalStores} detail="Listed locations" />
            <Stat label="Ratings" value={dashboard.totalRatings} detail="Submitted reviews" />
          </section>
          <section className="grid two">
            <article className="panel">
              <div className="panel-title">
                <h2>User Mix</h2>
                <span>By account role</span>
              </div>
              <BarList items={roleCounts} />
            </article>
            <article className="panel">
              <div className="panel-title">
                <h2>Top Rated Stores</h2>
                <span>Average score</span>
              </div>
              <BarList items={topStores.length ? topStores : [{ label: 'No ratings yet', value: 0 }]} max={5} />
            </article>
          </section>
        </>
      )}

      {activeTab === 'users' && (
        <section className="panel">
          <div className="table-header">
            <div className="panel-title">
              <h2>Users</h2>
              <span>Search, filter, and sort accounts</span>
            </div>
            <div className="filters">
              <input placeholder="Search name, email, address" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
              <select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
          <Table
            headers={[
              <SortButton label="Name" column="name" sort={filters.userSort} onSort={sortUsers} />,
              <SortButton label="Email" column="email" sort={filters.userSort} onSort={sortUsers} />,
              <SortButton label="Address" column="address" sort={filters.userSort} onSort={sortUsers} />,
              <SortButton label="Role" column="role" sort={filters.userSort} onSort={sortUsers} />,
              'Owner Rating',
            ]}
          >
            {users.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.email}</td>
                <td>{item.address}</td>
                <td><span className={`pill ${item.role}`}>{roleLabel(item.role)}</span></td>
                <td>{formatRating(item.owner_store_rating)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      {activeTab === 'stores' && (
        <section className="panel">
          <div className="table-header">
            <div className="panel-title">
              <h2>Stores</h2>
              <span>Sortable store catalog</span>
            </div>
            <input placeholder="Search stores" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </div>
          <Table
            headers={[
              <SortButton label="Name" column="name" sort={filters.storeSort} onSort={sortStores} />,
              'Email',
              <SortButton label="Address" column="address" sort={filters.storeSort} onSort={sortStores} />,
              'Owner',
              <SortButton label="Rating" column="rating" sort={filters.storeSort} onSort={sortStores} />,
            ]}
          >
            {stores.map((store) => (
              <tr key={store.id}>
                <td>{store.name}</td>
                <td>{store.email || '-'}</td>
                <td>{store.address}</td>
                <td>{store.ownerName || '-'}</td>
                <td>
                  <div className="rating-cell">
                    <RatingDots rating={Math.round(store.average_rating || 0)} />
                    <span>{formatRating(store.average_rating)} ({store.rating_count})</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      {activeTab === 'create' && (
        <section className="grid two">
          <form className="panel stack" onSubmit={addUser}>
            <div className="panel-title">
              <h2>Add User</h2>
              <span>Create admin, owner, or normal user</span>
            </div>
            <Input label="Name" value={userForm.name} onChange={(name) => setUserForm({ ...userForm, name })} />
            <Input label="Email" value={userForm.email} onChange={(email) => setUserForm({ ...userForm, email })} />
            <Input label="Address" value={userForm.address} onChange={(address) => setUserForm({ ...userForm, address })} />
            <Input label="Password" type="password" value={userForm.password} onChange={(password) => setUserForm({ ...userForm, password })} />
            <Input as="select" label="Role" value={userForm.role} onChange={(role) => setUserForm({ ...userForm, role })}>
              <option value="user">Normal User</option>
              <option value="owner">Store Owner</option>
              <option value="admin">System Administrator</option>
            </Input>
            <button className="primary">Add User</button>
          </form>

          <form className="panel stack" onSubmit={addStore}>
            <div className="panel-title">
              <h2>Add Store</h2>
              <span>Assign store to an owner</span>
            </div>
            <Input label="Name" value={storeForm.name} onChange={(name) => setStoreForm({ ...storeForm, name })} />
            <Input label="Email" value={storeForm.email} onChange={(email) => setStoreForm({ ...storeForm, email })} />
            <Input label="Address" value={storeForm.address} onChange={(address) => setStoreForm({ ...storeForm, address })} />
            <Input as="select" label="Owner" value={storeForm.ownerId} onChange={(ownerId) => setStoreForm({ ...storeForm, ownerId })}>
              <option value="">Unassigned</option>
              {ownerOptions.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </Input>
            <button className="primary">Add Store</button>
          </form>
        </section>
      )}
    </div>
  );
}

function UserView() {
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState({ q: '', sortBy: 'name', order: 'asc', onlyRated: false });
  const [message, setMessage] = useState('');
  const [viewMode, setViewMode] = useState('cards');

  const visibleStores = useMemo(() => {
    return filters.onlyRated ? stores.filter((store) => store.myRating) : stores;
  }, [stores, filters.onlyRated]);
  const ratedCount = stores.filter((store) => store.myRating).length;
  const averageGiven = ratedCount
    ? stores.reduce((sum, store) => sum + Number(store.myRating || 0), 0) / ratedCount
    : 0;

  async function load() {
    const { data } = await api.get('/stores', {
      params: { q: filters.q, sortBy: filters.sortBy, order: filters.order },
    });
    setStores(data.stores);
  }

  useEffect(() => {
    load().catch(() => setMessage('Could not load stores.'));
  }, [filters.q, filters.sortBy, filters.order]);

  async function rate(storeId, rating) {
    try {
      await api.put(`/stores/${storeId}/rating`, { rating });
      setMessage('Rating saved.');
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Rating could not be saved.');
    }
  }

  return (
    <div className="workspace">
      <section className="stats">
        <Stat label="Stores Found" value={visibleStores.length} detail="Current filter result" />
        <Stat label="Rated By You" value={ratedCount} detail="Submitted ratings" />
        <Stat label="Your Average" value={formatRating(averageGiven)} detail="Across rated stores" />
      </section>

      <section className="panel">
        <div className="table-header">
          <div className="panel-title">
            <h2>Explore Stores</h2>
            <span>Search, sort, and rate live</span>
          </div>
          <div className="filters">
            <input placeholder="Search by name or address" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
            <select value={filters.sortBy} onChange={(event) => setFilters({ ...filters, sortBy: event.target.value })}>
              <option value="name">Name</option>
              <option value="address">Address</option>
              <option value="rating">Rating</option>
            </select>
            <button onClick={() => setFilters({ ...filters, order: filters.order === 'asc' ? 'desc' : 'asc' })}>
              {filters.order === 'asc' ? 'Ascending' : 'Descending'}
            </button>
            <button className={filters.onlyRated ? 'active-filter' : ''} onClick={() => setFilters({ ...filters, onlyRated: !filters.onlyRated })}>
              Rated Only
            </button>
            <button onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}>
              {viewMode === 'cards' ? 'Table View' : 'Card View'}
            </button>
          </div>
        </div>
        {message && <p className="notice">{message}</p>}
        {viewMode === 'cards' ? (
          <div className="store-list">
            {visibleStores.map((store) => (
              <article className="store-card" key={store.id}>
                <div>
                  <h3>{store.name}</h3>
                  <p>{store.address}</p>
                  <div className="rating-cell">
                    <RatingDots rating={Math.round(store.averageRating || 0)} />
                    <span>Overall: {formatRating(store.averageRating)} ({store.ratingCount})</span>
                  </div>
                </div>
                <div className="rating-panel">
                  <span>Your rating</span>
                  <div className="rating-buttons">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        className={Number(store.myRating) === rating ? 'selected' : ''}
                        onClick={() => rate(store.id, rating)}
                        title={`Rate ${rating}`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Table headers={['Store', 'Address', 'Overall', 'My Rating', 'Rate']}>
            {visibleStores.map((store) => (
              <tr key={store.id}>
                <td>{store.name}</td>
                <td>{store.address}</td>
                <td>{formatRating(store.averageRating)} ({store.ratingCount})</td>
                <td>{store.myRating || '-'}</td>
                <td>
                  <div className="rating-buttons">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button key={rating} className={Number(store.myRating) === rating ? 'selected' : ''} onClick={() => rate(store.id, rating)}>
                        {rating}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <PasswordPanel />
    </div>
  );
}

function OwnerView() {
  const [data, setData] = useState({ stores: [], ratings: [], averageRating: 0 });
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const ratingBreakdown = useMemo(() => {
    return [5, 4, 3, 2, 1].map((score) => ({
      label: `${score} star`,
      value: data.ratings.filter((item) => Number(item.rating) === score).length,
    }));
  }, [data.ratings]);

  async function load() {
    const response = await api.get('/owner/dashboard');
    setData(response.data);
  }

  useEffect(() => {
    load().catch(() => setMessage('Could not load owner dashboard.'));
  }, []);

  return (
    <div className="workspace">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Store Owner</p>
          <h2>Track your stores and customer ratings</h2>
        </div>
        <button className="primary" onClick={load}>Refresh Data</button>
      </section>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'ratings', label: `Ratings (${data.ratings.length})` },
          { id: 'settings', label: 'Settings' },
        ]}
      />

      {message && <p className="notice wide">{message}</p>}

      {activeTab === 'overview' && (
        <>
          <section className="stats">
            <Stat label="Average Rating" value={formatRating(data.averageRating)} detail="All owned stores" />
            <Stat label="Owned Stores" value={data.stores.length} detail="Assigned by admin" />
            <Stat label="Submitted Ratings" value={data.ratings.length} detail="Customer responses" />
          </section>
          <section className="grid two">
            <article className="panel">
              <div className="panel-title">
                <h2>My Stores</h2>
                <span>Average rating by location</span>
              </div>
              <BarList items={data.stores.map((store) => ({ label: store.name, value: Number(store.averageRating || 0) }))} max={5} />
            </article>
            <article className="panel">
              <div className="panel-title">
                <h2>Rating Breakdown</h2>
                <span>Submitted score counts</span>
              </div>
              <BarList items={ratingBreakdown} />
            </article>
          </section>
        </>
      )}

      {activeTab === 'ratings' && (
        <section className="panel">
          <div className="panel-title">
            <h2>Users Who Rated My Stores</h2>
            <span>Latest rating activity first</span>
          </div>
          <Table headers={['Store', 'User', 'Email', 'Address', 'Rating']}>
            {data.ratings.map((rating) => (
              <tr key={rating.id}>
                <td>{rating.storeName}</td>
                <td>{rating.userName}</td>
                <td>{rating.userEmail}</td>
                <td>{rating.userAddress}</td>
                <td>
                  <div className="rating-cell">
                    <RatingDots rating={rating.rating} />
                    <span>{rating.rating}</span>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      {activeTab === 'settings' && <PasswordPanel />}
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header, index) => <th key={typeof header === 'string' ? header : index}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
