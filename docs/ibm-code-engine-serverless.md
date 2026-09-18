# IBM Code Engine serverless deployment

The backend runs as a stateless HTTP container on IBM Cloud Code Engine. Code Engine scales instances to zero and starts instances on demand. PostgreSQL/PostGIS remains an external managed service, such as Aiven. The frontend remains on Vercel.

## 1. Prepare IBM services

1. Create an IBM Cloud resource group and Code Engine project.
2. Create or use an Aiven PostgreSQL service with PostGIS enabled.
3. Download the Aiven CA certificate. Keep it in IBM Secrets Manager or a Code Engine secret; do not commit it.
4. Configure an SMTP provider for verification email delivery.

The API needs the variables in `backend/.env.ibm.example`. Use `CORS_ORIGINS` as a JSON array, for example:

```env
CORS_ORIGINS=["https://your-app.vercel.app"]
```

`COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` are required because the API and Vercel frontend are different sites.

## 2. Build the API image

The repository includes `backend/Dockerfile`. It installs GDAL/OGR, which is required for zipped Shapefile and GeoPackage uploads.

From the repository root:

```powershell
ibmcloud login
ibmcloud plugin install code-engine
ibmcloud ce project create --name communitysafe
ibmcloud ce project select --name communitysafe
ibmcloud ce registry create --name communitysafe-registry --location us-south
ibmcloud ce build create --name communitysafe-api --source backend --strategy dockerfile --size medium
ibmcloud ce buildrun submit --build communitysafe-api
```

Use an IBM Container Registry namespace/repository appropriate for the selected region. The exact registry command can vary by account plan; the resulting image must be available to the Code Engine project.

## 3. Store runtime secrets

Create a Code Engine secret from a private file based on `backend/.env.ibm.example`, excluding comments and replacing every placeholder:

```powershell
ibmcloud ce secret create --name communitysafe-api-secrets --from-env-file backend/.env.ibm
```

Store the Aiven CA certificate as a file secret and set `PGSSLROOTCERT` to its mounted path, for example `/run/secrets/aiven-ca.pem`. Do not put the CA contents in a GitHub Actions variable or frontend environment.

## 4. Deploy the serverless API

Deploy with one HTTP port and no local persistent storage:

```powershell
ibmcloud ce application create --name communitysafe-api --image icr.io/YOUR_NAMESPACE/communitysafe-api:latest --port 8080 --min-scale 0 --max-scale 10 --cpu 1 --memory 1G --env-from-secret communitysafe-api-secrets
```

Use `application update` for later image or secret changes. The API is stateless: uploaded feature data is stored in PostGIS, refresh sessions are stored in PostgreSQL, and no uploaded files are retained in the container filesystem.

## 5. Run migrations before traffic

Run migrations from an authorized runner using the same production secret values:

```powershell
alembic upgrade head
python scripts/verify_foundation.py
```

Then obtain the Code Engine HTTPS URL and verify:

```text
GET https://YOUR_API_URL/health
```

Expected response:

```json
{"status":"ok"}
```

## 6. Configure Vercel

Set the frontend project root to `frontend` and configure:

```env
NEXT_PUBLIC_API_URL=https://YOUR_API_URL
NEXT_PUBLIC_MAP_STYLE_URL=https://your-map-provider.example/style.json
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
NEXT_PUBLIC_WATSONX_INTEGRATION_ID=...
NEXT_PUBLIC_WATSONX_REGION=...
NEXT_PUBLIC_WATSONX_SERVICE_INSTANCE_ID=...
```

After the Vercel production domain is known, update the API secret's `CORS_ORIGINS` to only the expected Vercel and Code Engine origins, then redeploy the API.

## 7. Production checks

- `GET /health` succeeds over HTTPS.
- `alembic upgrade head` completed before traffic.
- PostGIS verification succeeds.
- SMTP verification email delivers a six-digit code.
- Signup/login/refresh/logout work across the Vercel/API domains.
- Admin upload accepts zipped Shapefiles and GeoPackages.
- Non-admin users cannot upload, remove layers, or view the admin user list.
- Code Engine is configured with min scale `0`, max scale appropriate for budget, and a health check.
- No `.env`, password, JWT secret, SMTP password, database URL, or CA certificate is committed.