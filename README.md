# Children Book Specimen — Agent Challan Issue Details (React + Node)

A React + Express version of the app — **no native modules, no build tools required**
(no Python, no C++ compiler). This was rebuilt specifically to avoid the `better-sqlite3`
/ node-gyp install errors that come up on Windows machines without a compiler installed.

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** a plain JSON file on disk (via `lowdb`, pure JavaScript — no compilation)

## Setup (one-time)

You need [Node.js](https://nodejs.org) 18 or newer. Nothing else.

```bash
npm run install:all
```

This installs both the server and client dependencies.

## Running it

```bash
npm start
```

This builds the React app and starts the server, which serves everything on one port.
Open **http://localhost:3000** in your browser. That's it — one command, one URL.

To stop it, press `Ctrl+C` in the terminal.

### Developing (optional)

If you want to edit the React code and see changes live without rebuilding each time,
run these in two separate terminals:

```bash
# terminal 1
npm run dev:server      # API on http://localhost:3000

# terminal 2
npm run dev:client      # React dev server on http://localhost:5173, proxies /api to :3000
```

Then open **http://localhost:5173** while developing. Once you're happy with changes,
`npm start` from the root will rebuild the production version.

## How it's organized

```
server/
  db/
    index.js      — JSON database setup + seed data (book types, sample agents)
    data.json      — created automatically on first run (your actual data lives here)
  routes/
    meta.js         — regions / areas / agents / book-types endpoints
    challans.js       — CRUD for challans (outgoing) and returns (incoming/return)
    export.js           — generates the .xlsx export matching the original sheet
  server.js              — Express app entry point
client/
  src/
    App.jsx        — top controls (agent search, year, load, export)
    Grid.jsx         — the Excel-style data entry table + keyboard navigation
    NewAgentDialog.jsx — "+ New Agent" popup
    api.js               — small fetch helper
  vite.config.js          — dev proxy config
```

## Backing up your data

Your data lives in one file: `server/db/data.json`. Copy it somewhere safe periodically.
There's no database server to manage — it's just a text file.

## Using the app

1. Type an agent's name in **Agent Name & Area** — it autocompletes from existing agents.
   Not there yet? Click **+ New Agent**.
2. Pick a **Year**, click **Load Sheet**.
3. Click into any cell and type. **Tab** moves to the next field, **Enter** or **↓** moves
   down a row (a new blank row appears automatically at the bottom). Numeric fields only
   accept digits. Each field saves the moment you click/tab away — no save button needed.
4. Click **⬇ Export to Excel** any time to download a `.xlsx` in the original layout with
   working totals.

## Next modules

Same roadmap as before — School Master List, 3-Year Specimen & Order Detail, and Agent
Final Summary — all can be added as new tables in `data.json` plus new route files,
following the same pattern as `challans.js`.
