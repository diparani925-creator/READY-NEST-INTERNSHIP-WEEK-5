import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import http from 'http';
import { initSocket } from './config/socket';
import { io as clientIo, Socket as ClientSocket } from 'socket.io-client';
import { UserRole } from '@prisma/client';

function cleanCookieHeader(setCookieHeader: string): string {
  if (!setCookieHeader) return '';
  const parts = setCookieHeader.split(',');
  const cleanPairs = parts.map(part => part.trim().split(';')[0]);
  return cleanPairs.join('; ');
}

async function main() {
  console.log('--- Starting Programmatic Socket.IO Real-Time Test Suite ---');
  
  const PORT = 5002;
  const server = http.createServer(app);
  initSocket(server);
  
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Test server listening on port ${PORT}`);

  const BASE_URL = `http://localhost:${PORT}/api`;
  const ts = Date.now();

  // Create two tenants and three users
  // Tenant A: Owner A, Member A
  // Tenant B: Owner B
  const ownerAEmail = `owner.a.${ts}@test.com`;
  const memberAEmail = `member.a.${ts}@test.com`;
  const ownerBEmail = `owner.b.${ts}@test.com`;
  const password = 'Password123!';

  let ownerACookie = '';
  let memberACookie = '';
  let ownerBCookie = '';

  let ownerAId = '';
  let memberAId = '';
  let ownerBId = '';

  let tenantAId = '';
  let tenantBId = '';

  try {
    // ----------------------------------------------------
    // SETUP: Register Tenant A & Tenant B
    // ----------------------------------------------------
    console.log('[SETUP] Registering Tenant A and users...');
    const regARes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerAEmail,
        password,
        name: 'Owner A',
        tenantName: 'Tenant A Org',
        tenantSlug: `tenant-a-${ts}`,
      }),
    });
    ownerACookie = cleanCookieHeader(regARes.headers.get('set-cookie') || '');
    const regAData = await regARes.json() as any;
    ownerAId = regAData.data.user.id;
    tenantAId = regAData.data.user.tenantId;

    // Invite Member A to Tenant A
    const inviteRes = await fetch(`${BASE_URL}/members/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': ownerACookie },
      body: JSON.stringify({
        email: memberAEmail,
        password,
        name: 'Member A',
        role: 'MEMBER',
      }),
    });
    const inviteData = await inviteRes.json() as any;
    memberAId = inviteData.data.member.id;

    // Login Member A
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberAEmail, password }),
    });
    memberACookie = cleanCookieHeader(loginARes.headers.get('set-cookie') || '');

    // Register Tenant B
    console.log('[SETUP] Registering Tenant B and Owner B...');
    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerBEmail,
        password,
        name: 'Owner B',
        tenantName: 'Tenant B Org',
        tenantSlug: `tenant-b-${ts}`,
      }),
    });
    ownerBCookie = cleanCookieHeader(regBRes.headers.get('set-cookie') || '');
    const regBData = await regBRes.json() as any;
    ownerBId = regBData.data.user.id;
    tenantBId = regBData.data.user.tenantId;

    console.log('Setup finished. Connecting sockets...');

    const createSocket = (cookieString: string): ClientSocket => {
      return clientIo(`http://localhost:${PORT}`, {
        extraHeaders: {
          Cookie: cookieString,
        },
        reconnection: false,
        autoConnect: false,
      });
    };

    const connectSocket = (socket: ClientSocket): Promise<void> => {
      return new Promise((resolve, reject) => {
        socket.on('connect', () => resolve());
        socket.on('connect_error', (err: any) => reject(err));
        socket.connect();
      });
    };

    const clientOwnerA = createSocket(ownerACookie);

    // ----------------------------------------------------
    // TEST 2: Presence updates on connects / disconnects
    // ----------------------------------------------------
    let tenantAPresenceList: string[] = [];
    clientOwnerA.on('PRESENCE_CHANGE', (data: { onlineUserIds: string[] }) => {
      tenantAPresenceList = data.onlineUserIds;
    });

    await connectSocket(clientOwnerA);
    console.log('✔ Socket Owner A connected successfully.');

    // Wait short time for initial presence broadcast
    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('Initial presence list Tenant A (expected [OwnerAId]):', tenantAPresenceList);
    if (!tenantAPresenceList.includes(ownerAId) || (tenantAPresenceList.length as number) !== 1) {
      throw new Error('Presence tracking failed on first connection');
    }

    // Connect Member A
    const clientMemberA = createSocket(memberACookie);
    await connectSocket(clientMemberA);
    console.log('✔ Socket Member A connected successfully.');

    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('Updated presence list Tenant A (expected [OwnerAId, MemberAId]):', tenantAPresenceList);
    if ((tenantAPresenceList.length as number) !== 2 || !tenantAPresenceList.includes(memberAId)) {
      throw new Error('Presence tracking failed on second connection');
    }

    // Connect Owner B
    const clientOwnerB = createSocket(ownerBCookie);
    await connectSocket(clientOwnerB);
    console.log('✔ Socket Owner B connected successfully.');

    // ----------------------------------------------------
    // TEST 3: Tenant Room Isolation
    // ----------------------------------------------------
    console.log('\nTesting room isolation...');
    let ownerAReceivedEvent = false;
    let memberAReceivedEvent = false;
    let ownerBReceivedEvent = false;

    clientOwnerA.on('PROJECT_CHANGE', () => { ownerAReceivedEvent = true; });
    clientMemberA.on('PROJECT_CHANGE', () => { memberAReceivedEvent = true; });
    clientOwnerB.on('PROJECT_CHANGE', () => { ownerBReceivedEvent = true; });

    // Trigger project creation on Tenant A
    console.log('Triggering project creation on Tenant A (Owner A calls REST endpoint)...');
    const pCreateRes = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': ownerACookie },
      body: JSON.stringify({ name: 'Realtime Project A' }),
    });
    
    if (pCreateRes.status !== 201) throw new Error('Failed to create project');
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log('Events received check:');
    console.log(`- Owner A received event: ${ownerAReceivedEvent} (expected true)`);
    console.log(`- Member A received event: ${memberAReceivedEvent} (expected true)`);
    console.log(`- Owner B received event: ${ownerBReceivedEvent} (expected false)`);

    if (!ownerAReceivedEvent || !memberAReceivedEvent) {
      throw new Error('Event broadcast failed inside tenant room A');
    }
    if (ownerBReceivedEvent) {
      throw new Error('Tenant room isolation breach: Tenant B socket received Tenant A room event');
    }
    console.log('✔ Tenant isolation verified successfully.');

    // ----------------------------------------------------
    // TEST 4: Notifications Dispatch
    // ----------------------------------------------------
    console.log('\nTesting notification delivery...');
    let memberANotification: any = null;
    clientMemberA.on('NEW_NOTIFICATION', (data: { notification: any; userId: string }) => {
      if (data.userId === memberAId) {
        memberANotification = data.notification;
      }
    });

    // Create a task on Tenant A and assign it to Member A
    console.log('Creating task on Tenant A and assigning to Member A...');
    const projectData = await pCreateRes.json() as any;
    const projectId = projectData.data.project.id;

    const tCreateRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': ownerACookie },
      body: JSON.stringify({
        title: 'Assigned Task',
        projectId,
        assignedUserId: memberAId,
        priority: 'HIGH',
      }),
    });
    if (tCreateRes.status !== 201) throw new Error('Failed to create assigned task');

    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log('Member A received notification:', memberANotification);
    if (!memberANotification || memberANotification.title !== 'New Task Assignment') {
      throw new Error('Notification dispatch failed over Socket.IO');
    }
    console.log('✔ Realtime notification dispatch verified.');

    // ----------------------------------------------------
    // TEARDOWN
    // ----------------------------------------------------
    console.log('\nDisconnecting sockets...');
    clientOwnerA.disconnect();
    clientMemberA.disconnect();
    clientOwnerB.disconnect();

    await new Promise((resolve) => setTimeout(resolve, 300));
    console.log('Presence list Tenant A after disconnects (expected empty):', tenantAPresenceList);

    // Delete tenants
    console.log('Tearing down database rows...');
    await fetch(`${BASE_URL}/members/organization/delete`, { method: 'DELETE', headers: { 'Cookie': ownerACookie } });
    await fetch(`${BASE_URL}/members/organization/delete`, { method: 'DELETE', headers: { 'Cookie': ownerBCookie } });

    console.log('--- ALL REAL-TIME SUITE TESTS COMPLETED SUCCESSFULLY! ---');
    server.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n*** REAL-TIME SUITE TEST FAILURE ***');
    console.error(error.message || error);
    server.close();
    process.exit(1);
  }
}

main();
