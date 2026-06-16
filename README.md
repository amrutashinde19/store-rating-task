# Store Rating Fullstack App

React + Express implementation of the FullStack Intern Coding Challenge store-rating platform.

## Features

- Single login/signup flow with JWT authentication.
- Roles: System Administrator, Normal User, Store Owner.
- SQLite database persisted at `backend/store-rating.sqlite`.
- Admin dashboard with total users, stores, ratings.
- Admin can add users and stores, search/filter/sort users and stores.
- Normal users can search stores and submit or update 1-5 ratings.
- Store owners can view ratings submitted for their stores and average rating.
- Password update with challenge validation rules.

## Seeded Accounts

All passwords satisfy the challenge rule: 8-16 chars, at least one uppercase letter, and one special character.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@store.test` | `Admin@123` |
| Store Owner | `owner@store.test` | `Owner@123` |
| Normal User | `user@store.test` | `User@123` |

## Run

If npm scripts fail on this Windows machine because `ComSpec` points to `C:\MinGW\bin`, run commands from PowerShell after setting:

```powershell
$env:ComSpec='C:\Windows\System32\cmd.exe'
```

Backend:

```powershell
cd backend
npm install
npm start
```

Frontend:

```powershell
cd frontend
npm install
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.
