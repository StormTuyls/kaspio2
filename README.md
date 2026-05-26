# Kaspio

Beheer al je inkomende geldstromen vanuit één bankrekening, met duidelijke virtuele potjes en
volledige transparantie voor elk teamlid.

## Status

Bèta-prototype:

- Frontend draait standalone op **localStorage**, gegevens blijven in je browser
- Postgres + Express backend ligt klaar onder `server/` met `docker-compose.yml`, maar de
  frontend is er nog **niet op gemigreerd**

## Frontend lokaal draaien

```bash
nvm use 20         # Vite vereist Node 20+
npm install
npm run dev
# open http://localhost:5173
```

## Backend (optioneel, ready-to-wire-up)

Dit start een Postgres-database en een Express API met het volledige datamodel:

```bash
# 1. Start de database
docker compose up -d

# 2. Configureer + start de API
cd server
cp .env.example .env
npm install
npm run dev
# API draait op http://localhost:3001
# Health check: curl http://localhost:3001/api/health
```

### Wat de backend al doet

- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, bcrypt + JWT
- `GET/POST /api/members`, `/api/pots`, `/api/transactions`
- `GET /api/audit`, gespiegelde audit log, automatisch gevuld bij mutaties
- `GET/PATCH /api/settings/notifications`

Wachtwoorden worden gehasht met bcrypt (cost 10), niet meer met SHA-256 zoals in de
localStorage-prototype-versie.

### Datamodel

Zie [`server/schema.sql`](server/schema.sql). Tabellen:

- `accounts`, login-credentials + organisatie
- `members`, admins en potjesbeheerders binnen een account
- `pots`, virtuele potjes met optioneel doelbedrag
- `transactions`, in/uit per potje
- `audit_log`, wie deed wat wanneer
- `notification_settings`, e-mail/digest voorkeuren per account

### Frontend migreren naar de backend

Niet (nog) gedaan om de scope behapbaar te houden. Migratiepad:

1. Vervang [`src/auth.ts`](src/auth.ts) met een API-client die JWT in localStorage zet
2. Vervang [`src/storage.ts`](src/storage.ts) met een fetch-gebaseerde hook
3. Voeg loading/error-states toe in views
4. Configureer `VITE_API_URL` of een Vite proxy naar `http://localhost:3001`

## Tech stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4
- **Backend**: Express 4 + node-postgres + bcryptjs + jsonwebtoken + zod
- **Database**: Postgres 16 (in Docker)

## Features

| Feature                    | Frontend (localStorage) | Backend (Postgres) |
| -------------------------- | ----------------------- | ------------------ |
| Signup / login             | ✅ (SHA-256)             | ✅ (bcrypt + JWT)  |
| Potjes + transacties       | ✅                       | ✅                 |
| Rolgebaseerd: admin/owner  | ✅                       | ✅ (data, geen middleware) |
| Audit log                  | ✅                       | ✅                 |
| Notificatie-instellingen   | ✅ (UI demo)             | ✅                 |
| CSV-export                 | ✅                       | n.v.t. |
| Saldo-grafiek              | ✅                       | n.v.t. |
| Dark mode                  | ✅                       | n.v.t. |
| Multi-admin                | ✅                       | ✅                 |
