# Enterprise Multi-Tenant SaaS Workspace Platform

A production-ready, highly secure, and optimized Multi-Tenant SaaS platform featuring robust tenant isolation, secure cookie-based session management with automatic token rotation, Role-Based Access Control (RBAC), real-time Socket.IO collaboration, file attachment managers, and a modern responsive dashboard UI.

---

## 🚀 Key Features

* **Logical Multi-Tenant Isolation:** Dynamic database row-level scoping via `tenantId` ensures that users cannot access any data belonging to other organizations.
* **Double-Cookie Authentication:** Session credentials reside in HTTP-only, secure, CSRF-hardened cookies. Access tokens rotate silently in the background using database-verified refresh token rotation.
* **Role-Based Access Control (RBAC):** Users hold one of three roles: `OWNER` (full org settings, billing, deletion), `ADMIN` (project and member management), or `MEMBER` (workspace contributor).
* **Interactive Projects & Tasks:** Nested tasks inside project workspaces supporting priorities (`LOW`, `MEDIUM`, `HIGH`), states (`TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`), and file upload attachments.
* **Attachment Manager:** Multer-backed local uploads storing images and files persistently, dynamically resolved across production environments.
* **Realtime Socket.IO Server:** Tenant-scoped socket rooms dispatching user presence updates and system notifications instantly.
* **Sleek Responsive Dashboard:** Glassmorphism UI styled with Tailwind CSS, utilizing Next.js dynamic routing, lazy-loaded components, loading state indicators, and mobile adaptability.

---

## 🛠 Tech Stack

* **Frontend:** React 19, Next.js 15 (App Router), Zustand (State Store), Tailwind CSS 4, Lucide React (Icons).
* **Backend:** Node.js, Express, TypeScript, Socket.IO, Multer, Express-rate-limit, Helmet.
* **ORM & Database:** Prisma ORM, PostgreSQL.
* **Tests & CI:** Custom TS integration suites for RBAC, Security, and WebSockets.

---

## 📂 Folder Structure

```markdown
MULTI-TENANT SaaS PLATEFORM/
├── backend/                  # Express REST and Socket.IO server
│   ├── prisma/               # Schema design and migrations
│   ├── src/
│   │   ├── config/           # Database connection, Socket, uploads, and Logger config
│   │   ├── controllers/      # Route request controllers
│   │   ├── middlewares/      # RBAC, Rate-limit, and Logging middlewares
│   │   ├── routes/           # REST API routes
│   │   ├── services/         # Core business logic handlers
│   │   └── server.ts         # Server entry point
│   └── tsconfig.json
├── frontend/                 # Next.js App Router client
│   ├── src/
│   │   ├── app/              # Router pages (dashboard, auth, landing)
│   │   ├── components/       # Core UI and layout sub-components
│   │   ├── lib/              # Client Axios and Socket.IO wrappers
│   │   └── store/            # Zustand authentication store
│   └── vercel.json
├── docs/                     # NEW: Final deliverables folder
│   ├── database_schema.md    # DB schema definitions & ER diagrams
│   ├── postman_collection.json # API endpoints collection JSON
│   ├── postman_api_documentation.md # API execution documentation
│   ├── project_report.md     # Production deployment project report
│   └── final_submission_checklist.md # Submission verification checklist
└── render.yaml               # Render Infrastructure-as-Code blueprint
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```bash
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require"
JWT_ACCESS_SECRET="your-hardened-access-token-secret"
JWT_REFRESH_SECRET="your-hardened-refresh-token-secret"
CORS_ORIGIN="https://your-frontend-vercel-app.vercel.app"
```

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL="https://your-backend-render-app.onrender.com/api"
NEXT_PUBLIC_BACKEND_URL="https://your-backend-render-app.onrender.com"
```

---

## 🔧 Installation & Local Setup

### Prerequisites
* Node.js v18+
* PostgreSQL database

### 1. Database Setup & Migrations
1. In your local PostgreSQL, create a database named `multi_tenant_saas`.
2. Configure `backend/.env` with your database credentials.
3. Apply migration schemas and seed client structures:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   ```

### 2. Launch Backend API
```bash
npm run dev
```
*API server will start on [http://localhost:5000](http://localhost:5000).*

### 3. Launch Frontend Client
```bash
cd ../frontend
npm install
npm run dev
```
*Client console will launch on [http://localhost:3000](http://localhost:3000).*

---

## 📡 API Endpoints SUMMARY

| Category | Endpoint | Method | Middleware | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/register` | `POST` | Rate-limited | Creates tenant & registers `OWNER` |
| **Auth** | `/api/auth/login` | `POST` | Rate-limited | Logs in user; issues access/refresh cookies |
| **Auth** | `/api/auth/logout` | `POST` | Authenticated | Clears credentials |
| **Auth** | `/api/auth/refresh` | `POST` | None | Silently rotates access cookies |
| **Auth** | `/api/auth/me` | `GET` | Authenticated | Fetches authenticated user info |
| **Members**| `/api/members` | `GET` | Authenticated | Lists tenant organization users |
| **Members**| `/api/members/invite` | `POST` | Owner/Admin | Invites a member into the tenant |
| **Members**| `/api/members/:id` | `DELETE`| Owner only | Removes user from tenant |
| **Members**| `/api/members/organization/delete` | `DELETE` | Owner only | Cascades deletes all tenant databases |
| **Projects**| `/api/projects` | `GET` | Authenticated | Lists tenant projects (scoped by member) |
| **Projects**| `/api/projects` | `POST` | Owner/Admin | Creates project |
| **Tasks** | `/api/tasks` | `POST` | Authenticated | Creates a task inside assigned project |
| **Uploads**| `/api/uploads/profile` | `POST` | Authenticated | Uploads profile image file |
| **Uploads**| `/api/uploads/attachment` | `POST`| Authenticated | Uploads attachment file to project/task |

---

## 🌐 Production Deployment Guide

Detailed blueprint deployments are configured for one-click setup:
* **Backend:** Deploy to Render using the [render.yaml](file:///c:/Users/Dipa%20Rani/Desktop/MULTI-TENANT%20SaaS%20PLATEFORM/render.yaml) specification which provisions the Web Service container, PostgreSQL database, and mounts a persistent disk for uploads.
* **Frontend:** Deploy Next.js to Vercel. Ensure `vercel.json` HTTP security headers are preserved. Set the environment variables pointing to your Render backend domain.

---

## 🔮 Future Improvements

1. **Stripe Billing Integration:** Implement plan subscription locks (e.g. Free vs Pro tier caps on member counts and file storage).
2. **Custom Domains:** Allow tenant administrators to map custom canonical hosts (e.g. `workspace.clientdomain.com`).
3. **Redis Caching:** Cache database configurations and session keys for fast authentication validation.
4. **Rich Text Task Comments:** Add interactive editing threads within task modals.
