# GitHub and Vercel production runbook

This runbook deploys the future `frontend/` app to Vercel. The FastAPI service is **not** deployed to Vercel: deploy it to Cloud Run or IBM Code Engine first, then configure the Vercel app with that API URL.

## 1. Prepare production services

1. Create an Aiven PostgreSQL service, enable `postgis`, create an application database/user, and download the Aiven project CA certificate.
2. Deploy `backend/` to Cloud Run or Code Engine from source. Its build environment must install GDAL/OGR. Set `DATABASE_URL` with `sslmode=verify-full`, provide the CA certificate at `PGSSLROOTCERT`, generate a 32-byte-or-longer `JWT_SECRET`, and set `COOKIE_SECURE=true` plus `COOKIE_SAMESITE=none`. The latter is required because the Vercel app and API are different sites.
3. Run `alembic upgrade head` once against production from an authorized runner, then run `python scripts/verify_foundation.py`. Verify `GET /health` over HTTPS.
4. Set the API's `CORS_ORIGINS` to the final Vercel production URL, including `https://` and no trailing slash.

Do not store the Aiven URL, CA certificate, or JWT secret in GitHub or Vercel. They belong only in the API host's secret manager.

## 2. Create and push the GitHub repository

From the repository root, initialize and publish only after confirming `.env` files and certificate files are ignored:

```powershell
git init
git add .
git commit -m "feat: add GeoApp API foundation"
git branch -M main
git remote add origin https://github.com/OWNER/geoapp.git
git push -u origin main
```

Create feature branches and pull requests. Protect `main` in GitHub: require pull-request review and passing checks before merge.

## 3. Import the frontend into Vercel

1. In Vercel, choose **Add New → Project**, authorize GitHub, and select `OWNER/geoapp`.
2. Set the root directory to `frontend` (do not select `backend`). Confirm Next.js is detected.
3. Add these production variables:

```text
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_MAP_STYLE_URL=https://your-map-style.example/style.json
NEXT_PUBLIC_WATSONX_INTEGRATION_ID=your-public-integration-id
NEXT_PUBLIC_WATSONX_REGION=your-watsonx-region
NEXT_PUBLIC_WATSONX_SERVICE_INSTANCE_ID=your-service-instance-id
```

4. Deploy once. In Vercel, attach the custom domain and update `CORS_ORIGINS` on the API to that domain if it changed.
5. Test signup/login, an authenticated admin upload, map loading, refresh-token behavior, and the Watsonx widget in the production domain.

Every non-`main` branch and pull request produces a Vercel Preview deployment. Merge the approved pull request into `main` to create the production deployment. Treat preview API URLs as a separate CORS/environment configuration; do not open production CORS to arbitrary origins.

## 4. Release checklist

- API `/health` is HTTPS-only and succeeds.
- The Aiven connection uses certificate verification (`verify-full`).
- Database migrations completed before the app receives traffic.
- Production Vercel variables point to the production API, not a preview URL.
- `CORS_ORIGINS` contains only expected production/preview frontend origins.
- A non-admin cannot call `/admin/layers`.
- Watsonx Web chat loads once when all three public Watsonx integration settings are present.
- No `.env`, certificate, database URL, or JWT secret appears in Git history.

For a manual fallback deploy, run `vercel deploy --prod` from `frontend/` after linking the project. Vercel's Git integration normally makes this unnecessary.
