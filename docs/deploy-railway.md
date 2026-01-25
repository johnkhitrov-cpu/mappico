# Deploy Mappico to Railway

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with Mappico code
- Cloudinary account with unsigned upload preset
- Mapbox account with public token

---

## Railway Settings (Exact Configuration)

### Build Command

```
npm run db:migrate:deploy && npm run build
```

This runs `prisma migrate deploy` then `next build`. The `prisma generate` is already included in the build script.

### Start Command

```
npm run start
```

### Watch Paths (optional)

Leave empty or set to default.

---

## Step-by-Step Setup

### 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Authorize Railway and select your `mappico` repository
4. Railway creates a Web Service automatically

### 2. Add PostgreSQL Plugin

1. In your project canvas, click **+ New**
2. Select **Database** → **Add PostgreSQL**
3. Click on the Postgres service → **Variables** tab
4. Copy the `DATABASE_URL` value (or use Railway's variable reference)

### 3. Link Database to Web Service

1. Click on your Web Service
2. Go to **Variables** tab
3. Click **Add Variable** → **Add Reference** → Select `DATABASE_URL` from Postgres
4. This links the database URL automatically

### 4. Set Environment Variables

In your Web Service → **Variables** tab, add these:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | *(Reference from Postgres plugin)* |
| `JWT_SECRET` | `your-secure-secret-min-32-chars` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.eyJ1Ijoi...` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | `your-cloud-name` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | `your-unsigned-preset` |

**Generate JWT_SECRET:**
```bash
openssl rand -base64 32
```

### 5. Configure Build Settings

1. Go to Web Service → **Settings** tab
2. Scroll to **Build & Deploy**
3. Set:
   - **Build Command**: `npm run db:migrate:deploy && npm run build`
   - **Start Command**: `npm run start`

### 6. Deploy

1. Click **Deploy** or push to your GitHub repo
2. Watch the build logs for any errors
3. Wait for deployment to complete (green checkmark)

---

## Cloudinary Unsigned Preset Setup

1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. Navigate to **Settings** → **Upload**
3. Scroll to **Upload presets** → Click **Add upload preset**
4. Configure:
   - **Preset name**: e.g., `mappico_unsigned`
   - **Signing Mode**: **Unsigned**
   - **Folder** (optional): `mappico`
5. Click **Save**
6. Use this preset name for `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`

---

## Post-Deploy Checklist

After deployment succeeds, verify these endpoints:

### 1. Health Check
```
GET https://your-app.railway.app/api/health
```
Expected: `{"ok":true,"db":"up"}`

### 2. Register New User
```
POST https://your-app.railway.app/api/auth/register
Content-Type: application/json

{"email":"test@example.com","password":"password123"}
```
Expected: `{"token":"eyJ..."}`

### 3. Login
```
POST https://your-app.railway.app/api/auth/login
Content-Type: application/json

{"email":"test@example.com","password":"password123"}
```
Expected: `{"token":"eyJ..."}`

### 4. Create Point (with token)
```
POST https://your-app.railway.app/api/points
Authorization: Bearer <token>
Content-Type: application/json

{"lat":55.75,"lng":37.62,"title":"Test Point"}
```
Expected: `{"point":{...}}`

### 5. UI Flow Test
1. Open `https://your-app.railway.app` in browser
2. Register/Login
3. Create a point with photo on the map
4. Refresh page → point persists
5. Delete point → disappears from map

---

## Common Railway Pitfalls

### Prisma Engine Binary Issues (Windows → Linux)

**Problem**: Prisma generates binaries for your dev machine (Windows). Railway runs Linux.

**Solution**: The `postinstall` script runs `prisma generate` on Railway, which generates Linux binaries. This is already configured in `package.json`.

### Missing DATABASE_URL

**Problem**: Build fails with "Environment variable not found: DATABASE_URL"

**Solution**: Ensure you've linked the Postgres plugin to your web service via variable reference, not copy-paste.

### Migrations Not Running

**Problem**: Tables don't exist, Prisma errors about missing relations.

**Solution**: Ensure build command is:
```
npm run db:migrate:deploy && npm run build
```

### NEXT_PUBLIC_ Variables Not Available

**Problem**: Mapbox/Cloudinary not working in browser.

**Solution**: `NEXT_PUBLIC_*` vars must be set **before** build. If you add them after, redeploy.

### Cold Starts / Hobby Plan Limits

**Problem**: App sleeps after inactivity, first request is slow.

**Solution**: This is normal on Railway's free/hobby tier. The `/api/health` endpoint helps wake it up.

### SSL/Database Connection Errors

**Problem**: `ECONNREFUSED` or SSL errors connecting to Postgres.

**Solution**: Railway's internal `DATABASE_URL` handles SSL automatically. Don't manually add `?sslmode=require` unless needed.

---

## Troubleshooting Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs

# Run command in Railway environment
railway run npx prisma migrate status
railway run npx prisma db push --force-reset  # DANGER: resets DB

# Open shell
railway shell
```

---

## Environment Variable Summary

| Variable | Required | Source |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Railway Postgres plugin |
| `JWT_SECRET` | Yes | Generate yourself |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox account |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary dashboard |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Yes | Cloudinary upload settings |
