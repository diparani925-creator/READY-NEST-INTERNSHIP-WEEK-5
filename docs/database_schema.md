# Database Schema & ER Diagram Documentation

This document describes the schema architecture, entity relationship model, and database optimization indices for the Multi-Tenant SaaS Workspace Platform.

---

## 📊 Entity Relationship (ER) Diagram

The following Mermaid diagram visualizes the relational schema. It maps tenant scope, user roles, project membership, nested tasks, file uploads, notifications, and logging mechanisms.

```mermaid
erDiagram
    tenants {
        string id PK
        string name
        string slug UNIQUE
        datetime createdAt
        datetime updatedAt
    }

    users {
        string id PK
        string email UNIQUE
        string password_hash
        string name
        UserRole role
        string profile_image
        string tenant_id FK
        datetime createdAt
        datetime updatedAt
    }

    refresh_tokens {
        string id PK
        string token UNIQUE
        string user_id FK
        datetime expires_at
        boolean revoked
        datetime createdAt
    }

    projects {
        string id PK
        string name
        string description
        boolean archived
        string tenant_id FK
        datetime createdAt
        datetime updatedAt
    }

    tasks {
        string id PK
        string title
        string description
        string status
        string priority
        datetime due_date
        string project_id FK
        string assigned_user_id FK
        string creator_id FK
        datetime createdAt
        datetime updatedAt
    }

    notifications {
        string id PK
        string user_id FK
        string title
        string message
        boolean read
        string type
        datetime createdAt
    }

    activity_logs {
        string id PK
        string tenant_id FK
        string user_id FK
        string type
        string message
        datetime createdAt
    }

    attachments {
        string id PK
        string filename
        string path
        string mime_type
        int size
        string tenant_id FK
        string user_id FK
        string project_id FK
        string task_id FK
        datetime createdAt
    }

    audit_logs {
        string id PK
        string tenant_id FK
        string user_id FK
        string action
        string details
        string ip_address
        string user_agent
        datetime createdAt
    }

    tenants ||--o{ users : "owns"
    tenants ||--o{ projects : "contains"
    tenants ||--o{ activity_logs : "records"
    tenants ||--o{ attachments : "hosts"
    tenants ||--o{ audit_logs : "registers"

    users ||--o{ refresh_tokens : "generates"
    users ||--o{ notifications : "receives"
    users ||--o{ tasks : "assignee"
    users ||--o{ tasks : "creator"
    users }o--o{ projects : "ProjectMembers"
    users ||--o{ activity_logs : "triggers"
    users ||--o{ attachments : "uploads"
    users ||--o{ audit_logs : "causes"

    projects ||--o{ tasks : "groups"
    projects ||--o{ attachments : "attaches"

    tasks ||--o{ attachments : "attaches"
```

---

## 🗄 Table Schemas

### 1. Tenants (`tenants`)
Represents independent organizations inside the platform. It is the root scope for all logical isolation rules.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `name` | `String` | `Required` | Organization name. |
| `slug` | `String` | `Unique`, `Required` | Organization slug used in workspace URLs. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Creation timestamp. |
| `updatedAt` | `DateTime` | `UpdatedOnUpdate` | Last updated timestamp. |

* **Indices:** Unique index automatically created on `slug`.

---

### 2. Users (`users`)
Represents users registered inside tenants.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `email` | `String` | `Unique`, `Required` | Login email address. |
| `password_hash` | `String` | `Required` | Bcrypt-hashed password. |
| `name` | `String` | `Required` | Display name. |
| `role` | `Enum` | `UserRole`, `DEFAULT(MEMBER)`| Roles: `OWNER`, `ADMIN`, `MEMBER`. |
| `profile_image` | `String` | `Nullable` | Path to profile avatar attachment. |
| `tenant_id` | `String` | `Foreign Key` -> `tenants(id)` | Parent tenant organization. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Creation timestamp. |
| `updatedAt` | `DateTime` | `UpdatedOnUpdate` | Last updated timestamp. |

* **Indices:**
  - Unique index on `email`.
  - `@@index([tenantId])` (Optimizes user retrieval by tenant scope).

---

### 3. Refresh Tokens (`refresh_tokens`)
Stores refresh tokens for automatic JWT rotation validations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `token` | `String` | `Unique`, `Required` | Refresh token payload. |
| `user_id` | `String` | `Foreign Key` -> `users(id)` | User owner of this token. |
| `expires_at` | `DateTime` | `Required` | Timestamp after which the token is invalid. |
| `revoked` | `Boolean` | `DEFAULT(false)` | Flag to mark tokens compromised/invalidated. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Token creation timestamp. |

* **Indices:**
  - Unique index on `token`.
  - `@@index([userId])` (Optimizes token lookup and deletion during logout/refresh).

---

### 4. Projects (`projects`)
Workspace projects created to organize tasks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `name` | `String` | `Required` | Name of project. |
| `description`| `String` | `Nullable` | Descriptive summary. |
| `archived` | `Boolean` | `DEFAULT(false)` | Active/Archived state flag. |
| `tenant_id` | `String` | `Foreign Key` -> `tenants(id)` | Parent tenant context. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Creation timestamp. |
| `updatedAt` | `DateTime` | `UpdatedOnUpdate` | Last updated timestamp. |

* **Indices:**
  - `@@index([tenantId])` (Speeds up project listings per tenant).

---

### 5. Tasks (`tasks`)
Relational tasks tracked within project scopes.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `title` | `String` | `Required` | Task title. |
| `description`| `String` | `Nullable` | Detailed explanation. |
| `status` | `String` | `DEFAULT("TODO")` | Status state: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`. |
| `priority` | `String` | `DEFAULT("MEDIUM")` | Priority state: `LOW`, `MEDIUM`, `HIGH`. |
| `due_date` | `DateTime` | `Nullable` | Deadline timestamp. |
| `project_id` | `String` | `Foreign Key` -> `projects(id)` | Parent project workspace. |
| `assigned_user_id`| `String`| `Nullable`, `FK` -> `users(id)`| User assigned to execute. |
| `creator_id` | `String` | `Foreign Key` -> `users(id)` | Author of the task. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Creation timestamp. |
| `updatedAt` | `DateTime` | `UpdatedOnUpdate` | Last updated timestamp. |

* **Indices:**
  - `@@index([projectId])` (Speeds up task list by project).
  - `@@index([assignedUserId])` (Speeds up task filtering by assignee).
  - `@@index([creatorId])` (Speeds up tasks listing by author).

---

### 6. Notifications (`notifications`)
Relational alerts sent to users regarding task assignments and org updates.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `user_id` | `String` | `Foreign Key` -> `users(id)` | Recipient user. |
| `title` | `String` | `Required` | Header text. |
| `message` | `String` | `Required` | Body content. |
| `read` | `Boolean` | `DEFAULT(false)` | Seen status flag. |
| `type` | `String` | `Nullable` | Type category (e.g. `TASK_ASSIGNED`). |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Dispatch timestamp. |

* **Indices:**
  - `@@index([userId])` (Speeds up notifications loading per user).
  - `@@index([read])` (Optimizes fetching only unread notification lists).

---

### 7. Activity Logs (`activity_logs`)
Maintains a general history of events within a tenant organization.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `tenant_id` | `String` | `Foreign Key` -> `tenants(id)` | Organization context. |
| `user_id` | `String` | `Nullable`, `FK` -> `users(id)`| Actor who triggered the event. |
| `type` | `String` | `Required` | Event type. |
| `message` | `String` | `Required` | Event details. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Action timestamp. |

* **Indices:**
  - `@@index([tenantId])`
  - `@@index([userId])`

---

### 8. Attachments (`attachments`)
Tracks files uploaded to projects or tasks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `filename` | `String` | `Required` | File name. |
| `path` | `String` | `Required` | Upload path. |
| `mime_type` | `String` | `Required` | File type (e.g. `application/pdf`). |
| `size` | `Int` | `Required` | Size in bytes. |
| `tenant_id` | `String` | `Foreign Key` -> `tenants(id)` | Tenant scope constraint. |
| `user_id` | `String` | `Nullable`, `FK` -> `users(id)`| Uploader user context. |
| `project_id` | `String` | `Nullable`, `FK` -> `projects(id)`| Project scope (if uploaded to project). |
| `task_id` | `String` | `Nullable`, `FK` -> `tasks(id)`| Task scope (if uploaded to task). |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Upload timestamp. |

* **Indices:**
  - `@@index([tenantId])`
  - `@@index([projectId])`
  - `@@index([taskId])`
  - `@@index([userId])`

---

### 9. Audit Logs (`audit_logs`)
Records security-critical actions (e.g. user registrations, billing updates, deletions).

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` | `Primary Key`, `UUID` | Unique identifier. |
| `tenant_id` | `String` | `Foreign Key` -> `tenants(id)` | Organization context. |
| `user_id` | `String` | `Nullable`, `FK` -> `users(id)`| Actor context. |
| `action` | `String` | `Required` | Action name (e.g. `REGISTER`). |
| `details` | `String` | `Nullable` | Informational payload. |
| `ip_address` | `String` | `Nullable` | Origin IP of request. |
| `user_agent` | `String` | `Nullable` | Client browser user agent. |
| `createdAt` | `DateTime` | `DEFAULT(now())` | Timestamp of event. |

* **Indices:**
  - `@@index([tenantId])`
  - `@@index([userId])`
