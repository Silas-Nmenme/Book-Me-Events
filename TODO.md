# TODO - Fix Vercel Function 500 / FUNCTION_INVOCATION_FAILED

- [x] Verify Vercel routing target: changed `vercel.json` rewrite destination from `/index.js` to `/api/index.js`.

- [ ] Read Vercel Function/Serverless logs for the failing invocation and capture the exact error message/stack trace lines (look for `MongoDB Error:` or `MONGO_URI is missing...`).
- [ ] Confirm in Vercel Environment Variables that `MONGO_URI` is set for this project.
- [ ] Confirm in Vercel Environment Variables that `JWT_SECRET` is set (used by auth middleware for protected routes).
- [x] (Optional) Add explicit env presence logging to `src/config/db.js` to quickly confirm `MONGO_URI` existence in Vercel logs.

- [ ] After changes, redeploy and retest endpoint to ensure the crash is resolved.

