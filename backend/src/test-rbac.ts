import app from './app';
import prisma from './config/db';
import http from 'http';

async function main() {
  console.log('--- Starting Programmatic RBAC Integration Test Suite ---');
  
  // 1. Spin up a temporary server on port 5001 to run tests against
  const PORT = 5001;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Temporary test server listening on port ${PORT}`);

  const BASE_URL = `http://localhost:${PORT}/api`;

  // Define test email prefixes to make them unique
  const ts = Date.now();
  const ownerEmail = `owner.${ts}@test.com`;
  const adminEmail = `admin.${ts}@test.com`;
  const memberEmail = `member.${ts}@test.com`;
  const password = 'Password123!';
  const tenantSlug = `tenant-${ts}`;

  let ownerCookie = '';
  let adminCookie = '';
  let memberCookie = '';

  let adminId = '';
  let memberId = '';

  let p1Id = ''; // Owner project
  let p2Id = ''; // Admin project
  let t1Id = ''; // Admin task in P2
  let t2Id = ''; // Member task in P1

  try {
    // ----------------------------------------------------
    // TEST 1: Register OWNER
    // ----------------------------------------------------
    console.log('\n[TEST 1] Registering Owner (creates Tenant)...');
    const registerRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password,
        name: 'Test Owner',
        tenantName: 'RBAC Test Org',
        tenantSlug,
      }),
    });
    
    if (registerRes.status !== 201) {
      throw new Error(`Owner registration failed: status ${registerRes.status}`);
    }
    
    // Save owner cookies
    ownerCookie = registerRes.headers.get('set-cookie') || '';
    const ownerData = await registerRes.json() as any;
    const ownerId = ownerData.data.user.id;
    console.log(`Owner registered with ID: ${ownerId}`);

    // ----------------------------------------------------
    // TEST 2: OWNER Invites ADMIN
    // ----------------------------------------------------
    console.log('\n[TEST 2] OWNER inviting ADMIN...');
    const inviteAdminRes = await fetch(`${BASE_URL}/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': ownerCookie,
      },
      body: JSON.stringify({
        email: adminEmail,
        password,
        name: 'Test Admin',
        role: 'ADMIN',
      }),
    });

    if (inviteAdminRes.status !== 201) {
      throw new Error(`Owner inviting Admin failed: status ${inviteAdminRes.status}`);
    }
    
    const adminData = await inviteAdminRes.json() as any;
    adminId = adminData.data.member.id;
    console.log(`Admin invited successfully with ID: ${adminId}`);

    // ----------------------------------------------------
    // TEST 3: OWNER Invites MEMBER
    // ----------------------------------------------------
    console.log('\n[TEST 3] OWNER inviting MEMBER...');
    const inviteMemberRes = await fetch(`${BASE_URL}/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': ownerCookie,
      },
      body: JSON.stringify({
        email: memberEmail,
        password,
        name: 'Test Member',
        role: 'MEMBER',
      }),
    });

    if (inviteMemberRes.status !== 201) {
      throw new Error(`Owner inviting Member failed: status ${inviteMemberRes.status}`);
    }
    
    const memberData = await inviteMemberRes.json() as any;
    memberId = memberData.data.member.id;
    console.log(`Member invited successfully with ID: ${memberId}`);

    // Log in as Admin and Member to collect cookies
    console.log('\nLogging in Admin and Member for session cookies...');
    
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    adminCookie = adminLoginRes.headers.get('set-cookie') || '';

    const memberLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, password }),
    });
    memberCookie = memberLoginRes.headers.get('set-cookie') || '';

    // ----------------------------------------------------
    // TEST 4: Project Management permissions
    // ----------------------------------------------------
    console.log('\n[TEST 4] Testing Project Management permissions...');
    
    // Owner creates Project P1
    const createP1Res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
      body: JSON.stringify({ name: 'Project 1', description: 'Owner Project' }),
    });
    if (createP1Res.status !== 201) throw new Error('Owner failed to create project P1');
    const p1Data = await createP1Res.json() as any;
    p1Id = p1Data.data.project.id;
    console.log(`Owner created project P1: ${p1Id}`);

    // Admin creates Project P2
    const createP2Res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ name: 'Project 2', description: 'Admin Project' }),
    });
    if (createP2Res.status !== 201) throw new Error('Admin failed to create project P2');
    const p2Data = await createP2Res.json() as any;
    p2Id = p2Data.data.project.id;
    console.log(`Admin created project P2: ${p2Id}`);

    // Member tries to create project (should block with 403)
    const createP3Res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': memberCookie },
      body: JSON.stringify({ name: 'Project 3', description: 'Member Project' }),
    });
    console.log(`Member create project status (expected 403): ${createP3Res.status}`);
    if (createP3Res.status !== 403) {
      throw new Error(`Security breach: Member created a project (status ${createP3Res.status})`);
    }

    // ----------------------------------------------------
    // TEST 5: Project Visibility Fencing
    // ----------------------------------------------------
    console.log('\n[TEST 5] Testing Project Visibility Fencing...');
    
    // Member lists projects before being assigned to any (should see 0)
    const memberProjRes1 = await fetch(`${BASE_URL}/projects`, {
      method: 'GET',
      headers: { 'Cookie': memberCookie },
    });
    const memberProjData1 = await memberProjRes1.json() as any;
    console.log(`Member sees ${memberProjData1.data.projects.length} projects initially (expected 0)`);
    if (memberProjData1.data.projects.length !== 0) {
      throw new Error('Member saw unassigned projects');
    }

    // Assign Member to Project P1
    console.log('Owner assigning Member to Project P1...');
    const assignMemberRes = await fetch(`${BASE_URL}/projects/${p1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': ownerCookie },
      body: JSON.stringify({ memberIds: [memberId] }),
    });
    if (assignMemberRes.status !== 200) throw new Error('Owner failed to assign Member to Project P1');

    // Member lists projects now (should see 1 project: P1)
    const memberProjRes2 = await fetch(`${BASE_URL}/projects`, {
      method: 'GET',
      headers: { 'Cookie': memberCookie },
    });
    const memberProjData2 = await memberProjRes2.json() as any;
    console.log(`Member sees ${memberProjData2.data.projects.length} projects after assignment (expected 1)`);
    if (memberProjData2.data.projects.length !== 1 || memberProjData2.data.projects[0].id !== p1Id) {
      throw new Error('Member project visibility is incorrect after assignment');
    }

    // ----------------------------------------------------
    // TEST 6: Task Creation and Assignment Limits
    // ----------------------------------------------------
    console.log('\n[TEST 6] Testing Task Creation and Assignment Limits...');

    // Admin creates task T1 in project P2 assigned to Member (even though Member is not in P2, Admin can assign)
    const createT1Res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({
        title: 'Task 1',
        description: 'Admin assigned task',
        projectId: p2Id,
        assignedUserId: memberId,
      }),
    });
    if (createT1Res.status !== 201) throw new Error(`Admin failed to create task T1 (status ${createT1Res.status})`);
    const t1Data = await createT1Res.json() as any;
    t1Id = t1Data.data.task.id;
    console.log(`Admin created task T1: ${t1Id}`);

    // Member tries to create task in project P2 (they are not assigned to P2, should block with 403)
    const createT2ResFail = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': memberCookie },
      body: JSON.stringify({
        title: 'Forbidden Task',
        projectId: p2Id,
      }),
    });
    console.log(`Member task creation in unassigned project (expected 403): ${createT2ResFail.status}`);
    if (createT2ResFail.status !== 403) {
      throw new Error('Security breach: Member created task in unassigned project');
    }

    // Member creates task T2 in project P1 (assigned to self)
    const createT2Res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': memberCookie },
      body: JSON.stringify({
        title: 'Task 2',
        description: 'Member created task',
        projectId: p1Id,
      }),
    });
    if (createT2Res.status !== 201) throw new Error('Member failed to create task T2');
    const t2Data = await createT2Res.json() as any;
    t2Id = t2Data.data.task.id;
    console.log(`Member created task T2: ${t2Id}`);

    // ----------------------------------------------------
    // TEST 7: Task Modifying Permissions
    // ----------------------------------------------------
    console.log('\n[TEST 7] Testing Task Modifying Permissions...');

    // Member updates status of T2 (their own task) -> Should succeed
    const updateT2Res = await fetch(`${BASE_URL}/tasks/${t2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': memberCookie },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    if (updateT2Res.status !== 200) throw new Error('Member failed to update their own task status');
    console.log('Member successfully updated their own task status.');

    // Member tries to update T1 (assigned to them, but created by Admin in project P2 which Member is not member of)
    // Wait, the controller rules say: "MEMBER can only update their own assigned task"
    // Since T1 is assigned to Member, they can update it! Let's verify if they can update it.
    // Yes, they are the assigned user, so it should succeed.
    const updateT1Res = await fetch(`${BASE_URL}/tasks/${t1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': memberCookie },
      body: JSON.stringify({ status: 'DONE' }),
    });
    if (updateT1Res.status !== 200) throw new Error('Member failed to update task assigned to them');
    console.log('Member successfully updated status of task assigned to them.');

    // Member tries to update some other task (Let's verify by checking they cannot assign task to another user)
    // Actually, since they are MEMBER, they can only update status, title, description of tasks where assignedUserId === memberId.
    // What if Admin updates T2? Admin can update anything.
    const adminUpdateRes = await fetch(`${BASE_URL}/tasks/${t2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cookie': adminCookie },
      body: JSON.stringify({ title: 'Task 2 Updated by Admin' }),
    });
    if (adminUpdateRes.status !== 200) throw new Error('Admin failed to update task P1-T2');
    console.log('Admin successfully updated task details.');

    // ----------------------------------------------------
    // TEST 8: Org settings limits
    // ----------------------------------------------------
    console.log('\n[TEST 8] Testing Organization deletion restrictions...');

    // Admin tries to delete organization (expected 403)
    const deleteOrgAdminRes = await fetch(`${BASE_URL}/members/organization/delete`, {
      method: 'DELETE',
      headers: { 'Cookie': adminCookie },
    });
    console.log(`Admin delete organization status (expected 403): ${deleteOrgAdminRes.status}`);
    if (deleteOrgAdminRes.status !== 403) {
      throw new Error('Security breach: Admin deleted organization!');
    }

    // Owner deletes organization (expected 200)
    const deleteOrgOwnerRes = await fetch(`${BASE_URL}/members/organization/delete`, {
      method: 'DELETE',
      headers: { 'Cookie': ownerCookie },
    });
    console.log(`Owner delete organization status (expected 200): ${deleteOrgOwnerRes.status}`);
    if (deleteOrgOwnerRes.status !== 200) {
      throw new Error('Owner failed to delete organization!');
    }

    console.log('\nChecking if tenant and all related records were successfully deleted Cascade-style in database...');
    const deletedTenantUsers = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, adminEmail, memberEmail] } }
    });
    console.log(`Remaining users in DB matching test emails: ${deletedTenantUsers.length} (expected 0)`);
    if (deletedTenantUsers.length !== 0) {
      throw new Error('Tenant cascade delete did not clean up users correctly');
    }

    console.log('\n--- ALL RBAC ROUTE TESTS PASSED SUCCESSFULLY! ---');
    
    // Close the server and exit
    server.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n*** RBAC TEST SUITE FAILED ***');
    console.error(error.message || error);
    server.close();
    process.exit(1);
  }
}

main();
