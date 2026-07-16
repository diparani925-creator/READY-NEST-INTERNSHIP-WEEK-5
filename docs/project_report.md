# Technical Project Report: Enterprise Multi-Tenant SaaS Workspace Platform

---

## 1. Introduction
Modern enterprise team collaboration requires decoupled, scalable software ecosystems. This project delivers a high-performance **Multi-Tenant SaaS Workspace Platform** designed for project orchestration, task assignment, real-time notification synchronization, and audit traceability. Designed on modern security guidelines, this platform isolates organizational scopes, handles session tokens securely via cookie rotation, and scales database execution with optimized relation configurations.

---

## 2. Problem Statement
Many decoupled web frameworks suffer from three common issues:
1. **Weak Tenant Isolation:** Poorly structured data models risk data leaks across organizational boundaries.
2. **Session Vulnerabilities:** Exposing raw access tokens to client browser scripts (local storage or plain cookies) opens windows for Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF) hijacks.
3. **Database Performance Degradation:** Relational joins without index tuning create bottlenecks as organizations scale their databases.

---

## 3. Objectives
* Build a secure **Logical Multi-Tenancy Architecture** using logical row-level scoping (`tenantId`).
* Implement **Double-Cookie JWT Sessions** utilizing automatic refresh token rotation.
* Restrict data interactions using **Role-Based Access Control (RBAC)** across Owner, Admin, and Member levels.
* Design **Socket.IO Rooms** for instant event notifications and user presence mapping.
* Construct a highly responsive, modern glassmorphic dashboard styled with Tailwind CSS.
* Set up **Infrastructure-as-Code Blueprint Files** for Render database/service orchestrations and Vercel hosting.

---

## 4. System Architecture & Database Design

### Database Design
The relational storage is built on **PostgreSQL** using **Prisma ORM**.
* **Tenants** serve as the root organization model.
* **Users** map to a single tenant and possess a specific `UserRole` (`OWNER`, `ADMIN`, `MEMBER`).
* **RefreshTokens** manage silent validation rotations.
* **Projects** and **Tasks** organize data workloads.
* **Attachments** log files uploaded to project or task scopes.
* **Notifications**, **ActivityLogs**, and **AuditLogs** trace notifications and security events.

*For schema fields, indices, and the complete ER Diagram, refer to the [Database Schema Documentation](file:///c:/Users/Dipa%20Rani/Desktop/MULTI-TENANT%20SaaS%20PLATEFORM/docs/database_schema.md).*

### Architectural Flow

```markdown
  [ Next.js Frontend ] <----( Socket.IO Events )----> [ Express Backend ]
          |                                                   |
     (HTTPS REST)                                      (Prisma ORM Client)
          |                                                   |
          v                                                   v
   [ Secure CORS / Cookies ]                          [ PostgreSQL Database ]
```

1. **Logical Isolation:** All backend service queries explicitly query on `{ tenantId }`. No queries cross-evaluate datasets.
2. **Double-Cookie Security:** 
   - `access_token`: Short-lived (15 minutes), `httpOnly: true`, `secure: true`, `sameSite: 'none'`.
   - `refresh_token`: Long-lived (7 days), scoped to `/api/auth` path, validated against database records.
3. **Automatic Session Rotation:** When a request fails with a `401 Unauthorized` token expiry, the client axios interceptor automatically hits `/api/auth/refresh` to rotate credentials.

---

## 5. Implementation Details
* **Modular Codebase:** We isolated modals (like `AttachmentModal.tsx`) from the main view page and lazy-loaded them using Next.js `dynamic()` handlers, minimizing initial JS bundle footprints.
* **Structured Request Logger:** Log actions write structured JSON to stdout in production, allowing cloud log collectors (Render Logs, Logtail) to ingest log metrics.
* **CORS Origin Array Handling:** Supports single string configs or comma-separated lists of domains dynamically mapped from the environments.

---

## 6. Testing Outcomes
We executed three programmatic integration test suites validating backend robustness:

1. **RBAC Integration Suite (`test-rbac.ts`):** Spin up server on port 5001. Evaluated owner, admin, and member scopes. Confirmed that members are blocked (status 403) from creating projects or accessing tasks in unassigned projects. **Result: Passed.**
2. **Socket.IO Real-time Suite (`test-realtime.ts`):** Spin up server on port 5002. Dispatched tasks and verified room-scoped events. Confirmed that Socket rooms enforce strict organization isolation. **Result: Passed.**
3. **Security Limiter Suite (`test-security.ts`):** Spin up server on port 5003. Fuzzed the login endpoints. Rate limiter triggered at attempt #29, returning status `429 Too Many Requests`. **Result: Passed.**

---

## 7. Challenges Solved

### Challenge 1: Cross-Site Cookie Sharing
* **Problem:** Frontends deployed on Vercel and backends on Render/Railway are considered "Cross-Site" by browsers. Standard `SameSite=Lax` cookies are rejected on cross-site credentialed requests.
* **Solution:** Configured cookie parameters to use `SameSite=None` alongside `Secure=true` in production, enabling browser credential sharing while preserving development lax conditions.

### Challenge 2: Test Mismatch on Mapped Status Codes
* **Problem:** Service-level errors were caught in controllers and wrapped inside standard `AppError(..., 400)` objects, but the RBAC test suite expected status `403 Forbidden` for security violations.
* **Solution:** Enhanced catch blocks in controllers to inspect the error content, mapping `'Forbidden'` or `'permission'` messages to `403`, and `'not found'` messages to `404`.

---

## 8. Future Scope & Improvements
* **S3 Object Storage:** Move uploads folder to Amazon S3 or Cloudinary.
* **SAML SSO Auth:** Implement SAML/OIDC enterprise Single Sign-On.
* **Redis Caching:** Introduce cache layers for audit logs and workspace metrics.

---

## 9. Conclusion
The Multi-Tenant SaaS Workspace Platform successfully implements a production-ready infrastructure. By utilizing double-cookie token rotations, rigid logical database partitions, structured logging middleware, and optimized indexes, it secures tenant workspaces, speeds up queries, and establishes a robust architecture ready for deployment.
