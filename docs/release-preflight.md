# Release preflight

## Repository

1. Verify secrets are ignored: `git status --ignored` must not show a tracked `.env`, `.pem`, or `.vercel/` file.
2. Run backend checks from `backend/`:

   ```powershell
   uv run --python 3.13 --with-requirements requirements.txt --with pytest pytest tests -q
   uv run --python 3.13 --with-requirements requirements.txt python scripts\release_preflight.py
   ```

3. Run the frontend production build from `frontend/`:

   ```powershell
   npm ci
   npm run build
   ```

## Production ordering

1. Provision Aiven and add backend-host secrets from `backend/.env.production.example`.
2. Deploy the API to the selected compute host, run `alembic upgrade head`, then run `scripts/verify_foundation.py` and call `/health`.
3. Set the frontend production variables from `frontend/.env.production.example` in Vercel. The API URL must be the HTTPS production API URL.
4. Add the final Vercel production URL to `CORS_ORIGINS` on the API. Redeploy the API if it changes.
5. Deploy the Vercel frontend, perform a live sign-in, admin-upload, map, refresh-cookie, and Watsonx check.
6. Tag the verified commit and record the API deployment revision plus database migration revision.

## Account actions still required

- Re-authenticate the GitHub CLI or use the GitHub web UI to create/push the repository.
- Select either Google Cloud Run or IBM Cloud Code Engine for the API service and sign in to that provider.
- Import the GitHub repository into Vercel and set `frontend` as its root directory.
