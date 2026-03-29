# Schedulr Deployment Guide

This guide covers everything you need to know about deploying your unified Next.js App Router application (located in the `calendly` directory). 

Since the Express backend has been migrated natively into Next.js API Routes, there is no need to deploy two separate servers. The single Next.js application handles both your React frontend and your backend PostgreSQL database logic.

## 1. Environment Variables Configuration

No matter where you deploy, your Next.js application requires the following environment variables to securely connect to the database and send emails. These must be added to your deployment host's settings (do not commit `.env.local` to GitHub!).

```env
# Database Connection (Neon Postgres)
DATABASE_URL=postgresql://neondb_owner:...

# Nodemailer Settings (Gmail SMTP App Passwords)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_16_character_app_password
SMTP_FROM=your_email@gmail.com

# Site Configuration
APP_URL=https://your-production-domain.com
NEXT_PUBLIC_API_URL=/api
```

---

## 2. Deploying to Vercel (Recommended)

Vercel is the creator of Next.js and natively supports serverless API routes without any extra configuration.

1. **Push your code to GitHub/GitLab:** Initialize a git repository and commit the unified Next.js `calendly` directory to your version control.
2. **Import into Vercel:** Log into [Vercel](https://vercel.com/dashboard) and click **"Add New Project"**. Import your repository. 
3. **Configure the Project:**
   - **Framework Preset:** Vercel will auto-detect "Next.js".
   - **Root Directory:** If your Next.js project is nested (e.g., inside the `calendly` folder), click 'Edit' and select that folder.
4. **Environment Variables:** Open the "Environment Variables" dropdown and paste in the complete list above.
5. **Deploy:** Click "Deploy". Vercel will install dependencies, build the project, and automatically hook your API routes (`app/api/`) up as Serverless Functions. Once finished, update your `APP_URL` variable to match your new `.vercel.app` domain.

---

## 3. Deploying via Docker (Self-Hosted / VPS)

If you are self-hosting on a platform like DigitalOcean, AWS EC2, Render, or a VPS, we have included a hyper-optimized `Dockerfile` inside the `calendly` folder. Next.js is pre-configured (`output: "standalone"`) to build a tiny Docker image.

### Building the Image
From inside the directory containing the `Dockerfile`:
```bash
docker build -t schedulr-app .
```

### Running the Container
Ensure your host machine exposes port 3000. Run the container while injecting your sensitive environment variables securely:

```bash
docker run -d \
  -p 3000:3000 \
  --name schedulr \
  -e DATABASE_URL="postgresql://neondb_owner:..." \
  -e SMTP_HOST="smtp.gmail.com" \
  -e SMTP_PORT="587" \
  -e EMAIL_USER="your_email@gmail.com" \
  -e EMAIL_PASS="your_password" \
  -e SMTP_FROM="your_email@gmail.com" \
  -e APP_URL="http://your-server-ip:3000" \
  -e NEXT_PUBLIC_API_URL="/api" \
  schedulr-app
```
