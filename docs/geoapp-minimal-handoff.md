# CommunitySafe — Minimal Build Spec

## Architecture

One public frontend, one API service, and one Aiven PostgreSQL/PostGIS service.

```text
Browser → Vercel (Next.js + MapLibre + Watsonx widget)
        → API (FastAPI + GDAL/OGR)
        → Aiven PostgreSQL + PostGIS
```

Not part of the MVP: Docker/Docker Compose, CircleCI, GeoServer, a tile server, Terraform, raw-file storage, and a separate conversion service.

## Stack

- Frontend: Next.js 14+, TypeScript, MapLibre GL JS; deploy on Vercel.
- API: FastAPI, Python 3.11+, SQLAlchemy/Alembic, GDAL/OGR; deploy on Cloud Run or IBM Code Engine.
- Data: Aiven for PostgreSQL with the PostGIS extension enabled.
- Auth: short-lived JWT access tokens plus rotating, opaque refresh sessions in secure httpOnly cookies.
- Chat: Watsonx Assistant web-chat script, loaded client-side.

## Repository

```text
geoapp/
├─ frontend/
│  ├─ app/{page,login,signup,admin}/
│  ├─ components/{map,admin,auth,chat}/
│  ├─ lib/{api-client,auth}.ts
│  └─ .env.local.example
├─ backend/
│  ├─ app/{api,core,db,schemas,services}/
│  ├─ alembic/ tests/
│  ├─ requirements.txt
│  └─ .env.example
├─ AGENTS.md
├─ README.md
└─ .gitignore
```

Do not add `Dockerfile`, `docker-compose.yml`, or `.circleci/`.

## Data and API contract

Enable `postgis` (and `pgcrypto` if UUID defaults use `gen_random_uuid()`) during initial Aiven setup. Alembic owns every subsequent schema change.

- `users`: UUID, unique email, bcrypt password hash, role (`admin` or `viewer`), created time.
- `layers`: UUID, display name, generated physical table name, geometry type, SRID (4326 default), MapLibre style JSON, uploader, created time.
- Uploaded tables use generated names such as `layer_<short_uuid>`; never derive identifiers from filenames.

| Endpoint | Access | Purpose |
|---|---|---|
| `POST /auth/signup` | Public | Create viewer account |
| `POST /auth/login` | Public | Return access token and set refresh cookie |
| `POST /auth/refresh` | Refresh cookie | Rotate session and issue access token |
| `GET /layers` | Public or authenticated (choose once) | List metadata and styles |
| `POST /admin/layers` | Admin | Validate and ingest GeoJSON, GeoPackage, or zipped Shapefile |
| `DELETE /admin/layers/{id}` | Admin | Drop generated table and remove metadata |
| `GET /features/{layer_id}?bbox=` | Public or authenticated (same policy) | Return a bounded GeoJSON FeatureCollection |

## Aiven integration

Provision an Aiven PostgreSQL service with PostGIS enabled in a region close to the API deployment. Create an application database and least-privilege role. Put the Aiven CA certificate and database connection settings in the API host's secret manager.

```env
# backend/.env.example — values are placeholders only
DATABASE_URL=postgresql+psycopg://geoapp:CHANGE_ME@HOST:PORT/geoapp?sslmode=verify-full
PGSSLROOTCERT=/run/secrets/aiven-ca.pem
JWT_SECRET=CHANGE_ME
ACCESS_TOKEN_EXPIRE_MINUTES=15
CORS_ORIGINS=https://your-app.vercel.app
```

Use Aiven's current connection details exactly as supplied. Apply `alembic upgrade head` from an authorized release job or an operator machine that can reach the service. Limit database network access to the API runtime; the browser never connects to Aiven.

## Deployment and build

- Vercel: set `frontend/` as root; configure `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAP_STYLE_URL`, and `NEXT_PUBLIC_WATSONX_INTEGRATION_ID`. Git integration builds previews and production automatically.
- API host: deploy `backend/` from source, using a native buildpack/build service. The runtime image must include GDAL/OGR libraries. Configure `DATABASE_URL`, `PGSSLROOTCERT`, `JWT_SECRET`, and `CORS_ORIGINS` as secrets/configuration.
- Validation is provider-native and pull-request based: run backend formatting/lint/type/tests and frontend lint/type/tests before merge. No separate CI provider is required for the MVP.

## Codex delivery workflow

For every phase: create a focused task → inspect the relevant code and conventions → write/adjust tests and contracts → implement the smallest change → run focused checks, then full affected checks → request a diff review → merge only when review findings are resolved. Keep migrations additive and review secrets/configuration changes manually.

1. **Foundation** — Scaffold both apps, Alembic, Aiven TLS connectivity, `/health`; verify migration against a non-production Aiven database.
2. **Identity** — Implement signup/login/refresh, role guard, CORS and cookie policy; test successful and rejected access paths.
3. **Layer ingestion** — Add upload validation, temporary-file handling, `ogr2ogr` conversion, metadata registration, delete cleanup; test malformed and unauthorized uploads.
4. **Map viewing** — Build MapLibre initialization, layer list/toggle, bbox-limited GeoJSON loading, and stored style application; mock API rendering and manually smoke-test map behavior.
5. **Watsonx chat** — Add guarded client-side widget bootstrap; verify it does not load without a public integration ID.
6. **Release** — Configure Vercel and the API host, set secrets, run migration, test a real upload and map render, then record rollback steps.

## Completion criteria

The production path is browser → API → Aiven only; admin uploads are validated before GDAL; all write routes require admin authorization; all schema changes ship as new Alembic migrations; no credentials enter git or client bundles.
