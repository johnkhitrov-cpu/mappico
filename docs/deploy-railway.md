# Deploy Mappico to Railway

## Prerequisites

- Railway account (https://railway.app)
- Cloudinary account with unsigned upload preset configured
- Git repository with your code

## 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your Mappico repository
4. Railway will auto-detect Next.js and configure the build

## 2. Add PostgreSQL Database

1. In your Railway project, click **New** → **Database** → **Add PostgreSQL**
2. Railway will automatically provision a PostgreSQL instance
3. The `DATABASE_URL` will be auto-injected into your service

## 3. Configure Environment Variables

Go to your service → **Variables** tab and add:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-set by Railway Postgres plugin |
| `JWT_SECRET` | Random secret for JWT signing (min 32 chars). Generate with: `openssl rand -base64 32` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox public access token |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary unsigned upload preset name |

### Generate JWT_SECRET

```bash
openssl rand -base64 32
```

Or use any secure random string generator.

## 4. Configure Build & Start Commands

Railway should auto-detect these, but verify in **Settings**:

- **Build Command**: `npm run build`
- **Start Command**: `npm run start`

If using Prisma migrations, set:

- **Build Command**: `npx prisma migrate deploy && npm run build`

## 5. Run Database Migrations

For initial deployment or schema changes:

```bash
# Via Railway CLI
railway run npx prisma migrate deploy

# Or set as build command (recommended)
npx prisma migrate deploy && npm run build
```

## 6. Cloudinary Setup

### Create Unsigned Upload Preset

1. Go to Cloudinary Console → Settings → Upload
2. Click **Add upload preset**
3. Set **Signing Mode** to **Unsigned**
4. Configure folder (optional): `mappico`
5. Save and note the preset name

This preset name goes in `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.

## 7. Verify Deployment

After deployment completes:

1. Check health endpoint: `https://your-app.railway.app/api/health`
   - Should return: `{ "ok": true, "db": "up" }`
2. Test user registration and login
3. Test creating points with photos

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly
- Check `/api/health` returns `{ "ok": true, "db": "up" }`
- Run `railway logs` to see error details

### Migration Failures

```bash
# Check migration status
railway run npx prisma migrate status

# Reset if needed (CAUTION: data loss)
railway run npx prisma migrate reset --force
```

### Build Failures

- Ensure all dependencies are in `package.json`
- Check Node.js version compatibility
- Review build logs in Railway dashboard

## Custom Domain (Optional)

1. Go to service **Settings** → **Domains**
2. Click **Generate Domain** or **Add Custom Domain**
3. For custom domains, configure DNS as instructed
