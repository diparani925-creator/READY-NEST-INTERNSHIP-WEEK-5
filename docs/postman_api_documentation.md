# Postman API Request & Response Documentation

This document provides sample request structures and response JSON payloads for key endpoints in the Multi-Tenant SaaS Platform.

---

## 🔐 Authentication Endpoints

### 1. Register Owner
Creates a new tenant organization and registers the primary user as the `OWNER`.

* **Endpoint:** `POST /api/auth/register`
* **Rate Limits:** Max 30 requests per 15 minutes per IP.
* **Headers:**
  - `Content-Type: application/json`

* **Request Body Example:**
```json
{
  "email": "owner@acme.com",
  "password": "SecurePass123!",
  "name": "Jane Owner",
  "tenantName": "Acme Industries",
  "tenantSlug": "acme-ind"
}
```

* **Response Example (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "76495be1-88f0-47b6-8fce-7333185a57e1",
      "email": "owner@acme.com",
      "name": "Jane Owner",
      "role": "OWNER",
      "tenant": {
        "id": "e0894f46-16a6-4250-b3bb-706da85d0616",
        "name": "Acme Industries",
        "slug": "acme-ind"
      }
    }
  }
}
```

* **Response Example (409 Conflict):**
```json
{
  "status": "error",
  "statusCode": 409,
  "message": "Tenant slug already taken"
}
```

---

### 2. Login User
Authenticates a user and issues double credentials via HTTP-only, secure, CSRF-hardened cookies.

* **Endpoint:** `POST /api/auth/login`
* **Rate Limits:** Max 30 requests per 15 minutes per IP.
* **Headers:**
  - `Content-Type: application/json`

* **Request Body Example:**
```json
{
  "email": "owner@acme.com",
  "password": "SecurePass123!"
}
```

* **Response Example (200 OK):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "76495be1-88f0-47b6-8fce-7333185a57e1",
      "email": "owner@acme.com",
      "name": "Jane Owner",
      "role": "OWNER",
      "tenant": {
        "id": "e0894f46-16a6-4250-b3bb-706da85d0616",
        "name": "Acme Industries",
        "slug": "acme-ind"
      }
    }
  }
}
```

* **Response Example (401 Unauthorized):**
```json
{
  "status": "error",
  "statusCode": 401,
  "message": "Invalid email or password"
}
```

---

## 👥 Organization & Members Endpoints

### 3. Invite Member
Invites a new member to join the tenant organization. Restricted to `OWNER` or `ADMIN`.

* **Endpoint:** `POST /api/members/invite`
* **Headers:**
  - `Content-Type: application/json`
  - *Requires cookies: `access_token`*

* **Request Body Example:**
```json
{
  "email": "developer@acme.com",
  "password": "TempPassword123!",
  "name": "Alex Dev",
  "role": "MEMBER"
}
```

* **Response Example (201 Created):**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "c08c0cf4-85f8-4337-a4e8-c48535989baa",
      "email": "developer@acme.com",
      "name": "Alex Dev",
      "role": "MEMBER",
      "tenantId": "e0894f46-16a6-4250-b3bb-706da85d0616",
      "createdAt": "2026-07-16T08:52:25.147Z"
    }
  }
}
```

---

## 📁 Projects Endpoints

### 4. Create Project
Creates a new project within the tenant. Restricted to `OWNER` or `ADMIN`.

* **Endpoint:** `POST /api/projects`
* **Headers:**
  - `Content-Type: application/json`
  - *Requires cookies: `access_token`*

* **Request Body Example:**
```json
{
  "name": "Q3 Rebranding Plan",
  "description": "Aligning branding guidelines, marketing assets, and design schemas.",
  "memberIds": ["c08c0cf4-85f8-4337-a4e8-c48535989baa"]
}
```

* **Response Example (201 Created):**
```json
{
  "status": "success",
  "data": {
    "project": {
      "id": "98e65be1-98f0-47b6-8fce-7333185a57e1",
      "name": "Q3 Rebranding Plan",
      "description": "Aligning branding guidelines, marketing assets, and design schemas.",
      "archived": false,
      "tenantId": "e0894f46-16a6-4250-b3bb-706da85d0616",
      "createdAt": "2026-07-16T08:55:25.318Z",
      "updatedAt": "2026-07-16T08:55:25.318Z"
    }
  }
}
```

---

## 📋 Tasks Endpoints

### 5. Create Task
Adds a task inside a project. Validates that the poster has access to the project.

* **Endpoint:** `POST /api/tasks`
* **Headers:**
  - `Content-Type: application/json`
  - *Requires cookies: `access_token`*

* **Request Body Example:**
```json
{
  "title": "Select Typography and Gradients",
  "description": "Incorporate premium Outfit or Inter styles for modern aesthetics.",
  "projectId": "98e65be1-98f0-47b6-8fce-7333185a57e1",
  "assignedUserId": "c08c0cf4-85f8-4337-a4e8-c48535989baa",
  "status": "TODO",
  "priority": "HIGH",
  "dueDate": "2026-10-31"
}
```

* **Response Example (201 Created):**
```json
{
  "status": "success",
  "data": {
    "task": {
      "id": "657b302b-f9e3-4129-91db-b8565e9b3dcb",
      "title": "Select Typography and Gradients",
      "description": "Incorporate premium Outfit or Inter styles for modern aesthetics.",
      "status": "TODO",
      "priority": "HIGH",
      "dueDate": "2026-10-31T00:00:00.000Z",
      "projectId": "98e65be1-98f0-47b6-8fce-7333185a57e1",
      "creatorId": "76495be1-88f0-47b6-8fce-7333185a57e1",
      "assignedUserId": "c08c0cf4-85f8-4337-a4e8-c48535989baa",
      "createdAt": "2026-07-16T08:59:25.549Z",
      "updatedAt": "2026-07-16T08:59:25.549Z",
      "project": {
        "id": "98e65be1-98f0-47b6-8fce-7333185a57e1",
        "name": "Q3 Rebranding Plan"
      },
      "assignedUser": {
        "id": "c08c0cf4-85f8-4337-a4e8-c48535989baa",
        "name": "Alex Dev",
        "email": "developer@acme.com"
      },
      "creator": {
        "id": "76495be1-88f0-47b6-8fce-7333185a57e1",
        "name": "Jane Owner",
        "email": "owner@acme.com"
      }
    }
  }
}
```

* **Response Example (403 Forbidden - Task creation in unassigned project):**
```json
{
  "status": "error",
  "statusCode": 403,
  "message": "Forbidden: You are not assigned to this project"
}
```

---

## 📎 Uploads & Attachment Endpoints

### 6. Upload File Attachment
Uploads files to a project or task workspace.

* **Endpoint:** `POST /api/uploads/attachment`
* **Headers:**
  - `Content-Type: multipart/form-data`
  - *Requires cookies: `access_token`*

* **Request Payload (Multipart):**
  - `file`: `[Attachment binary]`
  - `projectId`: `98e65be1-98f0-47b6-8fce-7333185a57e1`
  - `taskId`: `657b302b-f9e3-4129-91db-b8565e9b3dcb`

* **Response Example (201 Created):**
```json
{
  "status": "success",
  "data": {
    "attachment": {
      "id": "b08c0cf4-95f8-4337-a4e8-c48535989baa",
      "filename": "branding_assets.zip",
      "path": "/uploads/attachments/1715832925147-branding_assets.zip",
      "mimeType": "application/zip",
      "size": 24560,
      "tenantId": "e0894f46-16a6-4250-b3bb-706da85d0616",
      "userId": "76495be1-88f0-47b6-8fce-7333185a57e1",
      "projectId": "98e65be1-98f0-47b6-8fce-7333185a57e1",
      "taskId": "657b302b-f9e3-4129-91db-b8565e9b3dcb",
      "createdAt": "2026-07-16T09:05:25.147Z"
    }
  }
}
```

---

## 📊 Dashboard Statistics Endpoints

### 7. Get Dashboard Overview Stats
Retrieves counts of active/archived projects, task statuses, priorities, and audit logs.

* **Endpoint:** `GET /api/dashboard/stats`
* **Headers:**
  - *Requires cookies: `access_token`*

* **Response Example (200 OK):**
```json
{
  "status": "success",
  "data": {
    "stats": {
      "projects": {
        "total": 2,
        "active": 2,
        "archived": 0
      },
      "tasks": {
        "total": 3,
        "statusCounts": {
          "TODO": 2,
          "IN_PROGRESS": 1,
          "REVIEW": 0,
          "DONE": 0
        },
        "priorityCounts": {
          "LOW": 0,
          "MEDIUM": 1,
          "HIGH": 2
        }
      }
    }
  }
}
```
