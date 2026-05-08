# TODO - Fix Vercel Function 500 / FUNCTION_INVOCATION_FAILED

- [x] Verify Vercel routing target: changed `vercel.json` rewrite destination from `/index.js` to `/api/index.js`.

- [x] Read Vercel Function/Serverless logs and identify crash cause as DB env requirement during cold start. (Handled in code)
- [x] Confirm in code: `src/config/db.js` no longer throws when `MONGO_URI` is missing (returns `null`).
- [ ] Confirm in Vercel Environment Variables that `MONGO_URI` is set for this project.
- [ ] Confirm in Vercel Environment Variables that `JWT_SECRET` is set (used by auth middleware for protected routes).
- [x] (Optional) Add explicit env presence logging to `src/config/db.js` to quickly confirm `MONGO_URI` existence in Vercel logs.

- [ ] After changes, redeploy and retest endpoint to ensure the crash is resolved.

