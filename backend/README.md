# VBStats backend

Minimal Express backend for VBStats. Connects to MySQL and exposes simple REST endpoints for teams, players and matches.

Quick start

1. Copy `.env.example` to `.env` and fill your database credentials (from Railway or your provider). Prefer using the public connection URL provided by Railway (paste the value of `MYSQL_PUBLIC_URL` from the project dashboard). Example options:

Using public URL (recommended for remote DBs):

```
MYSQL_PUBLIC_URL=mysql://root:your_password@host:port/railway
```

Or using individual variables (for local/private networks):

```
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=...
MYSQL_DATABASE=railway
```

2. Install dependencies

```bash
cd backend
npm install
```

3. Run

```bash
npm run dev    # needs nodemon
# or
npm start
```

Endpoints (JSON)

- `GET /api/teams` - list teams
- `POST /api/teams` - create team { name }
- `GET /api/teams/:id` - get team
- `PUT /api/teams/:id` - update team { name }
- `DELETE /api/teams/:id`

- `GET /api/players` - list players
- `POST /api/players` - create player { name, team_id, position }
- `GET /api/players/:id` - get player
- `PUT /api/players/:id` - update player
- `DELETE /api/players/:id`

- `GET /api/matches` - list matches
- `POST /api/matches` - create match { team_id, opponent, date, notes }

Notes

- The server will attempt to create minimal tables on start if not present.
- Do not commit real credentials to git — use `.env` and keep it out of version control.
