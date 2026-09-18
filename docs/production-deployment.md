# CommunitySafe Production Deployment

This deployment uses:

```text
Vercel frontend
        |
        | HTTPS / CORS / secure cookies
        v
IBM Code Engine FastAPI API
        |
        v
Aiven PostgreSQL + PostGIS
```

The backend is deployed as a stateless serverless container on IBM Code Engine. Spatial data and refresh sessions are stored in PostgreSQL/PostGIS. The frontend is deployed separately to Vercel.

## 1. Provision production services

Create or configure:

- Aiven PostgreSQL with PostGIS enabled
- IBM Code Engine project
- SMTP provider for verification emails
- Vercel project for `frontend/`

Download the Aiven CA certificate and store it as a protected IBM secret/file. Never commit it.

## 2. Backend environment variables

Create a private file from `backend/.env.ibm.example`.

```env
DATABASE_URL=postgresql+psycopg://geoapp:DB_PASSWORD@AIVEN_HOST:AIVEN_PORT/geodb?sslmode=verify-full
PGSSLROOTCERT=/run/secrets/aiven-ca.pem
JWT_SECRET=GENERATED_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
CORS_ORIGINS=["https://your-app.vercel.app"]
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
UPLOAD_MAX_BYTES=52428800
COOKIE_SECURE=true
COOKIE_SAMESITE=none
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=mailer@your-domain.com
SMTP_PASSWORD=SMTP_PASSWORD
SMTP_FROM=CommunitySafe <mailer@your-domain.com>
PUBLIC_API_URL=https://your-api-codeengine-domain
PORT=8080
```

### Important settings

`DATABASE_URL` must use the Aiven host, production database `geodb`, application user `geoapp`, and `sslmode=verify-full`.

If the database password contains `@`, `:`, `/`, `#`, or spaces, URL-encode it.

Generate a production JWT secret locally:

```powershell
py -3 -c "import secrets; print(secrets.token_hex(32))"
```

Use a JSON array for CORS:

```env
CORS_ORIGINS=["https://your-app.vercel.app"]
```

Do not use `*` with credentialed cookies.

Because Vercel and IBM Code Engine are different sites, production cookies require:

```env
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

SMTP is required for six-digit email verification:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=mailer@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=CommunitySafe <mailer@example.com>
```

## 3. Store backend secrets in IBM Code Engine

Create a private local file named `backend/.env.ibm` using the real values. Do not commit it.

Create a Code Engine secret:

```powershell
ibmcloud ce secret create `
  --name communitysafe-api-secrets `
  --from-env-file backend/.env.ibm
```

Store the Aiven CA certificate separately as a mounted file secret. Set:

```env
PGSSLROOTCERT=/run/secrets/aiven-ca.pem
```

Do not put the CA certificate, SMTP password, database password, or JWT secret in Vercel variables.

## 4. Build the backend image

The repository includes `backend/Dockerfile`. It installs GDAL/OGR for zipped Shapefile and GeoPackage uploads.

From the repository root:

```powershell
ibmcloud login
ibmcloud plugin install code-engine
ibmcloud ce project create --name communitysafe
ibmcloud ce project select --name communitysafe
```

Create and run the Code Engine build:

```powershell
ibmcloud ce build create `
  --name communitysafe-api `
  --source backend `
  --strategy dockerfile `
  --size medium

ibmcloud ce buildrun submit --build communitysafe-api
```

Use the IBM Container Registry image generated for your account and region.

## 5. Deploy the serverless API

```powershell
ibmcloud ce application create `
  --name communitysafe-api `
  --image icr.io/YOUR_NAMESPACE/communitysafe-api:latest `
  --port 8080 `
  --min-scale 0 `
  --max-scale 10 `
  --cpu 1 `
  --memory 1G `
  --env-from-secret communitysafe-api-secrets
```

The application is stateless and should not depend on local container storage. Uploaded spatial data is stored in PostGIS.

## 6. Run database migrations

Run migrations from an authorized environment with the production variables loaded:

```powershell
cd backend
alembic upgrade head
python scripts/verify_foundation.py
```

Verify the API over HTTPS:

```text
GET https://YOUR_API_URL/health
```

Expected response:

```json
{"status":"ok"}
```

Run migrations before sending production traffic.

## 7. Configure Vercel

Import the repository into Vercel and set the root directory to:

```text
frontend
```

Add these Vercel production variables:

```env
NEXT_PUBLIC_API_URL=https://YOUR_API_URL
NEXT_PUBLIC_MAP_STYLE_URL=https://your-map-provider.example/style.json
NEXT_PUBLIC_ADMIN_EMAIL=admin@your-domain.com
NEXT_PUBLIC_WATSONX_INTEGRATION_ID=your-integration-id
NEXT_PUBLIC_WATSONX_REGION=your-region
NEXT_PUBLIC_WATSONX_SERVICE_INSTANCE_ID=your-service-instance-id
```

`NEXT_PUBLIC_*` values are visible in the browser. Do not place private credentials in them.

## 8. Update CORS after Vercel deployment

After the final Vercel domain is known, update the backend secret:

```env
CORS_ORIGINS=["https://your-final-vercel-domain.vercel.app"]
```

For a custom domain:

```env
CORS_ORIGINS=["https://communitysafe.example.com"]
```

Redeploy or restart the Code Engine application after changing CORS.

## 9. Production verification checklist

Verify:

- `GET /health` succeeds over HTTPS
- Alembic migrations completed
- PostgreSQL/PostGIS foundation check succeeds
- SMTP delivers a six-digit verification code
- Signup requires a unique username
- Email login works when username is not set
- Username/profile updates work
- Email verification works
- Members page respects email visibility
- Resources and map layers require authentication
- Admin Shapefile upload works
- GDAL/OGR is available in the runtime
- Non-admin users cannot upload or delete layers
- Refresh-token and logout flows work across Vercel and API domains
- Watson chat loads when configured
- `CORS_ORIGINS` contains only approved frontend origins
- No credentials or certificates are committed

## 10. Files that must remain private

Never commit:

```text
backend/.env
backend/.env.local
backend/.env.ibm
*.pem
pgpass.txt
txt/pguser.txt
txt/users.txt
```

Keep secrets in IBM Code Engine secrets, IBM Secrets Manager, Aiven configuration, or Vercel environment settings as appropriate.
