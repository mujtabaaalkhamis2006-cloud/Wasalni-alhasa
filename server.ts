import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction =
  process.env.NODE_ENV === 'production' ||
  Boolean(process.env.K_SERVICE) ||
  Boolean(process.env.PORT && process.env.PORT !== '3000') ||
  (process.env.npm_lifecycle_event !== 'dev' && fs.existsSync(path.resolve(__dirname, 'dist', 'index.html')));

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Full CORS Support for Cross-Domain and Vercel Multi-Device Synchronization
app.use((_req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (_req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Direct View and Download routes for graduation project report
app.get(['/graduation-report', '/graduation-report.html'], (_req: Request, res: Response) => {
  res.sendFile(path.resolve(__dirname, 'public', 'graduation-report.html'));
});

app.get('/download/graduation-report.html', (_req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="graduation_project_report.html"');
  res.sendFile(path.resolve(__dirname, 'public', 'graduation-report.html'));
});

app.get(['/graduation-report.md', '/download/graduation-report.md'], (_req: Request, res: Response) => {
  res.setHeader('Content-Disposition', 'attachment; filename="graduation_project_report.md"');
  res.sendFile(path.resolve(__dirname, 'GRADUATION_PROJECT_REPORT.md'));
});

// Handle direct visits to other .html aliases by serving the SPA
app.use((req, _res, next) => {
  if (req.url.endsWith('.html') && req.url !== '/index.html') {
    req.url = '/';
  }
  next();
});

// Shared Multi-Device Transit Database for cross-device sync
const DB_FILE = process.env.VERCEL
  ? path.resolve('/tmp', 'transit-db.json')
  : path.resolve(__dirname, 'transit-db.json');

function getTransitData() {
  try {
    const rootDbFile = path.resolve(__dirname, 'transit-db.json');
    if (process.env.VERCEL && !fs.existsSync(DB_FILE) && fs.existsSync(rootDbFile)) {
      try {
        fs.copyFileSync(rootDbFile, DB_FILE);
      } catch {}
    }

    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (!Array.isArray(data.deletedUserIds)) data.deletedUserIds = [];
      if (!Array.isArray(data.deletedTripIds)) data.deletedTripIds = [];
      if (!Array.isArray(data.deletedBookingIds)) data.deletedBookingIds = [];

      // Ensure all mock/fake registrations and trips are permanently purged and banned
      if (Array.isArray(data.users)) {
        data.users = data.users.filter((u: any) => {
          if (u.id === 'usr-admin') return true;
          if (
            u.id.startsWith('usr-driver-') ||
            u.id.startsWith('usr-pass-') ||
            u.email === 'fahad@driver.sa' ||
            u.email === 'ali@driver.sa' ||
            data.deletedUserIds.includes(u.id)
          ) {
            if (!data.deletedUserIds.includes(u.id)) data.deletedUserIds.push(u.id);
            return false;
          }
          return true;
        });
      }
      if (data.passwords) {
        delete data.passwords['fahad@driver.sa'];
        delete data.passwords['ali@driver.sa'];
      }
      if (data.driverLocations) {
        delete data.driverLocations['usr-drv-test'];
        data.deletedUserIds.forEach((id: string) => {
          delete data.driverLocations[id];
        });
      }
      if (Array.isArray(data.trips)) {
        data.trips = data.trips.filter(
          (t: any) =>
            t.driverId !== 'usr-driver-1' &&
            t.driverId !== 'usr-driver-2' &&
            !data.deletedTripIds.includes(t.id) &&
            !data.deletedUserIds.includes(t.driverId)
        );
      }
      return data;
    }
  } catch (err) {
    console.error('Error reading transit DB:', err);
  }
  return null;
}

let serverTransitData = getTransitData();

function saveTransitDataToFile() {
  if (serverTransitData) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(serverTransitData, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error writing transit DB:', err);
    }
  }
}

// --- Real-time Presence & Server-Sent Events (SSE) for Cross-Device Synchronization ---
interface ActivePresence {
  sessionId: string;
  userId?: string;
  userName: string;
  role: 'driver' | 'passenger' | 'admin' | 'visitor';
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceName: string;
  ip?: string;
  city?: string;
  lastSeen: string;
  isOnline: boolean;
  statusText?: string;
  coords?: {
    lat: number;
    lng: number;
  };
  activeTripId?: string;
}

const sseClients: Set<Response> = new Set();
const activePresenceMap: Map<string, ActivePresence> = new Map();

function broadcastSseEvent(eventType: string, payload: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  });
}

function cleanStalePresence() {
  const now = Date.now();
  let changed = false;
  activePresenceMap.forEach((p, id) => {
    const elapsed = now - new Date(p.lastSeen).getTime();
    if (elapsed > 40000) {
      activePresenceMap.delete(id);
      changed = true;
    }
  });
  if (changed) {
    broadcastSseEvent('presence', getActivePresenceList());
  }
}

setInterval(cleanStalePresence, 8000);

function getActivePresenceList(): ActivePresence[] {
  const now = Date.now();
  const list: ActivePresence[] = [];
  activePresenceMap.forEach(p => {
    if (now - new Date(p.lastSeen).getTime() <= 40000) {
      list.push({ ...p, isOnline: true });
    }
  });
  return list.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
}

// Live SSE Stream for Sub-Second Multi-Device Event Delivery
app.get('/api/transit/events', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial presence & state event immediately
  res.write(`event: init\ndata: ${JSON.stringify({ state: serverTransitData, presence: getActivePresenceList() })}\n\n`);

  _req.on('close', () => {
    sseClients.delete(res);
  });
});

// Presence Heartbeat Endpoint: Called by devices when active
app.post('/api/transit/presence', (req: Request, res: Response) => {
  try {
    const { sessionId, userId, userName, role, deviceType, deviceName, coords, activeTripId, statusText } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = new Date().toISOString();

    const presence: ActivePresence = {
      sessionId,
      userId,
      userName: userName || 'زائر في الأحساء',
      role: role || 'visitor',
      deviceType: deviceType || 'mobile',
      deviceName: deviceName || 'هاتف ذكي',
      ip: clientIp || 'Al-Ahsa',
      city: 'الأحساء',
      lastSeen: now,
      isOnline: true,
      statusText: statusText || (role === 'driver' ? 'كابتن حافلة متصل الآن 🟢' : role === 'admin' ? 'إدارة العمليات 🛡️' : 'راكب متصل 🟢'),
      coords,
      activeTripId
    };

    activePresenceMap.set(sessionId, presence);
    const updatedList = getActivePresenceList();
    broadcastSseEvent('presence', updatedList);

    return res.json({ success: true, activePresence: updatedList });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

app.get('/api/transit/presence', (_req: Request, res: Response) => {
  cleanStalePresence();
  return res.json({ success: true, activePresence: getActivePresenceList() });
});

app.post('/api/transit/presence/leave', (req: Request, res: Response) => {
  const { sessionId } = req.body;
  if (sessionId && activePresenceMap.has(sessionId)) {
    activePresenceMap.delete(sessionId);
    broadcastSseEvent('presence', getActivePresenceList());
  }
  return res.json({ success: true });
});

app.get('/api/transit/state', (_req: Request, res: Response) => {
  if (!serverTransitData) {
    serverTransitData = getTransitData();
  }
  res.json({ success: true, data: serverTransitData, activePresence: getActivePresenceList() });
});

// Authoritative Multi-Device Login Endpoint
app.post('/api/transit/login', (req: Request, res: Response) => {
  try {
    const { identifier, password, role, sessionId, deviceType, deviceName } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    if (!serverTransitData) serverTransitData = getTransitData();
    const cleanId = String(identifier).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const user = (serverTransitData?.users || []).find(
      (u: any) => u.email?.toLowerCase() === cleanId || u.phone?.trim() === cleanId
    );

    const UNIFIED_ERROR = 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى';

    if (!user) {
      return res.status(401).json({ error: UNIFIED_ERROR });
    }

    const savedPass =
      serverTransitData.passwords?.[user.email?.toLowerCase()] ||
      serverTransitData.passwords?.[user.phone?.trim()] ||
      serverTransitData.passwords?.[cleanId] ||
      '123456';

    if (savedPass !== cleanPass) {
      return res.status(401).json({ error: UNIFIED_ERROR });
    }

    if (role && user.role !== role) {
      if (role === 'admin') {
        return res.status(403).json({ error: 'هذا الحساب ليس لديه صلاحيات الإدارة' });
      }
      if (role === 'driver') {
        return res.status(403).json({ error: 'هذا الحساب ليس مسجلاً كسائق' });
      }
    }

    if (user.role === 'driver' && user.status === 'pending') {
      return res.status(403).json({
        error: 'حسابك كسائق ما زال قيد المراجعة والتدقيق من قبل الإدارة. سيتم تفعيله قريباً.'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'تم رفض طلب هذا الحساب من قبل الإدارة' });
    }

    // Register active presence immediately across all devices!
    if (sessionId) {
      const clientIp = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const presence: ActivePresence = {
        sessionId,
        userId: user.id,
        userName: user.name,
        role: user.role,
        deviceType: deviceType || 'mobile',
        deviceName: deviceName || 'هاتف ذكي',
        ip: clientIp || 'Al-Ahsa',
        city: 'الأحساء',
        lastSeen: new Date().toISOString(),
        isOnline: true,
        statusText: user.role === 'driver' ? 'كابتن حافلة متصل الآن 🟢' : user.role === 'admin' ? 'مسؤول إدارة العمليات 🛡️' : 'راكب متصل الآن 👤'
      };
      activePresenceMap.set(sessionId, presence);
      broadcastSseEvent('presence', getActivePresenceList());
    }

    broadcastSseEvent('login', { user, activePresence: getActivePresenceList() });

    return res.json({ success: true, user, activePresence: getActivePresenceList() });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error during login' });
  }
});

// Atomic User Registration across all devices
app.post('/api/transit/register', (req: Request, res: Response) => {
  try {
    const { user, password } = req.body;
    if (!user || !user.id || !user.role) {
      return res.status(400).json({ error: 'بيانات التسجيل غير مكتملة' });
    }
    if (!serverTransitData) serverTransitData = getTransitData();
    if (!Array.isArray(serverTransitData.users)) serverTransitData.users = [];
    if (!serverTransitData.passwords) serverTransitData.passwords = {};

    const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';
    const cleanPhone = user.phone ? user.phone.trim() : '';

    const existingIndex = serverTransitData.users.findIndex(
      (u: any) => u.id === user.id || (cleanPhone && u.phone === cleanPhone) || (cleanEmail && u.email?.toLowerCase() === cleanEmail)
    );

    if (existingIndex >= 0) {
      serverTransitData.users[existingIndex] = { ...serverTransitData.users[existingIndex], ...user };
    } else {
      serverTransitData.users.push(user);
    }

    if (password) {
      if (cleanEmail) serverTransitData.passwords[cleanEmail] = String(password).trim();
      if (cleanPhone) serverTransitData.passwords[cleanPhone] = String(password).trim();
    }

    saveTransitDataToFile();
    broadcastSseEvent('user:register', { user });
    return res.json({ success: true, user, totalUsers: serverTransitData.users.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Error registering user' });
  }
});

// Detect IP Physical Location Endpoint
app.get('/api/transit/detect-ip', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      const json = await response.json();
      if (typeof json.latitude === 'number' && typeof json.longitude === 'number') {
        return res.json({
          success: true,
          lat: json.latitude,
          lng: json.longitude,
          city: json.city || 'Al-Ahsa'
        });
      }
    }
  } catch (e) {}
  return res.json({ success: true, lat: 25.3835, lng: 49.5862, city: 'Al-Ahsa' });
});

// Real Driver GPS update endpoint with resilient upsert
app.post('/api/transit/driver-gps', (req: Request, res: Response) => {
  try {
    const { tripId, driverId, lat, lng, speed, heading, accuracy } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
    if (!serverTransitData) serverTransitData = getTransitData();
    if (!Array.isArray(serverTransitData.trips)) serverTransitData.trips = [];
    if (!serverTransitData.driverLocations) serverTransitData.driverLocations = {};

    const speedKmh = typeof speed === 'number' && !isNaN(speed) ? Math.max(0, Math.round(speed)) : 0;
    const headingDeg = typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : 0;
    const accuracyM = typeof accuracy === 'number' ? Math.round(accuracy) : 5;

    const locData = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      speed: speedKmh,
      heading: headingDeg,
      accuracy: accuracyM,
      lastUpdated: new Date().toISOString()
    };

    if (driverId) {
      serverTransitData.driverLocations[driverId] = locData;
    }

    let trip = null;
    if (tripId) {
      trip = serverTransitData.trips.find((t: any) => t.id === tripId);
    }
    if (!trip && driverId) {
      trip = serverTransitData.trips.find((t: any) => t.driverId === driverId && t.status === 'in_progress');
    }

    if (trip) {
      trip.currentLocation = locData;
    }

    saveTransitDataToFile();
    broadcastSseEvent('gps', { tripId, driverId, currentLocation: locData, tripUpdated: !!trip });
    return res.json({ success: true, currentLocation: locData, tripUpdated: !!trip });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Authoritative Permanent User Deletion (Drivers & Passengers)
app.post('/api/transit/delete-user', (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId || userId === 'usr-admin') {
      return res.status(400).json({ error: 'معرف المستخدم غير صالح أو لا يمكن حذف مسؤول النظام الرئيسي' });
    }
    if (!serverTransitData) serverTransitData = getTransitData();
    if (!Array.isArray(serverTransitData.deletedUserIds)) {
      serverTransitData.deletedUserIds = [];
    }
    if (!serverTransitData.deletedUserIds.includes(userId)) {
      serverTransitData.deletedUserIds.push(userId);
    }

    const targetUser = (serverTransitData.users || []).find((u: any) => u.id === userId);

    // 1. Remove user permanently
    serverTransitData.users = (serverTransitData.users || []).filter((u: any) => u.id !== userId);

    // 2. Remove credentials
    if (serverTransitData.passwords) {
      if (targetUser?.email) delete serverTransitData.passwords[targetUser.email];
      if (targetUser?.phone) delete serverTransitData.passwords[targetUser.phone];
    }

    // 3. Remove driver physical locations
    if (serverTransitData.driverLocations) {
      delete serverTransitData.driverLocations[userId];
    }

    // 4. Remove live active presence
    activePresenceMap.forEach((p, sessId) => {
      if (p.userId === userId) {
        activePresenceMap.delete(sessId);
      }
    });

    // 5. Remove or cancel associated trips
    const removedTripIds: string[] = [];
    serverTransitData.trips = (serverTransitData.trips || []).filter((t: any) => {
      if (t.driverId === userId) {
        removedTripIds.push(t.id);
        return false;
      }
      return true;
    });

    if (!Array.isArray(serverTransitData.deletedTripIds)) {
      serverTransitData.deletedTripIds = [];
    }
    removedTripIds.forEach(tId => {
      if (!serverTransitData.deletedTripIds.includes(tId)) {
        serverTransitData.deletedTripIds.push(tId);
      }
    });

    // 6. Remove associated bookings
    serverTransitData.bookings = (serverTransitData.bookings || []).filter((b: any) => {
      return b.passengerId !== userId && !removedTripIds.includes(b.tripId);
    });

    saveTransitDataToFile();
    broadcastSseEvent('user:deleted', { userId, deletedTripIds: removedTripIds });
    broadcastSseEvent('presence', getActivePresenceList());
    broadcastSseEvent('state', serverTransitData);

    return res.json({ success: true, userId, remainingUsers: serverTransitData.users.length });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error deleting user' });
  }
});

// Authoritative Permanent Trip Deletion
app.post('/api/transit/delete-trip', (req: Request, res: Response) => {
  try {
    const { tripId } = req.body;
    if (!tripId) {
      return res.status(400).json({ error: 'معرف الرحلة مفقود' });
    }
    if (!serverTransitData) serverTransitData = getTransitData();
    if (!Array.isArray(serverTransitData.deletedTripIds)) {
      serverTransitData.deletedTripIds = [];
    }
    if (!serverTransitData.deletedTripIds.includes(tripId)) {
      serverTransitData.deletedTripIds.push(tripId);
    }

    serverTransitData.trips = (serverTransitData.trips || []).filter((t: any) => t.id !== tripId);

    // Cancel remaining bookings for this trip
    (serverTransitData.bookings || []).forEach((b: any) => {
      if (b.tripId === tripId && b.status !== 'boarded') {
        b.status = 'cancelled';
      }
    });

    saveTransitDataToFile();
    broadcastSseEvent('trip:deleted', { tripId });
    broadcastSseEvent('state', serverTransitData);

    return res.json({ success: true, tripId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error deleting trip' });
  }
});

// Purge Mock Registrations Endpoint (Permanent ban of all fake/mock users)
app.post('/api/transit/purge-mock-data', (_req: Request, res: Response) => {
  try {
    if (!serverTransitData) serverTransitData = getTransitData();
    if (!Array.isArray(serverTransitData.deletedUserIds)) serverTransitData.deletedUserIds = [];
    if (!Array.isArray(serverTransitData.deletedTripIds)) serverTransitData.deletedTripIds = [];

    // Identify mock and test user IDs
    const mockUserIds = (serverTransitData.users || [])
      .filter((u: any) =>
        u.id !== 'usr-admin' && (
          u.id.startsWith('usr-driver-') ||
          u.id.startsWith('usr-pass-') ||
          u.email === 'fahad@driver.sa' ||
          u.email === 'ali@driver.sa' ||
          u.name?.includes('وهمي') ||
          u.name?.includes('افتراضي') ||
          u.name?.includes('تجريبي')
        )
      )
      .map((u: any) => u.id);

    // Hardcode known mock IDs into permanent ban list
    ['usr-driver-1', 'usr-driver-2', 'usr-pass-1', 'usr-drv-test'].forEach(id => {
      if (!mockUserIds.includes(id)) mockUserIds.push(id);
    });

    mockUserIds.forEach((id: string) => {
      if (!serverTransitData.deletedUserIds.includes(id)) {
        serverTransitData.deletedUserIds.push(id);
      }
    });

    serverTransitData.users = (serverTransitData.users || []).filter(
      (u: any) => !serverTransitData.deletedUserIds.includes(u.id)
    );

    if (serverTransitData.passwords) {
      delete serverTransitData.passwords['fahad@driver.sa'];
      delete serverTransitData.passwords['ali@driver.sa'];
    }

    if (serverTransitData.driverLocations) {
      delete serverTransitData.driverLocations['usr-drv-test'];
      mockUserIds.forEach((id: string) => {
        delete serverTransitData.driverLocations[id];
      });
    }

    const mockTripIds = (serverTransitData.trips || [])
      .filter((t: any) => t.driverId === 'usr-driver-1' || t.driverId === 'usr-driver-2' || mockUserIds.includes(t.driverId))
      .map((t: any) => t.id);

    mockTripIds.forEach((tId: string) => {
      if (!serverTransitData.deletedTripIds.includes(tId)) {
        serverTransitData.deletedTripIds.push(tId);
      }
    });

    serverTransitData.trips = (serverTransitData.trips || []).filter(
      (t: any) => !serverTransitData.deletedTripIds.includes(t.id)
    );

    serverTransitData.bookings = (serverTransitData.bookings || []).filter(
      (b: any) => !mockUserIds.includes(b.passengerId) && !mockTripIds.includes(b.tripId)
    );

    saveTransitDataToFile();
    broadcastSseEvent('state', serverTransitData);
    return res.json({ success: true, remainingUsers: serverTransitData.users.length, purgedUserIds: mockUserIds });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message });
  }
});

// Intelligent Merged State Save with Absolute Tombstone Enforcement
app.post('/api/transit/state', (req: Request, res: Response) => {
  try {
    const incomingData = req.body;
    if (incomingData && typeof incomingData === 'object') {
      if (!serverTransitData) serverTransitData = getTransitData();

      // Merge and consolidate all tombstones from server and incoming client state
      const tombstoneUsers = new Set<string>([
        ...(serverTransitData.deletedUserIds || []),
        ...(incomingData.deletedUserIds || [])
      ]);
      const tombstoneTrips = new Set<string>([
        ...(serverTransitData.deletedTripIds || []),
        ...(incomingData.deletedTripIds || [])
      ]);
      const tombstoneBookings = new Set<string>([
        ...(serverTransitData.deletedBookingIds || []),
        ...(incomingData.deletedBookingIds || [])
      ]);

      serverTransitData.deletedUserIds = Array.from(tombstoneUsers);
      serverTransitData.deletedTripIds = Array.from(tombstoneTrips);
      serverTransitData.deletedBookingIds = Array.from(tombstoneBookings);

      // 1. Merge users: Filter OUT any tombstone user and mock registrations
      const userMap = new Map();
      (serverTransitData.users || []).forEach((u: any) => {
        if (!tombstoneUsers.has(u.id) && !u.id.startsWith('usr-driver-') && !u.id.startsWith('usr-pass-')) {
          userMap.set(u.id, u);
        }
      });
      (incomingData.users || []).forEach((u: any) => {
        if (!tombstoneUsers.has(u.id) && !u.id.startsWith('usr-driver-') && !u.id.startsWith('usr-pass-')) {
          userMap.set(u.id, u);
        }
      });
      serverTransitData.users = Array.from(userMap.values());

      // 2. Merge bookings: Filter OUT bookings belonging to tombstoned users or deleted trips
      const bookingMap = new Map();
      (serverTransitData.bookings || []).forEach((b: any) => {
        if (!tombstoneBookings.has(b.id) && !tombstoneUsers.has(b.passengerId) && !tombstoneTrips.has(b.tripId)) {
          bookingMap.set(b.id, b);
        }
      });
      (incomingData.bookings || []).forEach((b: any) => {
        if (!tombstoneBookings.has(b.id) && !tombstoneUsers.has(b.passengerId) && !tombstoneTrips.has(b.tripId)) {
          bookingMap.set(b.id, b);
        }
      });
      serverTransitData.bookings = Array.from(bookingMap.values());

      // 3. Merge trips: Filter OUT tombstoned trips or trips belonging to tombstoned drivers
      const tripMap = new Map();
      (serverTransitData.trips || []).forEach((t: any) => {
        if (!tombstoneTrips.has(t.id) && !tombstoneUsers.has(t.driverId)) {
          tripMap.set(t.id, t);
        }
      });
      (incomingData.trips || []).forEach((t: any) => {
        if (!tombstoneTrips.has(t.id) && !tombstoneUsers.has(t.driverId)) {
          const existing = tripMap.get(t.id);
          if (existing) {
            const existingTime = new Date(existing.currentLocation?.lastUpdated || 0).getTime();
            const incomingTime = new Date(t.currentLocation?.lastUpdated || 0).getTime();
            const mergedLoc = incomingTime >= existingTime ? (t.currentLocation || existing.currentLocation) : (existing.currentLocation || t.currentLocation);
            const mergedStatus = (t.status === 'cancelled' || t.status === 'completed')
              ? t.status
              : (existing.status === 'cancelled' || existing.status === 'completed' ? existing.status : t.status);
            tripMap.set(t.id, {
              ...existing,
              ...t,
              status: mergedStatus,
              currentLocation: mergedLoc
            });
          } else {
            tripMap.set(t.id, t);
          }
        }
      });
      serverTransitData.trips = Array.from(tripMap.values());

      // 4. Merge tickets
      const ticketMap = new Map();
      (serverTransitData.tickets || []).forEach((tk: any) => ticketMap.set(tk.id, tk));
      (incomingData.tickets || []).forEach((tk: any) => ticketMap.set(tk.id, tk));
      serverTransitData.tickets = Array.from(ticketMap.values());

      // 5. Merge passwords
      serverTransitData.passwords = {
        ...(serverTransitData.passwords || {}),
        ...(incomingData.passwords || {})
      };
      delete serverTransitData.passwords['fahad@driver.sa'];
      delete serverTransitData.passwords['ali@driver.sa'];

      if (incomingData.announcement) {
        serverTransitData.announcement = incomingData.announcement;
      }

      saveTransitDataToFile();
      broadcastSseEvent('state', serverTransitData);
      return res.json({ success: true, data: serverTransitData });
    }
    return res.status(400).json({ error: 'Invalid state format' });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Server error saving state' });
  }
});

// API: Generate App Specification from User Prompt
app.post('/api/generate-app', async (req: Request, res: Response) => {
  try {
    const { prompt, category, currentTheme, language = 'ar' } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'الرجاء إدخال وصف التطبيق أو الفكرة' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI();
        const systemInstruction = `
You are an expert app architect. A user has provided a product idea in Arabic or English: "${prompt}".
Generate a complete, rich, highly realistic interactive application model in JSON.
The output MUST be valid JSON with this exact schema:
{
  "appName": "Short catchy app name",
  "tagline": "Inspiring 1-sentence description",
  "category": "ecommerce" | "booking" | "dashboard" | "delivery" | "education" | "fitness" | "community" | "general",
  "themeColor": "emerald" | "indigo" | "amber" | "rose" | "cyan" | "purple",
  "currency": "ر.س" or "$" or appropriate,
  "stats": [
    { "id": "1", "label": "Label in Arabic", "value": "12,450", "change": "+14%", "positive": true },
    { "id": "2", "label": "Label in Arabic", "value": "890", "change": "+5%", "positive": true },
    { "id": "3", "label": "Label in Arabic", "value": "98.4%", "change": "+2.1%", "positive": true },
    { "id": "4", "label": "Label in Arabic", "value": "4.9 ★", "change": "ممتاز", "positive": true }
  ],
  "categories": ["الكل", "الفئة 1", "الفئة 2", "الفئة 3", "الفئة 4"],
  "items": [
    {
      "id": "item-1",
      "title": "Item name in Arabic",
      "subtitle": "Brief subtitle/description",
      "price": 149,
      "priceLabel": "149 ر.س",
      "category": "الفئة 1",
      "tag": "الأكثر طلباً",
      "rating": 4.9,
      "reviewsCount": 128,
      "image": "https://images.unsplash.com/...",
      "stock": 15,
      "features": ["ميزة 1", "ميزة 2", "ميزة 3"]
    }
    // Provide 5 to 7 realistic items
  ],
  "announcement": "ملاحظة أو عرض ترويجي ترحيبي",
  "quickActions": [
    { "id": "q1", "title": "عنوان الإجراء", "subtitle": "وصف مختصر", "icon": "sparkles" }
  ]
}
Make sure all text labels match the user's intent. If prompt is Arabic, use natural Arabic for all labels and content.
Return ONLY raw JSON, with no markdown code fences or backticks.
`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || '';
        const parsed = JSON.parse(text);
        return res.json({ success: true, appData: parsed, source: 'ai' });
      } catch (geminiError) {
        console.warn('Gemini API call warning, falling back to smart dynamic generator:', geminiError);
        // Fall back gracefully below
      }
    }

    // Smart fallback generator based on keywords and user prompt
    const appData = buildSmartAppFromPrompt(prompt, category, currentTheme, language);
    return res.json({ success: true, appData, source: 'smart-engine' });
  } catch (error: any) {
    console.error('Error generating app:', error);
    return res.status(500).json({ error: error?.message || 'حدث خطأ أثناء معالجة الطلب' });
  }
});

// Helper for high quality smart generator
function buildSmartAppFromPrompt(prompt: string, userCategory?: string, preferredTheme?: string, lang: string = 'ar') {
  const p = prompt.toLowerCase();

  let category = userCategory || 'general';
  let themeColor = preferredTheme || 'emerald';
  let appName = 'تطبيقي الجديد';
  let tagline = 'منصة حديثة وسريعة تلبي احتياجاتك بكل سهولة';
  let currency = 'ر.س';
  let categories = ['الكل', 'مميز', 'الأحدث', 'الأكثر تفاعلاً'];

  if (p.includes('متجر') || p.includes('عطور') || p.includes('سلة') || p.includes('ملابس') || p.includes('بيع') || p.includes('شراء') || p.includes('store') || p.includes('shop')) {
    category = 'ecommerce';
    themeColor = 'amber';
    appName = p.includes('عطور') ? 'عبير | متجر العطور الفاخرة' : 'رونق | المتجر الإلكتروني العصري';
    tagline = 'تجربة تسوق رقمية استثنائية مع شحن سريع وضمان ذهبي';
    categories = ['الكل', 'العطور الشرقية', 'العطور الفرنسية', 'المسك والعود', 'هدايا وباقات'];
  } else if (p.includes('حجز') || p.includes('عيادة') || p.includes('طبيب') || p.includes('مواعيد') || p.includes('صالون') || p.includes('clinic') || p.includes('booking')) {
    category = 'booking';
    themeColor = 'indigo';
    appName = p.includes('أسنان') ? 'دنتال كير | حجز مواعيد الأسنان' : 'مواعيدي | نظام إدارة الحجوزات';
    tagline = 'اختر طبيبك أو خدمتك المفضلة واحجز موعدك في ثوانٍ معدودة';
    categories = ['الكل', 'استشارات عامة', 'علاجات متقدمة', 'فحوصات دورية', 'حالات طارئة'];
  } else if (p.includes('مطعم') || p.includes('طعام') || p.includes('توصيل') || p.includes('وجبات') || p.includes('كافيه') || p.includes('قهوة') || p.includes('delivery') || p.includes('food')) {
    category = 'delivery';
    themeColor = 'rose';
    appName = p.includes('قهوة') ? 'مزاج كافيه | قهوة مختصة وسناكس' : 'شيف إكسبريس | طلبات وتوصيل الطعام';
    tagline = 'أشهى الأطباق والمشروبات الطازجة تصلك ساخنة وبأسرع وقت';
    categories = ['الكل', 'الأطباق الرئيسية', 'المقبلات والسلطات', 'الحلويات', 'المشروبات الباردة'];
  } else if (p.includes('إدارة') || p.includes('مهام') || p.includes('مشاريع') || p.includes('لوحة') || p.includes('تحكم') || p.includes('dashboard') || p.includes('task')) {
    category = 'dashboard';
    themeColor = 'cyan';
    appName = 'مُنجز | منصة إدارة المهام والمشاريع';
    tagline = 'تتبع أداء فريقك، أنجز مشاريعك بدقة، واستعرض مؤشرات النمو الحية';
    categories = ['الكل', 'قيد التنفيذ', 'مكتملة', 'عاجلة', 'مجدولة'];
  } else if (p.includes('دورة') || p.includes('تعليم') || p.includes('كورس') || p.includes('مدرسة') || p.includes('learn') || p.includes('course')) {
    category = 'education';
    themeColor = 'purple';
    appName = 'أكاديمية المعرفة | منصة التعلم التفاعلي';
    tagline = 'تعلم المهارات الأكثر طلباً في سوق العمل مع نخبة من الخبراء والشهادات المعتمدة';
    categories = ['الكل', 'الذكاء الاصطناعي', 'تطوير البرمجيات', 'التصميم وتجربة المستخدم', 'إدارة الأعمال'];
  } else if (p.includes('نادي') || p.includes('لياقة') || p.includes('تمارين') || p.includes('رياضة') || p.includes('صحة') || p.includes('fitness')) {
    category = 'fitness';
    themeColor = 'emerald';
    appName = 'فيت بلس | مدربك الرياضي الرقمي';
    tagline = 'خطط تدريب مخصصة وبرامج تغذية متكاملة لمساعدتك على تحقيق أهدافك البدنية';
    categories = ['الكل', 'تمارين حرق الدهون', 'بناء العضلات', 'تمارين الإطالة والمرونة', 'خطط التغذية'];
  }

  // Sample dynamic items tailored to category
  const itemGenerators: Record<string, any[]> = {
    ecommerce: [
      {
        id: 'ec-1',
        title: 'عطر مسك الغزال الملكي',
        subtitle: 'تركيبة فاخرة بفوحان يدوم لأكثر من 24 ساعة',
        price: 285,
        priceLabel: '285 ر.س',
        category: 'المسك والعود',
        tag: 'الأكثر مبيعاً',
        rating: 4.95,
        reviewsCount: 342,
        stock: 24,
        features: ['ثبات فائق', 'مكونات نقية 100%', 'تغليف هدايا فاخر مجاناً'],
        image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'ec-2',
        title: 'عطر أوركيد الليل الفرنسي',
        subtitle: 'عبير زهري منعش يجمع بين الفانيليا وأخشاب الأرز',
        price: 320,
        priceLabel: '320 ر.س',
        category: 'العطور الفرنسية',
        tag: 'وصل حديثاً',
        rating: 4.88,
        reviewsCount: 198,
        stock: 18,
        features: ['إصدار محدود', 'يناسب المناسبات الخاصة', 'شحن مجاني'],
        image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'ec-3',
        title: 'باقة دهن العود الكمبودي المعتق',
        subtitle: 'قطرات أصيلة تم تعتيقها لأكثر من 15 سنة',
        price: 490,
        priceLabel: '490 ر.س',
        category: 'المسك والعود',
        tag: 'مميز ونادر',
        rating: 5.0,
        reviewsCount: 89,
        stock: 8,
        features: ['معتق نقي', 'شهادة فحص مخبري', 'ضمان استرجاع ذهبي'],
        image: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'ec-4',
        title: 'عطر شمس الصحراء الحار',
        subtitle: 'مزيج العنبر والزعفران مع لمسات خشب الصندل الدافئ',
        price: 240,
        priceLabel: '240 ر.س',
        category: 'العطور الشرقية',
        tag: 'خصم 20%',
        rating: 4.75,
        reviewsCount: 156,
        stock: 45,
        features: ['حجم 100 مل', 'مناسب لجميع الفصول', 'عينات مجانية إضافية'],
        image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=600&q=80'
      }
    ],
    booking: [
      {
        id: 'bk-1',
        title: 'جلسة تنظيف وتبييض الأسنان بالليزر',
        subtitle: 'إزالة كاملة للترسبات مع تفتيح حتى 6 درجات في جلسة واحدة',
        price: 350,
        priceLabel: '350 ر.س',
        category: 'علاجات متقدمة',
        tag: 'العرض الأسبوعي',
        rating: 4.98,
        reviewsCount: 512,
        stock: 12,
        features: ['مدة الجلسة 45 دقيقة', 'أحدث جهاز ليزر أمريكي', 'ضمان ابتسامة مشرقة'],
        image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'bk-2',
        title: 'فحص شامل وأشعة بانورامية ثلاثية الأبعاد',
        subtitle: 'تشخيص دقيق لكافة الأسنان والفكين مع خطة علاج متكاملة',
        price: 150,
        priceLabel: '150 ر.س',
        category: 'فحوصات دورية',
        tag: 'فحص وقائي',
        rating: 4.85,
        reviewsCount: 280,
        stock: 30,
        features: ['تقرير رقمي فوري', 'استشارة طبيب استشاري', 'خصم على العلاجات اللاحقة'],
        image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'bk-3',
        title: 'تركيب تقويم الأسنان الشفاف (الإنفزلاين)',
        subtitle: 'حل غير مرئي ومريح لتعديل اصطفاف الأسنان بدون أسلاك معدنية',
        price: 2200,
        priceLabel: '2,200 ر.س (دفعة أولى)',
        category: 'علاجات متقدمة',
        tag: 'تقسيط متاح',
        rating: 4.94,
        reviewsCount: 140,
        stock: 5,
        features: ['قوالب مخصصة 3D', 'متابعة دورية مجانية', 'نتائج مرئية سريعة'],
        image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80'
      }
    ],
    dashboard: [
      {
        id: 'ds-1',
        title: 'إطلاق بوابة الدفع الإلكتروني الموحدة',
        subtitle: 'ربط بوابات مدى، أبل باي، وفيزا مع نظام الفوترة التلقائي',
        price: 100,
        priceLabel: 'أولوية قصوى',
        category: 'عاجلة',
        tag: 'إنجاز 85%',
        rating: 4.9,
        reviewsCount: 12,
        stock: 3,
        features: ['توثيق أمني PCI-DSS', 'اختبار تجريبي على 500 مستخدم', 'دعم فني 24/7'],
        image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80'
      },
      {
        id: 'ds-2',
        title: 'تطوير تطبيق الهاتف للعملاء (iOS & Android)',
        subtitle: 'تصميم واجهات المستخدم وبرمجة ميزات الطلب الفوري والتتبع',
        price: 60,
        priceLabel: 'أولوية متوسطة',
        category: 'قيد التنفيذ',
        tag: 'المرحلة الثانية',
        rating: 4.8,
        reviewsCount: 24,
        stock: 8,
        features: ['React Native / Expo', 'دعم الوضع الليلي', 'إشعارات لحظية عبر FCM'],
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'
      }
    ]
  };

  const selectedItems = itemGenerators[category] || itemGenerators.ecommerce;

  return {
    appName,
    tagline,
    category,
    themeColor,
    currency,
    stats: [
      { id: '1', label: 'إجمالي التفاعل والطلبات', value: '4,890', change: '+22%', positive: true },
      { id: '2', label: 'المستخدمين النشطين', value: '18.4K', change: '+12%', positive: true },
      { id: '3', label: 'معدل الرضا والتقييم', value: '4.95 ★', change: '99.4%', positive: true },
      { id: '4', label: 'سرعة الإنجاز والرد', value: '15 دقيقة', change: '-35%', positive: true }
    ],
    categories,
    items: selectedItems,
    announcement: '🎉 مرحباً بك! تم توليد هذا التطبيق استناداً لفكرتك — جرب الإضافة للسلة، البحث، والتصفح الآن!',
    quickActions: [
      { id: 'q1', title: 'إضافة عنصر جديد', subtitle: 'أضف منتجاً أو خدمة مباشرة', icon: 'plus' },
      { id: 'q2', title: 'تصدير الكود', subtitle: 'احصل على كود React 19 جاهز', icon: 'code' },
      { id: 'q3', title: 'معاينة الجوال', subtitle: 'جرب إطار الهاتف الذكي التفاعلي', icon: 'smartphone' }
    ]
  };
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Setup Vite dev server or static serve for production
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlPath = path.resolve(distPath, 'index.html');
  const hasBuild = fs.existsSync(indexHtmlPath);

  if (isProduction && hasBuild) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next) => {
      try {
        const url = req.originalUrl;
        let template = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
