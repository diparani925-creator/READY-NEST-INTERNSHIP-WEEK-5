import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import http from 'http';
import prisma from './config/db';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

function cleanCookieHeader(setCookieHeader: string | string[] | undefined): string {
  if (!setCookieHeader) return '';
  const headerStr = Array.isArray(setCookieHeader) ? setCookieHeader.join(', ') : setCookieHeader;
  const parts = headerStr.split(',');
  const cleanPairs = parts.map((part) => part.trim().split(';')[0]);
  return cleanPairs.join('; ');
}

async function main() {
  console.log('--- Starting Programmatic Security & Production Readiness Test Suite ---');

  const PORT = 5003;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  const BASE_URL = `http://localhost:${PORT}/api`;
  const ts = Date.now();
  const email = `security.owner.${ts}@test.com`;
  const tenantSlug = `security-tenant-${ts}`;
  const password = 'Password123!';

  let tenantId = '';

  try {
    // ----------------------------------------------------
    // TEST 1: Zod Input Validation Checks
    // ----------------------------------------------------
    console.log('\n[TEST 1] Testing input schema validation...');
    
    // Call register with invalid email
    const invalidRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password,
        name: 'Sec Owner',
        tenantName: 'Sec Tenant',
        tenantSlug,
      }),
    });

    const invalidRegData = await invalidRegRes.json() as any;
    if (invalidRegRes.status === 400 && invalidRegData.status === 'fail') {
      console.log('✔ Zod validation successfully caught bad registration email format (returned 400).');
    } else {
      throw new Error(`Zod validation check failed on registration. Status: ${invalidRegRes.status}`);
    }

    // ----------------------------------------------------
    // SETUP: Registering a valid tenant and user (Do this before triggering rate limits!)
    // ----------------------------------------------------
    console.log('\n[SETUP] Registering new workspace & logging in...');
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        name: 'Security Test User',
        tenantName: 'Security Testing Corp',
        tenantSlug,
      }),
    });

    if (registerRes.status !== 201) {
      const errTxt = await registerRes.text();
      throw new Error(`Failed to register test user. Code: ${registerRes.status}, Body: ${errTxt}`);
    }

    const regData = await registerRes.json() as any;
    const userId = regData.data.user.id;
    tenantId = regData.data.user.tenant.id;
    const cookie = cleanCookieHeader(registerRes.headers.get('set-cookie') || '');

    // Create a project to link attachments to
    const projectRes = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: 'Security Shield Project',
        description: 'Verify file attachments boundary rules.',
      }),
    });

    const projectData = await projectRes.json() as any;
    const projectId = projectData.data.project.id;
    console.log(`Created Project for file mapping. ID: ${projectId}`);

    // ----------------------------------------------------
    // TEST 2: File Attachment Upload Validation
    // ----------------------------------------------------
    console.log('\n[TEST 2] Testing multipart/form-data attachment uploader...');
    
    // Create local temp files for testing
    const tempDocsPath = path.join(process.cwd(), 'temp_doc_attachment.txt');
    fs.writeFileSync(tempDocsPath, 'Workspace attachment test document contents.');

    const form = new FormData();
    form.append('file', fs.createReadStream(tempDocsPath), 'temp_doc_attachment.txt');
    form.append('projectId', projectId);

    const uploadHeaders = form.getHeaders();
    uploadHeaders['Cookie'] = cookie;

    const uploadRes = await new Promise<any>((resolve, reject) => {
      const req = http.request(
        {
          host: 'localhost',
          port: PORT,
          path: '/api/uploads/attachment',
          method: 'POST',
          headers: uploadHeaders,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: JSON.parse(body),
            });
          });
        }
      );
      form.pipe(req);
      req.on('error', reject);
    });

    if (uploadRes.status === 201 && uploadRes.body.status === 'success') {
      console.log('✔ Multipart document file upload succeeded (returned 201).');
      console.log(`Uploaded file path: ${uploadRes.body.data.attachment.path}`);
    } else {
      throw new Error(`File attachment upload failed. Status: ${uploadRes.status}, Body: ${JSON.stringify(uploadRes.body)}`);
    }

    // Clean up local temp file
    if (fs.existsSync(tempDocsPath)) {
      fs.unlinkSync(tempDocsPath);
    }

    // ----------------------------------------------------
    // TEST 3: Audit Event Logs DB Check
    // ----------------------------------------------------
    console.log('\n[TEST 3] Testing Audit Event logs persistence...');
    
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Fetched persistent AuditLogs for Tenant ID (${tenantId}):`);
    logs.forEach((log, index) => {
      console.log(`  [LOG #${index + 1}] Action: "${log.action}" | Details: "${log.details}" | IP: "${log.ipAddress}"`);
    });

    const hasRegister = logs.some((l) => l.action === 'REGISTER');
    const hasUpload = logs.some((l) => l.action === 'FILE_UPLOAD');

    if (hasRegister && hasUpload) {
      console.log('✔ Audit logging successfully recorded Register and File Upload events.');
    } else {
      throw new Error('Audit logging verification failed: missing expected REGISTER or FILE_UPLOAD records.');
    }

    // ----------------------------------------------------
    // TEST 4: Rate Limiting Checks (Run at the absolute end!)
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing authentication rate limiting (stricter limit: max 30)...');
    console.log('Flooding auth login route with 33 calls...');

    let rateLimited = false;
    let rateLimitMsg = '';

    for (let i = 1; i <= 33; i++) {
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword' }),
      });

      if (loginRes.status === 429) {
        rateLimited = true;
        const data = await loginRes.json() as any;
        rateLimitMsg = data.message;
        console.log(`✔ Rate limiting successfully triggered at attempt #${i} (returned 429).`);
        break;
      }
    }

    if (!rateLimited) {
      throw new Error('Authentication rate limiting failed: Allowable quota breached without 429 error.');
    } else {
      console.log(`Rate limit error details: "${rateLimitMsg}"`);
    }

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n[CLEANUP] Purging test tenant and database records...');
    
    // Clear upload files in database & filesystem
    const attachmentsList = await prisma.attachment.findMany({ where: { tenantId } });
    for (const att of attachmentsList) {
      const physicalPath = path.join(process.cwd(), att.path.substring(1));
      if (fs.existsSync(physicalPath)) {
        fs.unlinkSync(physicalPath);
      }
    }

    await prisma.tenant.delete({
      where: { id: tenantId },
    });
    console.log('Database records cleaned successfully.');
    console.log('\n--- ALL SECURITY SUITE TESTS PASSED SUCCESSFULLY! ---');

  } catch (error) {
    console.error('\n❌ Test Suite execution error encountered:', error);
    
    // Cleanup if tenantId is resolved
    if (tenantId) {
      try {
        await prisma.tenant.delete({ where: { id: tenantId } });
      } catch {}
    }
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
}

main();
