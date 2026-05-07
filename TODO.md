# TODO - Vercel crash fix

- [x] Inspect current entrypoints (`server.js`, `app.js`) and DB connection behavior
- [x] Add Vercel config (`vercel.json`)
- [x] Create Vercel serverless entry (`api/index.js`)
- [x] Create request handler adapter (`api/handler.js`) to avoid `app.listen()`
- [x] Make Mongo connection serverless-safe by removing `process.exit(1)`
- [x] Ensure `package.json` uses a proper Vercel output/build workflow (if needed)

- [ ] Deploy to Vercel and verify endpoint `/` (or `/api/...`) does not crash
- [ ] If crash persists, inspect Vercel function logs and adjust DB/env handling

