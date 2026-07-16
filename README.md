# Enterprise Multi-Tenant SaaS Workspace Platform

A production-ready, highly secure, and optimized Multi-Tenant Software-as-a-Service (SaaS) platform. The application features robust row-level tenant isolation, secure cross-site cookie-based authentication with silent session refresh, Role-Based Access Control (RBAC), real-time Socket.IO collaboration, persistent file attachment management, security hardening (rate limiters, security headers, XSS sanitization), and a modern responsive dashboard UI.

---

## 📖 Project Overview
This platform serves as a modern, multi-tenant workspace solution designed for businesses to manage projects, tasks, members, and activities in complete isolation. Built using a decoupled **Express.js (TypeScript) Backend API** and a **Next.js 15 App Router Frontend**, the application leverages a single shared database instance with logical data partitioning. 

Data privacy is strictly enforced at the query level using Prisma ORM. Authentication is secured using a **double-cookie method** (separating short-lived access tokens from long-lived database-backed refresh tokens in HTTP-only cookies) supporting silent background token rotation. Real-time updates (notifications, online presence) are driven by **Socket.IO** rooms fenced by tenant ID.

---

## 🚀 Key Features

* **Logical Multi-Tenant Isolation:** All database tables map back to a root `Tenant` organization. Every service handler scopes transactions using `{ tenantId }`, ensuring no cross-organization data leakage.
* **Double-Cookie JWT Authentication:** Access credentials reside in separate HTTP-only, Secure, CSRF-hardened cookies. Access tokens have a 15-minute lifetime and are silently rotated by the frontend via Axios response interceptors calling the refresh route.
* **Role-Based Access Control (RBAC):** Users hold one of three roles: `OWNER` (full org control, cascading delete), `ADMIN` (manage projects, tasks, members), or `MEMBER` (workspace contributor). Mid-route guards block unauthorized action execution.
* **Project & Task Fencing:** Projects are scoped to their assigned members. `MEMBER` users can only view projects they are assigned to, and only view/edit tasks assigned to them or created by them.
* **Socket.IO Workspace Collaboration:** Dynamic socket rooms verify the visitor's `access_token` cookie during the handshake, admit them to `tenant:{tenantId}`, and broadcast presence rosters and notifications in real time.
* **Robust File Attachment Manager:** Handles profile images and task attachments using Multer disk storage, checking file size and MIME-types. Includes cascading cleanups of files from disk on deletions.
* **Security Hardening:** Enforces strict API rate limits (auth-specific and general), input sanitization against XSS, and security headers via Helmet (e.g., Cross-Origin Resource Policy rules to serve uploaded assets).

---

## 🛠 Tech Stack

* **Frontend:** React 19, Next.js 15 (App Router, Turbopack), Zustand (State Store), Tailwind CSS 4, Axios (Client Requests), Socket.IO-Client (Real-time).
* **Backend:** Node.js, Express, TypeScript, Socket.IO, Multer (File uploads), cookie-parser, bcryptjs, jsonwebtoken, Express-rate-limit, Helmet.
* **ORM & Database:** Prisma ORM, PostgreSQL (relational database).
* **Testing:** Custom TS integration suites for WebSockets, RBAC, and Security validation.

---

## 📂 Folder Structure

```markdown
MULTI-TENANT SaaS PLATEFORM/
├── backend/                  # Express REST and Socket.IO server
│   ├── prisma/               # Database schema design, migrations, and seeds
│   │   ├── migrations/       # Version-controlled schema migrations
│   │   └── schema.prisma     # Prisma schema defining entities and indexes
│   ├── src/
│   │   ├── config/           # Database connections, Socket, uploads, and Logger config
│   │   ├── controllers/      # Route request controllers
│   │   ├── middlewares/      # RBAC guards, Rate-limiters, Logging, and XSS sanitizers
│   │   ├── routes/           # REST API endpoint routes
│   │   ├── services/         # Core business logic handlers
│   │   ├── types/            # TypeScript type declaration overrides
│   │   └── server.ts         # Express server entry point
│   └── tsconfig.json         # TS compiler configurations
├── frontend/                 # Next.js App Router client
│   ├── src/
│   │   ├── app/              # Routing pages (dashboard, auth pages, landing)
│   │   ├── components/       # Core UI, layout, and modal components
│   │   ├── lib/              # Client-side Axios and Socket.IO connection clients
│   │   └── store/            # Zustand authentication store
│   ├── vercel.json           # Vercel security headers configuration
│   └── tsconfig.json         # TS compiler configurations
├── docs/                     # Deliverables and specifications
│   ├── database_schema.md    # DB schema definitions & ER diagrams
│   ├── postman_collection.json # API endpoints collection JSON
│   ├── postman_api_documentation.md # API execution payload documentation
│   ├── project_report.md     # Production deployment project report
│   ├── final_submission_checklist.md # Submission verification checklist
│   └── deployment_guide.md   # Step-by-step Render and Vercel guide
└── render.yaml               # Render Infrastructure-as-Code blueprint
```

---

## ⚙️ Environment Variables

To run the application, configure the environment variables as follows:

### Backend (`backend/.env`)
```bash
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://username:password@localhost:5432/multi_tenant_saas?schema=public"
JWT_ACCESS_SECRET="your-super-secret-access-token-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-token-key-change-in-production"
CORS_ORIGIN="http://localhost:3000"
```

### Frontend (`frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_BACKEND_URL="http://localhost:5000"
```

---

## 🔧 Installation & Local Setup

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **PostgreSQL** instance running locally or hosted

### 1. Database Configuration
1. Open your PostgreSQL console and create a new database:
   ```sql
   CREATE DATABASE multi_tenant_saas;
   ```
2. Navigate to the backend directory, install dependencies, and run database migrations to create tables and relations:
   ```bash
   cd backend
   npm install
   npx prisma migrate dev
   ```

### 2. Launch Backend API
1. Start the backend in development mode:
   ```bash
   npm run dev
   ```
2. The server will start running on [http://localhost:5000](http://localhost:5000).

### 3. Launch Frontend Client
1. In a new terminal window, navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. The web application will launch in development mode at [http://localhost:3000](http://localhost:3000).

---

## 📡 API Endpoints

| Category | Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/api/auth/register` | `POST` | None (Rate-limited)| Registers tenant & assigns `OWNER` role |
| **Auth** | `/api/auth/login` | `POST` | None (Rate-limited)| Authenticates credentials & sets cookies |
| **Auth** | `/api/auth/logout` | `POST` | Yes | Clears tokens from database and cookies |
| **Auth** | `/api/auth/refresh` | `POST` | None | Rotates refresh and access tokens |
| **Auth** | `/api/auth/me` | `GET` | Yes | Returns current user session info |
| **Members**| `/api/members` | `GET` | Yes | Lists all members in organization |
| **Members**| `/api/members/invite` | `POST` | Yes (Owner/Admin) | Invites new user with role boundaries |
| **Members**| `/api/members/:id` | `DELETE`| Yes (Owner only) | Deletes member from tenant |
| **Members**| `/api/members/organization/delete` | `DELETE` | Yes (Owner only) | Cascade-purges organization and data |
| **Projects**| `/api/projects` | `GET` | Yes | Lists projects scoped to current member |
| **Projects**| `/api/projects` | `POST` | Yes (Owner/Admin) | Creates new project |
| **Projects**| `/api/projects/:id` | `PUT` | Yes (Owner/Admin) | Updates project details & assignments |
| **Tasks** | `/api/tasks` | `POST` | Yes | Creates task (requires project assignment) |
| **Tasks** | `/api/tasks/:id` | `PUT` | Yes | Updates task status, details, or assignment|
| **Uploads**| `/api/uploads/profile` | `POST` | Yes | Uploads profile picture |
| **Uploads**| `/api/uploads/attachment` | `POST`| Yes | Uploads project/task attachment |
| **Uploads**| `/api/uploads/attachments` | `GET` | Yes | Retrieves list of project/task attachments |

---

## 🗄️ Database Schema & Relational Structure

The application's relational data model is designed to support logical multi-tenancy and audit tracking:

* **Tenant:** The root organization. Deleting a tenant triggers a `CASCADE` delete on all nested users, projects, audit logs, and tasks.
* **User:** Associated with one `Tenant`. Maps to multiple `RefreshToken` records and references task assignments. Holds role states (`OWNER`, `ADMIN`, `MEMBER`).
* **Project:** Workspace linked to a `Tenant`. References a many-to-many relationship with users (`ProjectMembers`).
* **Task:** Belongs to a `Project`. References `creator` and optionally an `assignedUser`.
* **Attachment:** Stores filename, path, size, and mimetype. Relates to a `Tenant`, `User`, `Project`, and `Task`.
* **AuditLog:** Records strict history logs (`action`, `ipAddress`, `userAgent`) for security compliance.
* **Notification:** Dispatches real-time alerts to individual users.

*Note: For the full database entity-relationship diagram and indices documentation, refer to [docs/database_schema.md](file:///c:/Users/Dipa%20Rani/Desktop/MULTI-TENANT%20SaaS%20PLATEFORM/docs/database_schema.md).*

---

## 🌐 Production Deployment Summary

Detailed instructions are available in [docs/deployment_guide.md](file:///c:/Users/Dipa%20Rani/Desktop/MULTI-TENANT%20SaaS%20PLATEFORM/docs/deployment_guide.md).

* **Backend & Database (Render):** Uses the `render.yaml` specification to provision the Node web server and PostgreSQL database instance. Ensure you supply `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` env variables.
* **Frontend (Vercel):** Deploy Next.js inside the `frontend/` subdirectory. Specify the env keys `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_URL` pointing to the Render backend endpoint.

---

## 📸 Screenshots

*Screenshots demonstrating the live application dashboard, role boundaries, real-time presence indicators, and responsive views:*

| Dashboard Grid & Projects | Task & Document Management |
| :---: | :---: |
| ![Dashboard Overview Placeholder](https://via.placeholder.com/600x350.png?text=Dashboard+Overview+Grid) | ![Task Board Placeholder](https://via.placeholder.com/600x350.png?text=Interactive+Task+Management) |

---

## ✍️ Author
* **Intern Developer:** Dipa Rani
* **GitHub Repository:** [READY-NEST-INTERNSHIP-WEEK-5](https://github.com/diparani925-creator/READY-NEST-INTERNSHIP-WEEK-5.git)
* **Project Submission:** Week 5 Internship Milestone
