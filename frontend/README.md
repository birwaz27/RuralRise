# RuralRise frontend

The React/Vite frontend connects to the API in `../backend`.

## Run locally

1. Start the backend from `../backend` with `npm run dev`.
2. In this directory, install dependencies with `npm install`.
3. Start the frontend with `npm run dev` and open <http://localhost:5173>.

The Vite development server proxies `/api` and `/health` to
`http://localhost:5000`. To use a deployed API instead, copy `.env.example` to
`.env` and set `VITE_API_URL` to the API base URL, including `/api`.

Login sessions are stored per tab, so signing in or out in one tab does not
change the session in another tab.

Scouts can register directly. Accounts using an organization domain are
verified automatically; other scouts can browse public athlete profiles in
read-only mode while organization verification is pending.

Run `npm run build` to type-check and create the production bundle in `dist`.
