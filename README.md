# GeoApp

Cloud-hosted map data viewer. The API uses FastAPI and Aiven PostgreSQL/PostGIS; the web application deploys separately to Vercel.

## Backend setup

1. Install Python 3.11+ and create a virtual environment.
2. Install `backend/requirements.txt`.
3. Copy `backend/.env.example` to `backend/.env`, fill in the non-production Aiven connection details and CA path.
4. From `backend/`, run `alembic upgrade head`, then `python scripts/verify_foundation.py`.
5. Start the API with `uvicorn app.main:app --reload`.

## Frontend setup

1. Install Node 20+.
2. Copy `frontend/.env.local.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL`.
3. From `frontend/`, run `npm install` then `npm run dev`.

For Watsonx Assistant, copy the `integrationID`, `region`, and `serviceInstanceID` from the generated Web chat embed configuration into the corresponding `NEXT_PUBLIC_WATSONX_*` variables. These values are public integration identifiers, not API credentials. If a Content Security Policy is added later, allow `*.watson.appdomain.cloud` for the widget script and connections.

Run `pytest` from `backend/` for the focused unit tests. The production API runtime must include `ogr2ogr` for GeoPackage and zipped Shapefile uploads; GeoJSON uploads need no GDAL executable.

See [the production runbook](docs/github-vercel-production.md) before deployment.
Run [the release preflight](docs/release-preflight.md) before the first production release.
