# Production Deployment Guide: Multi-Tenant SaaS Platform

This guide provides step-by-step instructions for deploying the Multi-Tenant SaaS Platform to production. The backend and PostgreSQL database will be deployed to **Render**, and the Next.js frontend will be deployed to **Vercel**.

---

## 📋 Environment Variables Checklist

### 1. Backend Environment Variables (Render)
These environment variables must be configured in your Render Web Service.

| Environment Variable | Description | Required/Optional | Production Value / Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Tells Express/Prisma that the app is running in production. | **Required** | `production` |
| `DATABASE_URL` | Connection string for the production PostgreSQL database. | **Required** | Generated automatically by Render when using Render Blueprint, or pasted manually (e.g., `postgresql://...`). |
| `JWT_ACCESS_SECRET` | Secret key used to sign access tokens. | **Required** | A long, secure random string (e.g., generated automatically by Render, or a 32-character string). |
| `JWT_REFRESH_SECRET`| Secret key used to sign refresh tokens. | **Required** | A long, secure random string (e.g., generated automatically by Render, or a 32-character string). |
| `CORS_ORIGIN` | The URL of the deployed Next.js frontend on Vercel. | **Required** | The Vercel deployment URL (e.g., `https://your-app-name.vercel.app`). Do not add a trailing slash. |
| `PORT` | The port the Express server listens on. | Optional | `5000` (Render handles internal port binding automatically). |

---

### 2. Frontend Environment Variables (Vercel)
These environment variables must be configured in your Vercel project.

| Environment Variable | Description | Required/Optional | Production Value / Example |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | The URL of the backend REST API. | **Required** | The Render Web Service URL with `/api` path appended (e.g., `https://your-backend-name.onrender.com/api`). No trailing slash. |
| `NEXT_PUBLIC_BACKEND_URL` | The base URL of the backend server (used for Socket.IO and uploaded media). | **Required** | The Render Web Service base URL (e.g., `https://your-backend-name.onrender.com`). No trailing slash. |

---

## 🔍 Architecture & Production Configuration Verification

### 1. Prisma & PostgreSQL Configuration
* **Database Provider:** The project uses PostgreSQL (`provider = "postgresql"` in schema.prisma).
* **Connection Pooling:** Render PostgreSQL supports connection pooling. If you configure connection pooling, update `DATABASE_URL` to point to the pooled port (typically port `6543` for pgBouncer) and append `?pgbouncer=true`. For typical free/hobby tiers, the standard connection string is used directly.
* **Database Migrations:** Migrations are automatically run in production using `prisma migrate deploy` as part of the startup command in `render.yaml`. This ensures all tables, relations, and indexes are updated without wiping existing data.
* **Optimized Database Indexes:** Mapped database indexes (`@@index`) are explicitly defined on all foreign keys and search fields (such as `tenantId`, `userId`, `projectId`, `taskId`, and `Notification.read`) to ensure extremely fast queries under SaaS workload.

### 2. Cross-Site Production Cookies
* **SameSite & Secure Flags:** In production, the backend automatically detects `process.env.NODE_ENV === 'production'` and adjusts cookie flags in `authController.ts`:
  - `secure: true` (ensures cookies are only sent over HTTPS).
  - `sameSite: 'none'` (allows cross-site requests so the Vercel frontend can receive and send cookies to the Render backend).
* **Credentials Support:** Axios is configured with `withCredentials: true` in `axios.ts` to send session cookies automatically with every request.

### 3. Socket.IO Production Handshake
* **Dynamic CORS:** The Socket.IO server in `socket.ts` is configured to read origins dynamically from `CORS_ORIGIN`, allowing the Vercel frontend to establish WebSocket connections securely.
* **Cookie Handshake:** Since Socket.IO uses `withCredentials: true` on the client, the browser automatically transmits the `access_token` cookie during the HTTP handshake request. The backend parses this cookie on line 40 of `socket.ts` using the `cookie` library's `parseCookie` utility and verifies the token prior to admitting the socket connection.

---

## 🚀 Step-by-Step Deployment Guide

### PART 1: Deploy Backend & Database on Render

There are two ways to deploy on Render:
* **Option A (Recommended): One-Click Blueprint Deployment** (processes the root `render.yaml` automatically).
* **Option B: Manual Deployment** (deploying the database and web service individually).

#### Option A: One-Click Blueprint Deployment (Recommended)
1. Commit all your changes and push them to your GitHub repository:
   ```bash
   git add .
   git commit -m "chore: prepare for production deployment"
   git push origin master
   ```
2. Log in to your account at [Render Dashboard](https://dashboard.render.com).
3. Click on the **New** button in the top right and select **Blueprint**.
4. Connect your GitHub account and select your repository: `diparani925-creator/READY-NEST-INTERNSHIP-WEEK-5`.
5. Render will automatically read the `render.yaml` file from your root directory and display the service list.
6. Enter a name for the Blueprint Group (e.g., `multi-tenant-saas`).
7. In the configuration fields, Render will ask you to supply any missing variables:
   - `CORS_ORIGIN`: Enter your Vercel deployment URL (e.g., `https://your-app-name.vercel.app`).
   - *Note: `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` will be generated automatically for you because of `generateValue: true` in the blueprint configuration. `DATABASE_URL` is also automatically wired.*
8. > [!IMPORTANT]
   > **Render Free Plan Persistent Disk Warning**: 
   > Render Free web services **do not support persistent disks**. If you want to deploy on the **Free tier**, you must edit `render.yaml` first, delete the `disk` section under the web service block, and then click Deploy. Uploaded media files will work, but they will be lost when the web service scales down or restarts. If you keep the `disk` section, you must upgrade the service plan to **Starter**.
9. Click **Apply**. Render will start provisioning your PostgreSQL database and compiling your Express backend.

#### Option B: Manual Deployment (Alternative)
If you prefer not to use Render Blueprints, deploy manually:
1. **Create PostgreSQL Database:**
   - On the Render dashboard, click **New** -> **PostgreSQL**.
   - **Name:** `multi-tenant-saas-db`
   - **Database Name:** `multi_tenant_saas`
   - **User:** `postgres`
   - **Plan:** `Free`
   - Click **Create Database**. Wait for it to become active, then copy the **Internal Connection String** (or External Connection String if you need to access it outside Render).
2. **Create Web Service:**
   - Click **New** -> **Web Service**.
   - Select your repository.
   - **Name:** `multi-tenant-saas-backend`
   - **Root Directory:** (Leave empty, we will use the command prefix)
   - **Environment:** `Node`
   - **Plan:** `Free`
   - **Build Command:** `cd backend && npm install && npm run prisma:generate && npm run build`
   - **Start Command:** `cd backend && npm run prisma:deploy && npm run start`
   - **Advanced Settings -> Environment Variables:** Add the following keys:
     - `NODE_ENV` = `production`
     - `DATABASE_URL` = *(Paste the PostgreSQL connection string you copied)*
     - `JWT_ACCESS_SECRET` = *(Generate a secure random string)*
     - `JWT_REFRESH_SECRET` = *(Generate another secure random string)*
     - `CORS_ORIGIN` = *(Your Vercel frontend URL, e.g., `https://your-app-name.vercel.app`)*
     - `PORT` = `5000`
   - Click **Create Web Service**.

---

### PART 2: Deploy Frontend on Vercel

1. Log in to your account at [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Select your GitHub repository: `diparani925-creator/READY-NEST-INTERNSHIP-WEEK-5`.
4. Configure the Project settings:
   - **Framework Preset:** Select **Next.js**.
   - **Root Directory:** Select `frontend`. Click **Edit** next to Root Directory, select `frontend`, and click **Continue**.
   - **Build and Development Settings:** Keep default.
5. **Environment Variables:** Expand this section and enter:
   - **Key:** `NEXT_PUBLIC_API_URL` 
   - **Value:** The URL of your Render backend with `/api` appended (e.g., `https://multi-tenant-saas-backend.onrender.com/api`).
   - **Key:** `NEXT_PUBLIC_BACKEND_URL`
   - **Value:** The base URL of your Render backend (e.g., `https://multi-tenant-saas-backend.onrender.com`).
6. Click **Deploy**. Vercel will install dependencies, build the Next.js production bundle, and publish your site.
7. Once deployment finishes, copy the assigned domain URL (e.g., `https://ready-nest-week-5.vercel.app`).
8. > [!IMPORTANT]
   > Go back to your **Render Dashboard** -> **Web Service** -> **Environment Variables**, and update the `CORS_ORIGIN` environment variable to match your actual Vercel domain URL. Redeploy the Render service to apply the updated origin permissions.

---

## 🏁 Post-Deployment Verification Checklist

Once both platforms are deployed, verify the live system using this step-by-step verification checklist:

- [ ] **1. Health Check Endpoint**
  - Open your browser and navigate to `https://your-backend-url.onrender.com/health`.
  - Verify it returns `{"status":"ok", "timestamp":"..."}` with status code `200`.

- [ ] **2. Register Tenant (Owner Setup)**
  - Open your Vercel frontend URL.
  - Click **Register** or go to `/register`.
  - Enter details for organization creation (e.g., Organization Name: `Production Corp`, Slug: `prod-corp`, Email: `owner@prodcorp.com`, Password: `Password123!`).
  - Verify that registration succeeds, the dashboard loads, and the browser receives the `access_token` and `refresh_token` cookies.

- [ ] **3. Cookie Security Verification**
  - Right-click on the dashboard page, select **Inspect**, and open the **Application** (or **Storage**) tab.
  - Under **Cookies**, select your backend domain.
  - Verify that both `access_token` and `refresh_token` cookies are set, and their properties show:
    - **HttpOnly:** Yes (Checked/True)
    - **Secure:** Yes (Checked/True)
    - **SameSite:** `None`

- [ ] **4. Member Invitation & Tenant Isolation**
  - Logged in as the Owner on the dashboard, navigate to the **Members** section.
  - Invite a new user with email `admin@prodcorp.com` and role `ADMIN`.
  - Open an Incognito Window (or another browser) and go to your Vercel app.
  - Log in with `admin@prodcorp.com` and verify the user is successfully added to the same organization.
  - Register another tenant (e.g., `Competitor LLC`) in a separate browser session. Verify that members and projects of `Production Corp` are completely hidden from `Competitor LLC` (verified tenant fencing).

- [ ] **5. Project and Task Management**
  - Create a new project named `Launch Initiative`.
  - Create a task within the project named `Setup DNS and CDN` and assign it to the Admin user.
  - Verify the task is listed under the project and status columns update smoothly drag-and-drop or select.

- [ ] **6. Real-Time Socket.IO Connections**
  - Open the dashboard in two separate browser windows logged in as different users of the same tenant (e.g., Owner and Admin).
  - Verify that the **Online Presence** indicator panel shows both users online in real time.
  - Log out one user and verify the online presence indicator updates immediately on the other user's screen.

- [ ] **7. Live Notifications Dispatch**
  - As the Owner, create a task and assign it to the Admin.
  - Look at the Admin's screen. A real-time notification badge and list item (e.g., *"Task '...' has been assigned to you"*) should appear instantly without reloading the page.

- [ ] **8. File Upload & Persistence**
  - Navigate to the **Profile Settings** and upload an avatar image, or attach a document (e.g., PDF or PNG) to a task.
  - Verify the file is uploaded, the thumbnail or download link appears, and clicking the link opens/downloads the file correctly from the server.

- [ ] **9. Silent Token Refresh**
  - Keep the application open for more than 15 minutes (or manually change the access token's cookie expiration in your browser console to test early).
  - Perform an action like switching pages or adding a task.
  - Open the browser's **Network** tab. Verify that the client intercepted the expired session, performed a background `POST /api/auth/refresh` request, obtained a new `access_token` cookie, and completed the original action successfully without logging you out.

- [ ] **10. Strict Cascade Deletion**
  - Logged in as the Owner, go to **Settings** -> **Danger Zone**.
  - Click **Delete Organization**.
  - Log in as the Admin or try to view previous projects. Verify that the account is deleted and all resources (users, tokens, projects, tasks, attachments, logs) are cascades-purged from the database.
