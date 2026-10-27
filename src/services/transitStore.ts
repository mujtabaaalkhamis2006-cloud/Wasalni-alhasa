import {
  User,
  TransitStation,
  TransitRoute,
  Trip,
  Booking,
  SupportTicket,
  Announcement,
  AdminStats,
  UserRole,
  ActivePresence
} from '../types/transit';
import {
  INITIAL_USERS,
  INITIAL_STATIONS,
  INITIAL_ROUTES,
  INITIAL_TRIPS,
  INITIAL_BOOKINGS,
  INITIAL_SUPPORT_TICKETS,
  INITIAL_ANNOUNCEMENT
} from '../data/mockData';
import {
  getSupabase,
  getSupabaseConfig,
  saveUserToSupabaseDb,
  findUserInSupabaseDb,
  fetchAllUsersFromSupabaseDb,
  saveStateToSupabaseDb,
  fetchStateFromSupabaseDb,
  deleteUserFromSupabaseDb,
  deleteTripFromSupabaseDb
} from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Hardcoded Shared Cloud Run Backend URL for Universal Multi-Device & Vercel Sync
export const CLOUD_RUN_BACKEND_URL = 'https://ais-pre-zmeqp3d7vghpy42smpj5r2-949617401674.europe-west2.run.app';

const STORAGE_KEY = 'al_ahsa_transit_real_v5';
const AUTH_KEY = 'al_ahsa_transit_auth_v5';
const PERSISTENT_SESSION_KEY = 'al_ahsa_transit_persistent_session_v6';


interface StoredData {
  users: User[];
  stations: TransitStation[];
  routes: TransitRoute[];
  trips: Trip[];
  bookings: Booking[];
  tickets: SupportTicket[];
  announcement: Announcement;
  passwords: Record<string, string>; // Secured passwords
  deletedUserIds?: string[];
  deletedTripIds?: string[];
  deletedBookingIds?: string[];
}

class TransitStore {
  private data: StoredData;
  private currentUser: User | null = null;
  private listeners: Set<() => void> = new Set();
  private isSyncing = false;
  private activePresence: ActivePresence[] = [];
  private sessionId: string;
  private deviceType: 'mobile' | 'tablet' | 'desktop' = 'mobile';
  private deviceName: string = 'هاتف ذكي';
  private sseEventSource: EventSource | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private isSupabaseConnected = false;

  public getApiBaseUrl(): string {
    return CLOUD_RUN_BACKEND_URL;
  }

  public getSupabaseStatus(): { isConfigured: boolean; isConnected: boolean; url: string } {
    const cfg = getSupabaseConfig();
    return {
      isConfigured: cfg.isConfigured,
      isConnected: this.isSupabaseConnected,
      url: cfg.url
    };
  }

  constructor() {
    const dev = this.detectDevice();
    this.deviceType = dev.deviceType;
    this.deviceName = dev.deviceName;
    this.sessionId = this.initSessionId();

    this.data = this.loadData();
    this.currentUser = this.loadAuth();
    
    // 1. Initialize Supabase Realtime & WebSockets (Vercel & Multi-device primary sync)
    this.initRealtimeSupabase();

    // 2. Fallbacks: Cloud Run / local server sync & SSE
    this.syncWithServer();
    this.sendPresenceHeartbeat();
    this.initRealtimeSse();

    if (typeof window !== 'undefined') {
      // 5s heartbeat to refresh presence across all connected devices
      setInterval(() => {
        this.sendPresenceHeartbeat();
      }, 5000);

      // Periodic state sync
      setInterval(() => {
        this.syncWithServer();
      }, 6000);

      window.addEventListener('beforeunload', () => {
        if (this.supabaseChannel && this.isSupabaseConnected) {
          try {
            this.supabaseChannel.untrack();
          } catch {}
        }
        try {
          navigator.sendBeacon(`${this.getApiBaseUrl()}/api/transit/presence/leave`, JSON.stringify({ sessionId: this.sessionId }));
        } catch {}
      });
    }
  }

  private detectDevice(): { deviceType: 'mobile' | 'tablet' | 'desktop'; deviceName: string } {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { deviceType: 'desktop', deviceName: 'متصفح ويب' };
    }
    const ua = navigator.userAgent || '';
    const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(ua);
    const isMobile = /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(ua);

    const deviceType: 'mobile' | 'tablet' | 'desktop' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
    let deviceName = 'جهاز متصل';

    if (/iPhone/i.test(ua)) {
      deviceName = 'آيفون (Apple iPhone) 📱';
    } else if (/iPad/i.test(ua)) {
      deviceName = 'آيباد (Apple iPad) 📟';
    } else if (/Android/i.test(ua)) {
      deviceName = isTablet ? 'تابلت أندرويد (Tablet) 📟' : 'جوال أندرويد (Android) 📱';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      deviceName = 'كمبيوتر ماك (Mac) 💻';
    } else if (/Windows/i.test(ua)) {
      deviceName = 'كمبيوتر ويندوز (PC) 💻';
    } else if (/Linux/i.test(ua)) {
      deviceName = 'كمبيوتر لينكس (Linux) 💻';
    } else {
      deviceName = isMobile ? 'هاتف ذكي 📱' : 'كمبيوتر متصفح 💻';
    }

    return { deviceType, deviceName };
  }

  private initSessionId(): string {
    if (typeof window === 'undefined') return `ses-${Date.now()}`;
    try {
      let sid = sessionStorage.getItem('al_ahsa_session_id');
      if (!sid) {
        sid = `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem('al_ahsa_session_id', sid);
      }
      return sid;
    } catch {
      return `ses-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }
  }

  public async initRealtimeSupabase() {
    if (typeof window === 'undefined') return;
    const supabase = getSupabase();
    if (!supabase) {
      console.info('Supabase: Keys not detected or invalid, operating in local/fallback mode.');
      return;
    }

    try {
      if (this.supabaseChannel) {
        try {
          await supabase.removeChannel(this.supabaseChannel);
        } catch {}
        this.supabaseChannel = null;
      }

      // Step 1: Immediately sync with Supabase Postgres DB tables
      await this.syncWithSupabase();

      const channel = supabase.channel('al-ahsa-transit-live', {
        config: {
          presence: { key: this.sessionId },
          broadcast: { self: false }
        }
      });

      // 1. Presence Sync & Tracking across all connected phones and desktops
      channel.on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState();
          const list: ActivePresence[] = [];
          Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
              presences.forEach((p: any) => {
                if (p && p.sessionId) {
                  list.push({
                    sessionId: p.sessionId,
                    userId: p.userId,
                    userName: p.userName || 'مستخدم متصل',
                    role: p.role || 'visitor',
                    deviceType: p.deviceType || 'mobile',
                    deviceName: p.deviceName || 'جهاز متصل',
                    activeTripId: p.activeTripId,
                    coords: p.coords,
                    statusText: p.statusText,
                    isOnline: true,
                    lastSeen: p.lastSeen || new Date().toISOString()
                  });
                }
              });
            }
          });
          if (list.length > 0) {
            this.activePresence = list;
            this.notify();
          }
        } catch (e) {
          console.warn('Supabase presence sync error:', e);
        }
      });

      // 2. Realtime Broadcast: State Update (live sync across all devices)
      channel.on('broadcast', { event: 'state_update' }, ({ payload }: { payload: any }) => {
        if (payload?.state) {
          const changed = this.mergeRemoteState(payload.state);
          if (changed) this.notify();
        }
      });

      // 3. Realtime Broadcast: State Sync Request (when another device joins)
      channel.on('broadcast', { event: 'request_state_sync' }, ({ payload }: { payload: any }) => {
        if (payload?.requesterSessionId && payload.requesterSessionId !== this.sessionId) {
          this.broadcastStateToSupabase(this.data);
        }
      });

      // 4. Realtime Broadcast: Driver GPS Telemetry Stream
      channel.on('broadcast', { event: 'driver_gps' }, ({ payload }: { payload: any }) => {
        if (payload?.tripId && payload?.currentLocation) {
          const trip = this.data.trips.find(t => t.id === payload.tripId);
          if (trip) {
            trip.currentLocation = payload.currentLocation;
            if (trip.status !== 'in_progress') trip.status = 'in_progress';
            this.notify();
          }
        }
      });

      // 5. Realtime Broadcast: User Deleted (Tombstone enforcement)
      channel.on('broadcast', { event: 'user_deleted' }, ({ payload }: { payload: any }) => {
        if (payload?.userId) {
          this.handleRemoteUserDeleted(payload.userId, payload.deletedTripIds);
        }
      });

      // 6. Realtime Broadcast: Trip Deleted (Tombstone enforcement)
      channel.on('broadcast', { event: 'trip_deleted' }, ({ payload }: { payload: any }) => {
        if (payload?.tripId) {
          this.handleRemoteTripDeleted(payload.tripId);
        }
      });

      // 7. Realtime Broadcast: User Registered
      channel.on('broadcast', { event: 'user_registered' }, ({ payload }: { payload: any }) => {
        if (payload?.user) {
          this.handleRemoteUserRegistered(payload.user, payload.password);
        }
      });

      // 8. Postgres Database Realtime: Listen to direct table updates
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transit_state' },
          (payload: any) => {
            if (payload?.new && (payload.new as any).data) {
              const changed = this.mergeRemoteState((payload.new as any).data);
              if (changed) this.notify();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transit_users' },
          (payload: any) => {
            if (payload?.eventType === 'INSERT' || payload?.eventType === 'UPDATE') {
              if (payload?.new) {
                const dbU = payload.new;
                const u: User = {
                  id: dbU.id,
                  name: dbU.name,
                  phone: dbU.phone,
                  email: dbU.email,
                  role: dbU.role,
                  status: dbU.status || 'active',
                  busDetails: dbU.bus_details || undefined,
                  createdAt: dbU.created_at || new Date().toISOString()
                };
                this.handleRemoteUserRegistered(u, dbU.password);
              }
            } else if (payload?.eventType === 'DELETE') {
              if (payload?.old?.id) {
                this.handleRemoteUserDeleted(payload.old.id);
              }
            }
          }
        );

      // Subscribe to Supabase Realtime Channel
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isSupabaseConnected = true;
          this.supabaseChannel = channel;
          await this.trackSupabasePresence();
          channel.send({
            type: 'broadcast',
            event: 'request_state_sync',
            payload: { requesterSessionId: this.sessionId }
          });
          this.notify();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.isSupabaseConnected = false;
          this.notify();
        }
      });
    } catch (err) {
      console.warn('Could not initialize Supabase Realtime channel:', err);
    }
  }

  public async syncWithSupabase() {
    try {
      let hasChanges = false;

      // 1. Fetch State Snapshot from 'transit_state' table
      const stateSnapshot = await fetchStateFromSupabaseDb();
      if (stateSnapshot && Array.isArray(stateSnapshot.users)) {
        if (this.mergeRemoteState(stateSnapshot)) {
          hasChanges = true;
        }
      }

      // 2. Fetch Users from 'transit_users' table
      const dbUsers = await fetchAllUsersFromSupabaseDb();
      if (Array.isArray(dbUsers) && dbUsers.length > 0) {
        dbUsers.forEach((dbU: any) => {
          if (!this.data.deletedUserIds?.includes(dbU.id)) {
            const mappedUser: User = {
              id: dbU.id,
              name: dbU.name,
              phone: dbU.phone,
              email: dbU.email,
              role: dbU.role,
              status: dbU.status || 'active',
              busDetails: dbU.bus_details || undefined,
              createdAt: dbU.created_at || new Date().toISOString()
            };
            const existing = this.data.users.find(u => u.id === mappedUser.id);
            if (!existing) {
              this.data.users.push(mappedUser);
              hasChanges = true;
            } else if (existing.status !== mappedUser.status || existing.name !== mappedUser.name) {
              Object.assign(existing, mappedUser);
              hasChanges = true;
            }
            if (dbU.password && mappedUser.email) {
              this.data.passwords[mappedUser.email.toLowerCase()] = dbU.password;
            }
            if (dbU.password && mappedUser.phone) {
              this.data.passwords[mappedUser.phone.trim()] = dbU.password;
            }
          }
        });
      }

      // 3. Reconcile Current User Session Persistence
      if (this.currentUser) {
        const freshUser = this.data.users.find(u => u.id === this.currentUser?.id);
        if (freshUser) {
          if (freshUser.status !== this.currentUser.status || freshUser.name !== this.currentUser.name) {
            this.currentUser = freshUser;
            this.saveAuth(freshUser);
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch {}
        this.notify();
      }
    } catch (e) {
      console.warn('syncWithSupabase warning:', e);
    }
  }

  private async trackSupabasePresence(statusText?: string) {
    if (!this.supabaseChannel || !this.isSupabaseConnected) return;
    try {
      const user = this.currentUser;
      const activeTrip = user?.role === 'driver'
        ? this.data.trips.find(t => t.driverId === user.id && t.status === 'in_progress')
        : null;

      await this.supabaseChannel.track({
        sessionId: this.sessionId,
        userId: user?.id,
        userName: user?.name || 'زائر في الأحساء',
        role: user?.role || 'visitor',
        deviceType: this.deviceType,
        deviceName: this.deviceName,
        activeTripId: activeTrip?.id,
        coords: activeTrip?.currentLocation ? { lat: activeTrip.currentLocation.lat, lng: activeTrip.currentLocation.lng } : undefined,
        statusText: statusText || (activeTrip ? `يقود رحلة (${activeTrip.routeName}) 🚌` : user?.role === 'driver' ? 'كابتن متصل ومتاح 🟢' : user?.role === 'admin' ? 'إدارة العمليات 🛡️' : 'متصل بالمنصة 🟢'),
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });
    } catch {}
  }

  private broadcastStateToSupabase(data: StoredData) {
    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'state_update',
          payload: { state: data }
        });
      } catch {}
    }
    // Save to Supabase 'transit_state' database table
    saveStateToSupabaseDb(data);
  }

  private handleRemoteUserRegistered(user: User, pass?: string) {
    if (!user || !user.id) return;
    if (this.data.deletedUserIds?.includes(user.id)) return;
    const existingIndex = this.data.users.findIndex(u => u.id === user.id);
    if (existingIndex >= 0) {
      this.data.users[existingIndex] = user;
    } else {
      this.data.users.push(user);
    }
    if (pass && user.email) {
      this.data.passwords[user.email.toLowerCase()] = pass;
    }
    if (pass && user.phone) {
      this.data.passwords[user.phone.trim()] = pass;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
    this.notify();
  }

  private initRealtimeSse() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      if (this.sseEventSource) {
        this.sseEventSource.close();
      }
      this.sseEventSource = new EventSource(`${this.getApiBaseUrl()}/api/transit/events`);

      this.sseEventSource.addEventListener('init', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.presence && Array.isArray(payload.presence)) {
            this.activePresence = payload.presence;
          }
          if (payload.state) {
            this.mergeRemoteState(payload.state);
          }
          this.notify();
        } catch {}
      });

      this.sseEventSource.addEventListener('presence', (e: MessageEvent) => {
        try {
          const presence = JSON.parse(e.data);
          if (Array.isArray(presence)) {
            this.activePresence = presence;
            this.notify();
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('state', (e: MessageEvent) => {
        try {
          const state = JSON.parse(e.data);
          const changed = this.mergeRemoteState(state);
          if (changed) this.notify();
        } catch {}
      });

      this.sseEventSource.addEventListener('gps', (e: MessageEvent) => {
        try {
          const { tripId, currentLocation } = JSON.parse(e.data);
          if (tripId && currentLocation) {
            const trip = this.data.trips.find(t => t.id === tripId);
            if (trip) {
              trip.currentLocation = currentLocation;
              if (trip.status !== 'in_progress') trip.status = 'in_progress';
              this.notify();
            }
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('user:deleted', (e: MessageEvent) => {
        try {
          const { userId, deletedTripIds } = JSON.parse(e.data);
          if (userId) {
            this.handleRemoteUserDeleted(userId, deletedTripIds);
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('trip:deleted', (e: MessageEvent) => {
        try {
          const { tripId } = JSON.parse(e.data);
          if (tripId) {
            this.handleRemoteTripDeleted(tripId);
          }
        } catch {}
      });

      this.sseEventSource.addEventListener('login', (_e: MessageEvent) => {
        this.syncWithServer();
      });

      this.sseEventSource.onerror = () => {
        // EventSource automatically handles reconnection
      };
    } catch (err) {
      console.warn('Could not initialize SSE stream:', err);
    }
  }

  private handleRemoteUserDeleted(userId: string, deletedTripIds?: string[]) {
    if (!this.data.deletedUserIds) this.data.deletedUserIds = [];
    if (!this.data.deletedUserIds.includes(userId)) this.data.deletedUserIds.push(userId);
    this.data.users = this.data.users.filter(u => u.id !== userId);

    if (Array.isArray(deletedTripIds)) {
      if (!this.data.deletedTripIds) this.data.deletedTripIds = [];
      deletedTripIds.forEach(tId => {
        if (!this.data.deletedTripIds!.includes(tId)) this.data.deletedTripIds!.push(tId);
      });
      this.data.trips = this.data.trips.filter(t => !deletedTripIds.includes(t.id));
      this.data.bookings = this.data.bookings.filter(b => b.passengerId !== userId && !deletedTripIds.includes(b.tripId));
    }

    if (this.currentUser?.id === userId) {
      this.logout();
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
    this.notify();
  }

  private handleRemoteTripDeleted(tripId: string) {
    if (!this.data.deletedTripIds) this.data.deletedTripIds = [];
    if (!this.data.deletedTripIds.includes(tripId)) this.data.deletedTripIds.push(tripId);
    this.data.trips = this.data.trips.filter(t => t.id !== tripId);
    this.data.bookings = this.data.bookings.filter(b => b.tripId !== tripId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
    this.notify();
  }

  public async sendPresenceHeartbeat(statusText?: string) {
    if (typeof window === 'undefined') return;
    // 1. Supabase Realtime presence broadcast
    await this.trackSupabasePresence(statusText);

    // 2. HTTP Server heartbeat fallback
    try {
      const user = this.currentUser;
      const activeTrip = user?.role === 'driver'
        ? this.data.trips.find(t => t.driverId === user.id && t.status === 'in_progress')
        : null;

      const res = await fetch(`${this.getApiBaseUrl()}/api/transit/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          userId: user?.id,
          userName: user?.name || 'زائر في الأحساء',
          role: user?.role || 'visitor',
          deviceType: this.deviceType,
          deviceName: this.deviceName,
          activeTripId: activeTrip?.id,
          coords: activeTrip?.currentLocation ? { lat: activeTrip.currentLocation.lat, lng: activeTrip.currentLocation.lng } : undefined,
          statusText: statusText || (activeTrip ? `يقود رحلة (${activeTrip.routeName}) 🚌` : user?.role === 'driver' ? 'كابتن متصل ومتاح 🟢' : user?.role === 'admin' ? 'إدارة العمليات 🛡️' : 'متصل بالمنصة 🟢')
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.activePresence && Array.isArray(json.activePresence) && (!this.supabaseChannel || !this.isSupabaseConnected)) {
          this.activePresence = json.activePresence;
          this.notify();
        }
      }
    } catch {}
  }

  private lastBroadcastStamp = 0;

  public async pushRegistration(user: User, pass?: string) {
    if (typeof window === 'undefined') return;

    // 1. Direct write into Supabase Database 'transit_users' table
    await saveUserToSupabaseDb(user, pass);

    // 2. Immediate broadcast to all connected devices via Supabase Realtime
    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'user_registered',
          payload: { user, password: pass }
        });
        this.broadcastStateToSupabase(this.data);
      } catch {}
    } else {
      this.broadcastStateToSupabase(this.data);
    }
  }

  public async broadcastDriverGps(
    tripId: string,
    lat: number,
    lng: number,
    speed?: number | null,
    heading?: number | null,
    accuracy?: number | null,
    driverId?: string
  ) {
    const now = Date.now();
    // 1. Update trip location locally immediately
    const trip = this.data.trips.find(t => t.id === tripId);
    const speedKmh = typeof speed === 'number' && !isNaN(speed) ? Math.max(0, Math.round(speed)) : (trip?.currentLocation?.speed ?? 0);
    const headingDeg = typeof heading === 'number' && !isNaN(heading) ? Math.round(heading) : (trip?.currentLocation?.heading ?? 0);
    const accuracyM = typeof accuracy === 'number' && !isNaN(accuracy) ? Math.round(accuracy) : 5;

    const newLocation = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      speed: speedKmh,
      heading: headingDeg,
      accuracy: accuracyM,
      lastUpdated: new Date().toISOString()
    };

    if (trip) {
      trip.currentLocation = newLocation;
      if (trip.status !== 'in_progress') {
        trip.status = 'in_progress';
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch {}
      this.notify();
    }

    // 2. Broadcast via Supabase Realtime WebSockets to all connected phones and passenger maps
    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'driver_gps',
          payload: { tripId, currentLocation: newLocation }
        });
      } catch {}
    }
    this.trackSupabasePresence();

    // Throttle network HTTP broadcast to at most once per 2 seconds to keep mobile responsive
    if (now - this.lastBroadcastStamp < 2000) {
      return;
    }
    this.lastBroadcastStamp = now;

    // 3. Transmit to HTTP server fallback
    if (typeof window !== 'undefined') {
      try {
        await fetch(`${this.getApiBaseUrl()}/api/transit/driver-gps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            driverId: driverId || trip?.driverId || this.currentUser?.id,
            lat,
            lng,
            speed: speedKmh,
            heading: headingDeg,
            accuracy: accuracyM
          })
        });
      } catch (e) {
        // offline fallback
      }
    }
  }

  public async purgeMockData(): Promise<void> {
    try {
      await fetch(`${this.getApiBaseUrl()}/api/transit/purge-mock-data`, { method: 'POST' });
    } catch {}

    const bannedUsers = ['usr-driver-1', 'usr-driver-2', 'usr-pass-1', 'usr-drv-test'];
    if (!this.data.deletedUserIds) this.data.deletedUserIds = [];
    bannedUsers.forEach(id => {
      if (!this.data.deletedUserIds!.includes(id)) this.data.deletedUserIds!.push(id);
    });

    // Clean local data permanently
    this.data.users = this.data.users.filter(
      u => !u.id.startsWith('usr-driver-') && !u.id.startsWith('usr-pass-') && u.email !== 'fahad@driver.sa' && u.email !== 'ali@driver.sa' && !this.data.deletedUserIds!.includes(u.id)
    );
    this.data.trips = this.data.trips.filter(
      t => t.driverId !== 'usr-driver-1' && t.driverId !== 'usr-driver-2' && !this.data.deletedUserIds!.includes(t.driverId)
    );
    delete this.data.passwords['fahad@driver.sa'];
    delete this.data.passwords['ali@driver.sa'];

    this.saveData(this.data);
    await this.syncWithServer();
  }

  private async pushToServer(data: StoredData) {
    if (typeof window === 'undefined') return;
    try {
      await fetch(`${this.getApiBaseUrl()}/api/transit/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      // offline fallback
    }
  }

  public mergeRemoteState(serverData: StoredData): boolean {
    if (!serverData || !Array.isArray(serverData.users)) return false;

    // Consolidate tombstones from server and local
    const tombstoneUsers = new Set<string>([
      ...(this.data.deletedUserIds || []),
      ...(serverData.deletedUserIds || [])
    ]);
    const tombstoneTrips = new Set<string>([
      ...(this.data.deletedTripIds || []),
      ...(serverData.deletedTripIds || [])
    ]);
    const tombstoneBookings = new Set<string>([
      ...(this.data.deletedBookingIds || []),
      ...(serverData.deletedBookingIds || [])
    ]);

    this.data.deletedUserIds = Array.from(tombstoneUsers);
    this.data.deletedTripIds = Array.from(tombstoneTrips);
    this.data.deletedBookingIds = Array.from(tombstoneBookings);

    // If current logged in user has been banned/deleted, log out immediately
    if (this.currentUser && tombstoneUsers.has(this.currentUser.id)) {
      this.logout();
    }

    let hasChanges = false;

    // Merge users - strictly omitting any deleted user, mock IDs, or mock emails
    const userMap = new Map<string, User>();
    this.data.users.forEach(u => {
      if (!tombstoneUsers.has(u.id) && !u.id.startsWith('usr-driver-') && !u.id.startsWith('usr-pass-')) {
        userMap.set(u.id, u);
      }
    });
    serverData.users.forEach(u => {
      if (!tombstoneUsers.has(u.id) && !u.id.startsWith('usr-driver-') && !u.id.startsWith('usr-pass-') && u.email !== 'fahad@driver.sa' && u.email !== 'ali@driver.sa') {
        const old = userMap.get(u.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(u)) {
          hasChanges = true;
        }
        userMap.set(u.id, u);
      }
    });
    const mergedUsers = Array.from(userMap.values());

    // Merge passwords
    const mergedPasswords = {
      ...this.data.passwords,
      ...(serverData.passwords || {})
    };
    delete mergedPasswords['fahad@driver.sa'];
    delete mergedPasswords['ali@driver.sa'];

    // Merge trips - strictly omitting any tombstoned trips or deleted drivers
    const tripMap = new Map<string, Trip>();
    this.data.trips.forEach(t => {
      if (!tombstoneTrips.has(t.id) && !tombstoneUsers.has(t.driverId)) {
        tripMap.set(t.id, t);
      }
    });
    (serverData.trips || []).forEach(t => {
      if (!tombstoneTrips.has(t.id) && !tombstoneUsers.has(t.driverId) && t.driverId !== 'usr-driver-1' && t.driverId !== 'usr-driver-2') {
        const existing = tripMap.get(t.id);
        if (!existing) {
          tripMap.set(t.id, t);
          hasChanges = true;
        } else {
          const existingTime = new Date(existing.currentLocation?.lastUpdated || 0).getTime();
          const serverTime = new Date(t.currentLocation?.lastUpdated || 0).getTime();
          if (serverTime >= existingTime || existing.status !== t.status || existing.availableSeats !== t.availableSeats) {
            tripMap.set(t.id, t);
            hasChanges = true;
          }
        }
      }
    });
    const mergedTrips = Array.from(tripMap.values());

    // Merge bookings - strictly omitting tombstoned bookings or deleted passengers/trips
    const bookingMap = new Map<string, Booking>();
    this.data.bookings.forEach(b => {
      if (!tombstoneBookings.has(b.id) && !tombstoneUsers.has(b.passengerId) && !tombstoneTrips.has(b.tripId)) {
        bookingMap.set(b.id, b);
      }
    });
    (serverData.bookings || []).forEach(b => {
      if (!tombstoneBookings.has(b.id) && !tombstoneUsers.has(b.passengerId) && !tombstoneTrips.has(b.tripId)) {
        const old = bookingMap.get(b.id);
        if (!old || old.status !== b.status) {
          hasChanges = true;
        }
        bookingMap.set(b.id, b);
      }
    });
    const mergedBookings = Array.from(bookingMap.values());

    // Merge tickets & announcement
    const mergedTickets = serverData.tickets || this.data.tickets;
    const mergedAnnouncement = serverData.announcement || this.data.announcement;

    if (hasChanges || this.data.users.length !== mergedUsers.length || this.data.trips.length !== mergedTrips.length) {
      this.data = {
        ...this.data,
        users: mergedUsers,
        passwords: mergedPasswords,
        trips: mergedTrips,
        bookings: mergedBookings,
        tickets: mergedTickets,
        announcement: mergedAnnouncement,
        deletedUserIds: Array.from(tombstoneUsers),
        deletedTripIds: Array.from(tombstoneTrips),
        deletedBookingIds: Array.from(tombstoneBookings)
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch {}

      // Sync current user status if updated remotely
      if (this.currentUser) {
        const freshUser = this.data.users.find(u => u.id === this.currentUser?.id);
        if (freshUser && (freshUser.status !== this.currentUser.status || freshUser.name !== this.currentUser.name)) {
          this.currentUser = freshUser;
          try {
            localStorage.setItem(AUTH_KEY, JSON.stringify(freshUser));
          } catch {}
        }
      }
      return true;
    }
    return false;
  }

  public async syncWithServer() {
    if (typeof window === 'undefined' || this.isSyncing) return;
    this.isSyncing = true;
    try {
      // 1. Authoritative Supabase Database Sync
      await this.syncWithSupabase();

      // 2. Optional non-blocking HTTP server fallback
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${this.getApiBaseUrl()}/api/transit/state`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const json = await res.json();
          if (json.activePresence && Array.isArray(json.activePresence) && (!this.supabaseChannel || !this.isSupabaseConnected)) {
            this.activePresence = json.activePresence;
          }
          if (json.success && json.data && Array.isArray(json.data.users)) {
            const changed = this.mergeRemoteState(json.data);
            if (changed) {
              this.notify();
            }
          }
        }
      } catch {}
    } finally {
      this.isSyncing = false;
    }
  }

  // --- Real-time Presence Getters for UI across all devices ---
  public getActivePresence(): ActivePresence[] {
    return this.activePresence;
  }

  public getOnlineDrivers(): ActivePresence[] {
    return this.activePresence.filter(p => p.role === 'driver');
  }

  public getOnlinePassengers(): ActivePresence[] {
    return this.activePresence.filter(p => p.role === 'passenger');
  }

  public getOnlineAdmins(): ActivePresence[] {
    return this.activePresence.filter(p => p.role === 'admin');
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    return this.deviceType;
  }

  private loadData(): StoredData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed.deletedUserIds)) parsed.deletedUserIds = [];
        if (!Array.isArray(parsed.deletedTripIds)) parsed.deletedTripIds = [];
        if (!Array.isArray(parsed.deletedBookingIds)) parsed.deletedBookingIds = [];

        if (Array.isArray(parsed.users)) {
          // Purge mock drivers, mock passengers, and deleted users
          parsed.users = parsed.users.filter(
            (u: User) =>
              !u.id.startsWith('usr-driver-') &&
              !u.id.startsWith('usr-pass-') &&
              u.email !== 'fahad@driver.sa' &&
              u.email !== 'ali@driver.sa' &&
              !parsed.deletedUserIds.includes(u.id)
          );
          parsed.users.forEach((u: User) => {
            if (u.name && u.name.includes('سلمان')) {
              u.name = 'مسؤول إدارة العمليات';
            }
          });
          // Ensure admin user exists
          INITIAL_USERS.forEach(initU => {
            if (!parsed.users.some((u: User) => u.id === initU.id)) {
              parsed.users.push(initU);
            }
          });
        }
        if (Array.isArray(parsed.trips)) {
          parsed.trips = parsed.trips.filter(
            (t: Trip) =>
              t.driverId !== 'usr-driver-1' &&
              t.driverId !== 'usr-driver-2' &&
              !parsed.deletedTripIds.includes(t.id) &&
              !parsed.deletedUserIds.includes(t.driverId)
          );
        } else {
          parsed.trips = [];
        }
        if (Array.isArray(parsed.bookings)) {
          parsed.bookings = parsed.bookings.filter(
            (b: Booking) =>
              !parsed.deletedBookingIds.includes(b.id) &&
              !parsed.deletedUserIds.includes(b.passengerId) &&
              !parsed.deletedTripIds.includes(b.tripId)
          );
        } else {
          parsed.bookings = [];
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using clean initial data');
    }

    const defaultPasswords: Record<string, string> = {
      'admin@hasa-bus.sa': 'admin123'
    };

    const initialData: StoredData = {
      users: INITIAL_USERS,
      stations: INITIAL_STATIONS,
      routes: INITIAL_ROUTES,
      trips: [],
      bookings: INITIAL_BOOKINGS,
      tickets: INITIAL_SUPPORT_TICKETS,
      announcement: INITIAL_ANNOUNCEMENT,
      passwords: defaultPasswords,
      deletedUserIds: [],
      deletedTripIds: [],
      deletedBookingIds: []
    };

    this.saveData(initialData);
    return initialData;
  }

  private saveData(data: StoredData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage');
    }
    this.notify();
    this.broadcastStateToSupabase(data);
    this.pushToServer(data);
  }

  private loadAuth(): User | null {
    if (typeof window === 'undefined') return null;
    try {
      // 1. Check persistent long-term session storage
      let raw = localStorage.getItem(PERSISTENT_SESSION_KEY);
      if (!raw) {
        raw = localStorage.getItem(AUTH_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        const userObj: User = parsed.user || parsed;
        if (userObj && userObj.id) {
          if (userObj.name && userObj.name.includes('سلمان')) {
            userObj.name = 'مسؤول إدارة العمليات';
          }
          // Do not log out if not tombstoned
          const isTombstoned = (this.data.deletedUserIds || []).includes(userObj.id);
          if (!isTombstoned) {
            const existing = this.data.users.find(u => u.id === userObj.id);
            if (!existing) {
              this.data.users.push(userObj);
            }
            return existing || userObj;
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  private saveAuth(user: User | null) {
    this.currentUser = user;
    if (typeof window !== 'undefined') {
      if (user) {
        const persistentPayload = {
          user,
          sessionId: this.sessionId,
          loggedInAt: new Date().toISOString(),
          persistent: true
        };
        localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(persistentPayload));
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(PERSISTENT_SESSION_KEY);
        localStorage.removeItem(AUTH_KEY);
      }
    }
    this.notify();
    this.sendPresenceHeartbeat(user ? `متصل الآن كـ ${user.role === 'driver' ? 'سائق حافلة 🚌' : user.role === 'admin' ? 'إدارة 🛡️' : 'راكب 👤'}` : 'زائر');
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  // Real-time Bus GPS update from physical device
  public updateRealDeviceLocation(tripId: string, lat: number, lng: number, speed?: number, heading?: number, accuracy?: number) {
    this.broadcastDriverGps(tripId, lat, lng, speed, heading, accuracy);
  }


  public registerAdmin(name: string, phone: string, email: string, pass: string): { success: boolean; user?: User; error?: string } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !pass) {
      return { success: false, error: 'يرجى تعبئة كافة الحقول المطلوبة بما في ذلك اسم مسؤول الإدارة' };
    }

    const existing = this.data.users.find(
      u => u.email.toLowerCase() === cleanEmail || u.phone.trim() === cleanPhone
    );

    if (existing) {
      if (existing.role === 'admin') {
        return { success: false, error: 'يوجد حساب إدارة مسجل مسبقاً بهذا البريد أو الجوال' };
      }
      return { success: false, error: 'هذا البريد أو رقم الجوال مسجل مسبقاً بحساب آخر' };
    }

    const newAdmin: User = {
      id: `usr-admin-${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newAdmin);
    this.data.passwords[cleanEmail] = pass.trim();
    this.data.passwords[cleanPhone] = pass.trim();
    this.saveData(this.data);
    this.saveAuth(newAdmin);
    this.pushRegistration(newAdmin, pass.trim());

    return { success: true, user: newAdmin };
  }

  public updateAdminName(userId: string, newName: string): { success: boolean; error?: string } {
    const cleanName = newName.trim();
    if (!cleanName) return { success: false, error: 'يرجى إدخال اسم صحيح' };
    const user = this.data.users.find(u => u.id === userId || (u.role === 'admin' && this.currentUser?.role === 'admin'));
    if (!user) return { success: false, error: 'حساب الإدارة غير موجود' };
    user.name = cleanName;
    if (this.currentUser && (this.currentUser.id === user.id || this.currentUser.role === 'admin')) {
      this.currentUser.name = cleanName;
      this.saveAuth(this.currentUser);
    }
    this.saveData(this.data);
    return { success: true };
  }

  // ---------------- AUTHENTICATION ----------------
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  public async loginAsync(identifier: string, pass: string, targetRole?: UserRole): Promise<{ success: boolean; user?: User; error?: string }> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    // 1. Authoritative Supabase Database Verification (Instant Cross-Device Authentication)
    const supabase = getSupabase();
    if (supabase) {
      try {
        // Step A: Check 'transit_users' table
        const dbUser = await findUserInSupabaseDb(identifier);
        if (dbUser) {
          // Role check
          if (targetRole && dbUser.role !== targetRole) {
            const roleName = targetRole === 'admin' ? 'إدارة' : targetRole === 'driver' ? 'سائق' : 'راكب';
            return { success: false, error: `هذا الحساب مسجل كـ (${dbUser.role}) وليس (${roleName})` };
          }

          // Password verification
          const expectedPass = (dbUser.password || '').trim() || (dbUser.id === 'usr-admin' ? 'admin123' : '123456');
          if (expectedPass === cleanPass) {
            const mappedUser: User = {
              id: dbUser.id,
              name: dbUser.name,
              phone: dbUser.phone,
              email: dbUser.email,
              role: dbUser.role,
              status: dbUser.status || 'active',
              busDetails: dbUser.bus_details || undefined,
              createdAt: dbUser.created_at || new Date().toISOString()
            };

            // Pending driver check
            if (mappedUser.role === 'driver' && mappedUser.status === 'pending') {
              return {
                success: false,
                error: 'حسابك كسائق ما زال قيد المراجعة والتدقيق من قبل الإدارة. سيتم تفعيله قريباً.'
              };
            }

            this.handleRemoteUserRegistered(mappedUser, cleanPass);
            this.saveAuth(mappedUser);
            return { success: true, user: mappedUser };
          }
        }

        // Step B: Fetch latest snapshot from 'transit_state' table in Supabase
        const stateSnapshot = await fetchStateFromSupabaseDb();
        if (stateSnapshot && Array.isArray(stateSnapshot.users)) {
          this.mergeRemoteState(stateSnapshot);
        }
      } catch (err) {
        console.warn('Supabase DB login lookup warning:', err);
      }
    }

    // 2. Local memory / offline fallback
    return this.login(identifier, pass, targetRole);
  }

  public login(identifier: string, pass: string, targetRole?: UserRole): { success: boolean; user?: User; error?: string } {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    const user = this.data.users.find(
      u => u.email.toLowerCase() === cleanId || u.phone.trim() === cleanId
    );

    // Unified error message per security requirement
    const UNIFIED_ERROR = 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى';

    if (!user) {
      return { success: false, error: UNIFIED_ERROR };
    }

    const savedPass =
      this.data.passwords[user.email.toLowerCase()] ||
      this.data.passwords[user.phone.trim()] ||
      this.data.passwords[cleanId] ||
      '123456';

    if (savedPass !== cleanPass) {
      return { success: false, error: UNIFIED_ERROR };
    }

    // Role verification
    if (targetRole && user.role !== targetRole) {
      if (targetRole === 'admin') {
        return { success: false, error: 'هذا الحساب ليس لديه صلاحيات الإدارة' };
      }
      if (targetRole === 'driver') {
        return { success: false, error: 'هذا الحساب ليس مسجلاً كسائق' };
      }
    }

    // Pending driver check
    if (user.role === 'driver' && user.status === 'pending') {
      return {
        success: false,
        error: 'حسابك كسائق ما زال قيد المراجعة والتدقيق من قبل الإدارة. سيتم تفعيله قريباً.'
      };
    }

    if (user.status === 'rejected') {
      return { success: false, error: 'تم رفض طلب هذا الحساب من قبل الإدارة' };
    }

    this.saveAuth(user);
    return { success: true, user };
  }

  public logout() {
    if (typeof window !== 'undefined') {
      try {
        fetch('/api/transit/presence/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionId })
        });
      } catch {}
    }
    this.saveAuth(null);
  }

  // Quick switch for demo testing
  public switchUser(userId: string) {
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      this.saveAuth(user);
    }
  }

  public registerPassenger(name: string, phone: string, email: string, pass: string): { success: boolean; user?: User; error?: string } {
    if (!name || !phone || !pass) {
      return { success: false, error: 'جميع الحقول مطلوبة' };
    }

    const exists = this.data.users.find(u => u.phone === phone || (email && u.email.toLowerCase() === email.toLowerCase()));
    if (exists) {
      return { success: false, error: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً' };
    }

    const newUser: User = {
      id: `usr-p-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim() : `${phone}@hasa-bus.sa`,
      role: 'passenger',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    this.data.passwords[newUser.email.toLowerCase()] = pass.trim();
    this.data.passwords[newUser.phone.trim()] = pass.trim();
    this.saveData(this.data);
    this.saveAuth(newUser);
    this.pushRegistration(newUser, pass.trim());

    return { success: true, user: newUser };
  }

  public registerDriver(data: {
    name: string;
    phone: string;
    email: string;
    pass: string;
    plateNumber: string;
    model: string;
    seatsCount: number;
    busType: string;
  }): { success: boolean; user?: User; error?: string } {
    if (!data.name || !data.phone || !data.pass || !data.plateNumber || !data.model) {
      return { success: false, error: 'يرجى استكمال جميع بيانات السائق والحافلة' };
    }

    const exists = this.data.users.find(u => u.phone === data.phone || u.email.toLowerCase() === data.email.toLowerCase());
    if (exists) {
      return { success: false, error: 'رقم الجوال أو البريد الإلكتروني مسجل مسبقاً' };
    }

    const newDriver: User = {
      id: `usr-drv-${Date.now()}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim(),
      role: 'driver',
      status: 'pending', // Strictly pending until admin approval!
      busDetails: {
        plateNumber: data.plateNumber.trim(),
        model: data.model.trim(),
        seatsCount: Number(data.seatsCount) || 20,
        busType: data.busType.trim() || 'حافلة نقل جماعي'
      },
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newDriver);
    this.data.passwords[newDriver.email.toLowerCase()] = data.pass.trim();
    this.data.passwords[newDriver.phone.trim()] = data.pass.trim();
    this.saveData(this.data);
    this.pushRegistration(newDriver, data.pass.trim());

    return { success: true, user: newDriver };
  }

  // ---------------- PASSENGER FEATURES ----------------
  public getAvailableTrips(): Trip[] {
    return this.data.trips.filter(t => {
      // Must not be cancelled or completed
      if (t.status === 'cancelled' || t.status === 'completed') return false;
      return true;
    });
  }

  public bookTrip(tripId: string, dropoffStation: string, dropoffCoords?: { lat: number; lng: number }): {
    success: boolean;
    booking?: Booking;
    error?: string;
  } {
    if (!this.currentUser) {
      return { success: false, error: 'يجب تسجيل الدخول أولاً لإتمام الحجز' };
    }
    if (this.currentUser.role !== 'passenger') {
      return { success: false, error: 'الحجز متاح لحسابات الركاب فقط' };
    }

    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) {
      return { success: false, error: 'الرحلة غير موجودة' };
    }

    // Requirement: Check trip has not started & time has not passed
    const nowTime = new Date().getTime();
    const tripTime = new Date(trip.departureTime).getTime();
    if (trip.status === 'in_progress') {
      return { success: false, error: 'عذراً، انطلقت هذه الرحلة بالفعل ولا يمكن حجزها الآن' };
    }
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return { success: false, error: 'هذه الرحلة ملغية أو منتهية' };
    }
    if (tripTime < nowTime) {
      return { success: false, error: 'فات موعد انطلاق هذه الرحلة' };
    }

    // Requirement: Check for another booking for this passenger within 1 hour difference
    const passengerExistingBookings = this.data.bookings.filter(
      b => b.passengerId === this.currentUser!.id && (b.status === 'confirmed' || b.status === 'boarded')
    );

    for (const b of passengerExistingBookings) {
      const otherTrip = this.data.trips.find(t => t.id === b.tripId);
      if (otherTrip) {
        const otherTime = new Date(otherTrip.departureTime).getTime();
        const diffMinutes = Math.abs(tripTime - otherTime) / (1000 * 60);
        if (diffMinutes < 60) {
          return {
            success: false,
            error: `لديك حجز آخر للرحلة (${otherTrip.routeName}) بفارق زمني أقل من ساعة (${Math.round(diffMinutes)} دقيقة). يشترط وجود فارق ساعة على الأقل بين رحلاتك.`
          };
        }
      }
    }

    // Requirement: Check empty seats & allocate first available seat number
    const activeTripBookings = this.data.bookings.filter(
      b => b.tripId === tripId && b.status !== 'cancelled'
    );
    const occupiedSeats = new Set(activeTripBookings.map(b => b.seatNumber));

    if (occupiedSeats.size >= trip.totalSeats) {
      return { success: false, error: 'عذراً، هذه الرحلة ممتلئة بالكامل ولا توجد مقاعد شاغرة' };
    }

    let firstFreeSeat = 1;
    while (firstFreeSeat <= trip.totalSeats) {
      if (!occupiedSeats.has(firstFreeSeat)) break;
      firstFreeSeat++;
    }

    const newBooking: Booking = {
      id: `bkg-${Date.now()}`,
      tripId: trip.id,
      passengerId: this.currentUser.id,
      passengerName: this.currentUser.name,
      passengerPhone: this.currentUser.phone,
      seatNumber: firstFreeSeat,
      dropoffStation: dropoffStation || 'المحطة الأخيرة',
      dropoffCoordinates: dropoffCoords,
      price: trip.price,
      status: 'confirmed',
      bookedAt: new Date().toISOString()
    };

    this.data.bookings.push(newBooking);

    // Update available seats on trip
    trip.availableSeats = Math.max(0, trip.totalSeats - (occupiedSeats.size + 1));

    this.saveData(this.data);
    return { success: true, booking: newBooking };
  }

  public getMyBookings(): (Booking & { trip?: Trip })[] {
    if (!this.currentUser) return [];
    return this.data.bookings
      .filter(b => b.passengerId === this.currentUser!.id)
      .map(b => ({
        ...b,
        trip: this.data.trips.find(t => t.id === b.tripId)
      }))
      .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime());
  }

  public cancelBooking(bookingId: string): { success: boolean; error?: string } {
    const booking = this.data.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, error: 'الحجز غير موجود' };

    if (this.currentUser && this.currentUser.role === 'passenger' && booking.passengerId !== this.currentUser.id) {
      return { success: false, error: 'غير مصرح لك بإلغاء هذا الحجز' };
    }

    const trip = this.data.trips.find(t => t.id === booking.tripId);
    if (trip && trip.status === 'in_progress') {
      return { success: false, error: 'لا يمكن إلغاء الحجز لرحلة جارية بالفعل' };
    }
    if (booking.status === 'boarded') {
      return { success: false, error: 'تم صعود الحافلة بالفعل ولا يمكن الإلغاء' };
    }

    booking.status = 'cancelled';

    // Recalculate trip available seats
    if (trip) {
      const active = this.data.bookings.filter(b => b.tripId === trip.id && b.status !== 'cancelled').length;
      trip.availableSeats = Math.max(0, trip.totalSeats - active);
    }

    this.saveData(this.data);
    return { success: true };
  }

  // Requirement: Driver determines the route they want, departure time, and publishes it with departure station from their actual physical GPS location!
  public driverLaunchTrip(data: {
    routeId?: string;
    customRoute?: {
      nameAr: string;
      startStationId: string;
      endStationId: string;
      intermediateStationIds?: string[];
      price: number;
      color?: string;
      useCurrentLocationAsStart?: boolean;
    };
    useCurrentLocationAsStart?: boolean;
    customStartStationName?: string;
    departureTime: string;
    price?: number;
    initialCoords?: { lat: number; lng: number; accuracy?: number };
  }): { success: boolean; trip?: Trip; error?: string } {
    if (!this.currentUser) {
      return { success: false, error: 'يجب تسجيل الدخول كسائق أولاً' };
    }
    if (this.currentUser.role !== 'driver') {
      return { success: false, error: 'هذه العملية متاحة لحسابات السائقين فقط' };
    }
    if (this.currentUser.status !== 'active') {
      return { success: false, error: 'حسابك كسائق ما زال قيد المراجعة وبانتظار موافقة الإدارة' };
    }

    const isStartFromGps = Boolean(
      data.useCurrentLocationAsStart ||
      data.customRoute?.startStationId === 'current_location' ||
      data.customRoute?.useCurrentLocationAsStart ||
      data.initialCoords
    );

    let gpsStartStation: TransitStation | undefined;
    if (isStartFromGps && data.initialCoords) {
      const lat = Number(data.initialCoords.lat.toFixed(6));
      const lng = Number(data.initialCoords.lng.toFixed(6));
      const startName = data.customStartStationName || `موقع السائق الفعلي (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      gpsStartStation = {
        id: `st-driver-gps-${Date.now()}`,
        nameAr: startName,
        area: 'نقطة انطلاق السائق الفعلية (GPS)',
        lat,
        lng
      };

      // Add to stations list so it's universally accessible by passengers & map
      if (gpsStartStation) {
        this.data.stations.unshift(gpsStartStation);
      }
    }

    let route: TransitRoute | undefined;

    if (data.customRoute) {
      if (!data.customRoute.nameAr || !data.customRoute.nameAr.trim()) {
        return { success: false, error: 'يرجى إدخال اسم للمسار الذي حددته' };
      }
      if (!data.customRoute.startStationId || !data.customRoute.endStationId) {
        return { success: false, error: 'يرجى تحديد محطة الانطلاق ومحطة الوصول' };
      }
      if (data.customRoute.startStationId !== 'current_location' && data.customRoute.startStationId === data.customRoute.endStationId) {
        return { success: false, error: 'محطة الانطلاق ومحطة الوصول يجب أن تكونا مختلفتين' };
      }

      let selectedStations: TransitStation[] = [];

      if ((data.customRoute.startStationId === 'current_location' || data.useCurrentLocationAsStart) && gpsStartStation) {
        const intermediateStations = (data.customRoute.intermediateStationIds || [])
          .map(id => this.data.stations.find(s => s.id === id))
          .filter((s): s is TransitStation => Boolean(s));
        const endStation = this.data.stations.find(s => s.id === data.customRoute!.endStationId);
        if (!endStation) {
          return { success: false, error: 'تعذر العثور على محطة الوصول المحددة' };
        }
        selectedStations = [gpsStartStation, ...intermediateStations, endStation];
      } else {
        const allIds = [
          data.customRoute.startStationId,
          ...(data.customRoute.intermediateStationIds || []),
          data.customRoute.endStationId
        ];
        selectedStations = allIds
          .map(id => this.data.stations.find(s => s.id === id))
          .filter((s): s is TransitStation => Boolean(s));
      }

      if (selectedStations.length < 2) {
        return { success: false, error: 'تعذر العثور على محطات المسار المحددة' };
      }

      const routePrice = Math.min(8, Math.max(1, data.customRoute.price || 5));
      const newRouteId = `rt-drv-${Date.now()}`;
      const newRouteCode = `D${this.data.routes.length + 1}`;

      const newRoute: TransitRoute = {
        id: newRouteId,
        code: newRouteCode,
        nameAr: data.customRoute.nameAr.trim(),
        color: data.customRoute.color || '#0284c7',
        price: routePrice,
        stations: selectedStations,
        description: `مسار حدده الكابتن ${this.currentUser.name} من ${selectedStations[0].nameAr.split('(')[0]} إلى ${selectedStations[selectedStations.length - 1].nameAr.split('(')[0]}`
      };

      this.data.routes.push(newRoute);
      route = newRoute;
    } else if (data.routeId) {
      const baseRoute = this.data.routes.find(r => r.id === data.routeId);
      if (baseRoute) {
        if ((data.useCurrentLocationAsStart || data.initialCoords) && gpsStartStation) {
          // Adapt the existing route so its departure station is the driver's actual GPS location
          const adaptedRouteId = `rt-drv-gps-${Date.now()}`;
          const adaptedRoute: TransitRoute = {
            ...baseRoute,
            id: adaptedRouteId,
            code: `${baseRoute.code}-GPS`,
            nameAr: `${baseRoute.nameAr} (انطلاق من موقع السائق)`,
            stations: [gpsStartStation, ...baseRoute.stations.filter(s => s.id !== gpsStartStation!.id)],
            description: `انطلاق من موقع السائق الفعلي (${gpsStartStation.lat.toFixed(4)}, ${gpsStartStation.lng.toFixed(4)}) - ${baseRoute.description}`
          };
          this.data.routes.push(adaptedRoute);
          route = adaptedRoute;
        } else {
          route = baseRoute;
        }
      }
    }

    if (!route) {
      return { success: false, error: 'المسار المحدد غير موجود' };
    }

    const price = data.price !== undefined ? Math.min(8, Math.max(1, data.price)) : route.price;
    if (price > 8) {
      return { success: false, error: 'الحد الأقصى للسعر هو 8 ريال سعودي' };
    }

    const busPlate = this.currentUser.busDetails?.plateNumber || 'لوحة قيد التسجيل';
    const busModel = this.currentUser.busDetails?.model || 'حافلة نقل جماعي';
    const totalSeats = this.currentUser.busDetails?.seatsCount || 20;

    const initialLocation = gpsStartStation ? {
      lat: gpsStartStation.lat,
      lng: gpsStartStation.lng,
      speed: 0,
      heading: 0,
      accuracy: data.initialCoords?.accuracy || 5,
      lastUpdated: new Date().toISOString()
    } : (data.initialCoords ? {
      lat: Number(data.initialCoords.lat.toFixed(6)),
      lng: Number(data.initialCoords.lng.toFixed(6)),
      speed: 0,
      heading: 0,
      accuracy: data.initialCoords.accuracy || 5,
      lastUpdated: new Date().toISOString()
    } : (route.stations[0] ? {
      lat: route.stations[0].lat,
      lng: route.stations[0].lng,
      lastUpdated: new Date().toISOString()
    } : undefined));

    const newTrip: Trip = {
      id: `trp-${Date.now()}`,
      routeId: route.id,
      routeName: `مسار ${route.code}: ${route.nameAr}`,
      routeColor: route.color,
      price,
      driverId: this.currentUser.id,
      driverName: this.currentUser.name,
      driverPhone: this.currentUser.phone,
      busPlate,
      busModel,
      totalSeats,
      availableSeats: totalSeats,
      departureTime: data.departureTime,
      status: 'scheduled',
      currentLocation: initialLocation
    };

    this.data.trips.unshift(newTrip);
    this.saveData(this.data);
    return { success: true, trip: newTrip };
  }

  public getDriverTrips(driverId?: string): Trip[] {
    const id = driverId || (this.currentUser?.role === 'driver' ? this.currentUser.id : undefined);
    if (!id) return [];
    return this.data.trips
      .filter(t => t.driverId === id)
      .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
  }

  public getTripPassengers(tripId: string): Booking[] {
    return this.data.bookings.filter(b => b.tripId === tripId && b.status !== 'cancelled');
  }

  public startTrip(tripId: string, initialCoords?: { lat: number; lng: number; speed?: number; heading?: number; accuracy?: number }): { success: boolean; error?: string } {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };

    if (this.currentUser && this.currentUser.role === 'driver' && trip.driverId !== this.currentUser.id) {
      return { success: false, error: 'فقط السائق المكلف بهذه الرحلة يمكنه بدؤها' };
    }

    if (trip.status === 'in_progress') {
      return { success: false, error: 'الرحلة جارية بالفعل' };
    }
    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return { success: false, error: 'لا يمكن بدء رحلة منتهية أو ملغية' };
    }

    trip.status = 'in_progress';
    if (initialCoords && typeof initialCoords.lat === 'number' && typeof initialCoords.lng === 'number') {
      const lat = Number(initialCoords.lat.toFixed(6));
      const lng = Number(initialCoords.lng.toFixed(6));
      trip.currentLocation = {
        lat,
        lng,
        speed: initialCoords.speed || 0,
        heading: initialCoords.heading || 0,
        accuracy: initialCoords.accuracy || 5,
        lastUpdated: new Date().toISOString()
      };

      // Ensure the route departure station coordinates and label reflect this physical location
      const route = this.data.routes.find(r => r.id === trip.routeId);
      if (route && route.stations && route.stations.length > 0) {
        if (route.stations[0].id.includes('gps')) {
          route.stations[0].lat = lat;
          route.stations[0].lng = lng;
          route.stations[0].nameAr = `موقع السائق الفعلي (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        }
      }
    } else if (!trip.currentLocation) {
      trip.currentLocation = {
        lat: 25.3835,
        lng: 49.5862,
        lastUpdated: new Date().toISOString()
      };
    } else {
      trip.currentLocation.lastUpdated = new Date().toISOString();
    }

    this.saveData(this.data);
    if (trip.currentLocation) {
      this.broadcastDriverGps(
        trip.id,
        trip.currentLocation.lat,
        trip.currentLocation.lng,
        trip.currentLocation.speed || 0,
        trip.currentLocation.heading || 0,
        trip.currentLocation.accuracy || 5,
        trip.driverId
      );
    }
    return { success: true };
  }

  public updateBusLocation(tripId: string, lat: number, lng: number): { success: boolean; error?: string } {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };

    if (trip.status !== 'in_progress') {
      return { success: false, error: 'يمكن تحديث الموقع فقط للرحلات الجارية' };
    }

    trip.currentLocation = {
      lat,
      lng,
      lastUpdated: new Date().toISOString()
    };

    this.saveData(this.data);
    return { success: true };
  }

  // Requirement: Confirm Boarding during in_progress trip only & for confirmed booking only
  public confirmBoarding(tripId: string, bookingId: string): { success: boolean; error?: string } {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };

    // Security: Restricted to assigned driver
    if (this.currentUser && this.currentUser.role === 'driver' && trip.driverId !== this.currentUser.id) {
      return { success: false, error: 'تأكيد الصعود مقصور على سائق الرحلة نفسه' };
    }

    // Must be in_progress
    if (trip.status !== 'in_progress') {
      return { success: false, error: 'لا يمكن تأكيد الصعود إلا أثناء الرحلة الجارية' };
    }

    const booking = this.data.bookings.find(b => b.id === bookingId && b.tripId === tripId);
    if (!booking) return { success: false, error: 'بيانات الحجز غير موجودة في هذه الرحلة' };

    if (booking.status !== 'confirmed') {
      return { success: false, error: `لا يمكن تأكيد الصعود لحجز بحالة (${booking.status})` };
    }

    booking.status = 'boarded';
    booking.boardedAt = new Date().toISOString();

    this.saveData(this.data);
    return { success: true };
  }

  // Requirement: Finish Trip -> non-boarded passengers become no_show
  public finishTrip(tripId: string): { success: boolean; error?: string; boardedCount?: number; noShowCount?: number } {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };

    if (this.currentUser && this.currentUser.role === 'driver' && trip.driverId !== this.currentUser.id) {
      return { success: false, error: 'فقط سائق الرحلة يمكنه إنهاؤها' };
    }

    if (trip.status !== 'in_progress') {
      return { success: false, error: 'الرحلة ليست جارية لكي يتم إنهاؤها' };
    }

    trip.status = 'completed';

    let boardedCount = 0;
    let noShowCount = 0;

    // Automatic no_show transition for remaining confirmed bookings
    this.data.bookings.forEach(b => {
      if (b.tripId === tripId) {
        if (b.status === 'confirmed') {
          b.status = 'no_show';
          noShowCount++;
        } else if (b.status === 'boarded') {
          boardedCount++;
        }
      }
    });

    this.saveData(this.data);
    return { success: true, boardedCount, noShowCount };
  }

  // Requirement: Cancel trip -> cancels all its bookings
  public cancelTrip(tripId: string): { success: boolean; error?: string } {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };

    if (
      this.currentUser &&
      this.currentUser.role === 'driver' &&
      trip.driverId !== this.currentUser.id
    ) {
      return { success: false, error: 'فقط سائق هذه الرحلة أو الإدارة يمكنه إلغاؤها' };
    }

    trip.status = 'cancelled';

    this.data.bookings.forEach(b => {
      if (b.tripId === tripId && b.status !== 'boarded') {
        b.status = 'cancelled';
      }
    });

    this.saveData(this.data);
    return { success: true };
  }

  public async deleteTrip(tripId: string): Promise<{ success: boolean; error?: string }> {
    const trip = this.data.trips.find(t => t.id === tripId);
    if (!trip) return { success: false, error: 'الرحلة غير موجودة' };
    if (trip.status === 'in_progress') {
      return { success: false, error: 'لا يمكن حذف رحلة جارية حالياً على الطريق' };
    }

    if (!this.data.deletedTripIds) this.data.deletedTripIds = [];
    if (!this.data.deletedTripIds.includes(tripId)) this.data.deletedTripIds.push(tripId);

    this.data.bookings.forEach(b => {
      if (b.tripId === tripId && b.status !== 'boarded') {
        b.status = 'cancelled';
      }
    });
    this.data.trips = this.data.trips.filter(t => t.id !== tripId);
    this.saveData(this.data);

    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'trip_deleted',
          payload: { tripId }
        });
      } catch {}
    }

    await deleteTripFromSupabaseDb(tripId);

    try {
      await fetch(`${this.getApiBaseUrl()}/api/transit/delete-trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId })
      });
    } catch {}

    return { success: true };
  }

  // ---------------- ADMIN FEATURES ----------------
  public getAdminStats(): AdminStats {
    const totalTrips = this.data.trips.length;
    const totalBookings = this.data.bookings.length;

    // Occupancy rate
    const totalSeats = this.data.trips.reduce((acc, t) => acc + (t.totalSeats || 0), 0);
    const occupiedSeats = this.data.bookings.filter(b => b.status === 'confirmed' || b.status === 'boarded').length;
    const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

    // Revenue strictly from BOARDED passengers!
    const realRevenue = this.data.bookings
      .filter(b => b.status === 'boarded')
      .reduce((sum, b) => sum + (b.price || 0), 0);

    const pendingDrivers = this.data.users.filter(u => u.role === 'driver' && u.status === 'pending').length;
    const activeTripsCount = this.data.trips.filter(t => t.status === 'in_progress').length;

    return {
      totalTrips,
      totalBookings,
      occupancyRate,
      realRevenue,
      pendingDrivers,
      activeTripsCount
    };
  }

  public getDrivers(): User[] {
    return this.data.users.filter(u => u.role === 'driver');
  }

  public approveDriver(driverId: string): { success: boolean; error?: string } {
    const driver = this.data.users.find(u => u.id === driverId && u.role === 'driver');
    if (!driver) return { success: false, error: 'السائق غير موجود' };
    driver.status = 'active';
    this.saveData(this.data);
    return { success: true };
  }

  public rejectDriver(driverId: string): { success: boolean; error?: string } {
    const driver = this.data.users.find(u => u.id === driverId && u.role === 'driver');
    if (!driver) return { success: false, error: 'السائق غير موجود' };
    driver.status = 'rejected';
    this.saveData(this.data);
    return { success: true };
  }

  public updateDriver(driverId: string, updates: {
    name: string;
    phone: string;
    plateNumber: string;
    model: string;
    seatsCount: number;
    busType: string;
  }): { success: boolean; error?: string } {
    const driver = this.data.users.find(u => u.id === driverId && u.role === 'driver');
    if (!driver) return { success: false, error: 'السائق غير موجود' };

    driver.name = updates.name.trim();
    driver.phone = updates.phone.trim();
    driver.busDetails = {
      plateNumber: updates.plateNumber.trim(),
      model: updates.model.trim(),
      seatsCount: Number(updates.seatsCount) || 20,
      busType: updates.busType.trim()
    };

    // Update related trips
    this.data.trips.forEach(t => {
      if (t.driverId === driverId) {
        t.driverName = driver.name;
        t.driverPhone = driver.phone;
        t.busPlate = updates.plateNumber;
        t.busModel = updates.model;
        t.totalSeats = Number(updates.seatsCount) || 20;
      }
    });

    this.saveData(this.data);
    return { success: true };
  }

  // Requirement: Deletion cancels upcoming trips & bookings. Denied if has trip in_progress!
  public async deleteDriver(driverId: string): Promise<{ success: boolean; error?: string }> {
    const hasActiveTrip = this.data.trips.some(t => t.driverId === driverId && t.status === 'in_progress');
    if (hasActiveTrip) {
      return { success: false, error: 'لا يمكن حذف السائق نظراً لوجود رحلة جارية حالياً له على الطريق!' };
    }

    if (!this.data.deletedUserIds) this.data.deletedUserIds = [];
    if (!this.data.deletedUserIds.includes(driverId)) this.data.deletedUserIds.push(driverId);

    // Cancel upcoming trips and bookings
    const cancelledTripIds: string[] = [];
    this.data.trips.forEach(t => {
      if (t.driverId === driverId && t.status === 'scheduled') {
        t.status = 'cancelled';
        cancelledTripIds.push(t.id);
        this.data.bookings.forEach(b => {
          if (b.tripId === t.id && b.status === 'confirmed') {
            b.status = 'cancelled';
          }
        });
      }
    });

    if (!this.data.deletedTripIds) this.data.deletedTripIds = [];
    cancelledTripIds.forEach(tId => {
      if (!this.data.deletedTripIds!.includes(tId)) this.data.deletedTripIds!.push(tId);
    });

    // Remove user
    this.data.users = this.data.users.filter(u => u.id !== driverId);
    this.saveData(this.data);

    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'user_deleted',
          payload: { userId: driverId, deletedTripIds: cancelledTripIds }
        });
      } catch {}
    }

    await deleteUserFromSupabaseDb(driverId);

    try {
      await fetch(`${this.getApiBaseUrl()}/api/transit/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: driverId })
      });
    } catch {}

    return { success: true };
  }

  // Requirement: Admin can view and delete passengers
  public getPassengers(): User[] {
    return this.data.users.filter(u => u.role === 'passenger');
  }

  public async deletePassenger(passengerId: string): Promise<{ success: boolean; error?: string }> {
    const passenger = this.data.users.find(u => u.id === passengerId && u.role === 'passenger');
    if (!passenger) return { success: false, error: 'الراكب غير موجود' };

    if (!this.data.deletedUserIds) this.data.deletedUserIds = [];
    if (!this.data.deletedUserIds.includes(passengerId)) this.data.deletedUserIds.push(passengerId);

    // Cancel active bookings for this passenger
    this.data.bookings.forEach(b => {
      if (b.passengerId === passengerId && (b.status === 'confirmed' || b.status === 'boarded')) {
        b.status = 'cancelled';
      }
    });

    // Remove user
    this.data.users = this.data.users.filter(u => u.id !== passengerId);
    this.saveData(this.data);

    if (this.supabaseChannel && this.isSupabaseConnected) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'user_deleted',
          payload: { userId: passengerId }
        });
      } catch {}
    }

    await deleteUserFromSupabaseDb(passengerId);

    try {
      await fetch(`${this.getApiBaseUrl()}/api/transit/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: passengerId })
      });
    } catch {}

    return { success: true };
  }

  // Explicit trigger to refresh all components and reload from storage
  public triggerRefresh() {
    this.data = this.loadData();
    this.notify();
  }

  // Routes Management (Price limit <= 8 SAR)
  public getRoutes(): TransitRoute[] {
    return this.data.routes;
  }

  public getStations(): TransitStation[] {
    return this.data.stations;
  }

  public addStation(nameAr: string, area: string, lat: number, lng: number): TransitStation {
    const newStation: TransitStation = {
      id: `st-${Date.now()}`,
      nameAr: nameAr.trim(),
      area: area.trim(),
      lat,
      lng
    };
    this.data.stations.push(newStation);
    this.saveData(this.data);
    return newStation;
  }

  public createRoute(code: string, nameAr: string, color: string, price: number, stationIds: string[], description: string): {
    success: boolean;
    route?: TransitRoute;
    error?: string;
  } {
    if (price > 8) {
      return { success: false, error: 'الحد الأقصى لسعر أي مسار هو 8 ريال سعودي وفق اللائحة' };
    }
    if (stationIds.length < 2) {
      return { success: false, error: 'يجب اختيار محطتين على الأقل للمسار' };
    }

    const stations = stationIds
      .map(id => this.data.stations.find(s => s.id === id))
      .filter(Boolean) as TransitStation[];

    const newRoute: TransitRoute = {
      id: `rt-${Date.now()}`,
      code: code.trim() || `${Math.floor(100 + Math.random() * 900)}`,
      nameAr: nameAr.trim(),
      color: color || '#0284c7',
      price: Math.min(8, Math.max(1, price)),
      stations,
      description: description.trim()
    };

    this.data.routes.push(newRoute);
    this.saveData(this.data);
    return { success: true, route: newRoute };
  }

  public updateRoute(id: string, updates: Partial<TransitRoute>): { success: boolean; error?: string } {
    const route = this.data.routes.find(r => r.id === id);
    if (!route) return { success: false, error: 'المسار غير موجود' };

    if (updates.price !== undefined && updates.price > 8) {
      return { success: false, error: 'سعر المسار لا يمكن أن يتجاوز 8 ريال' };
    }

    Object.assign(route, updates);
    this.saveData(this.data);
    return { success: true };
  }

  public deleteRoute(id: string): { success: boolean; error?: string } {
    const hasScheduledTrips = this.data.trips.some(t => t.routeId === id && (t.status === 'scheduled' || t.status === 'in_progress'));
    if (hasScheduledTrips) {
      return { success: false, error: 'لا يمكن حذف المسار لوجود رحلات مجدولة أو جارية عليه' };
    }

    this.data.routes = this.data.routes.filter(r => r.id !== id);
    this.saveData(this.data);
    return { success: true };
  }

  // Requirement: Create trip -> driver, route, time selected. Bus and price automatically populated!
  public createTrip(driverId: string, routeId: string, departureTime: string): { success: boolean; trip?: Trip; error?: string } {
    const driver = this.data.users.find(u => u.id === driverId && u.role === 'driver');
    if (!driver || driver.status !== 'active') {
      return { success: false, error: 'السائق المحدد غير مفعل أو غير موجود' };
    }

    const route = this.data.routes.find(r => r.id === routeId);
    if (!route) {
      return { success: false, error: 'المسار المحدد غير موجود' };
    }

    // Auto populated from driver and route!
    const busPlate = driver.busDetails?.plateNumber || 'لوحة غير مسجلة';
    const busModel = driver.busDetails?.model || 'حافلة نقل عام';
    const totalSeats = driver.busDetails?.seatsCount || 20;
    const price = route.price; // Auto populated from route (<= 8 SAR)

    const newTrip: Trip = {
      id: `trp-${Date.now()}`,
      routeId: route.id,
      routeName: `مسار ${route.code}: ${route.nameAr}`,
      routeColor: route.color,
      price,
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      busPlate,
      busModel,
      totalSeats,
      availableSeats: totalSeats,
      departureTime,
      status: 'scheduled',
      currentLocation: route.stations[0] ? {
        lat: route.stations[0].lat,
        lng: route.stations[0].lng,
        lastUpdated: new Date().toISOString()
      } : undefined
    };

    this.data.trips.push(newTrip);
    this.saveData(this.data);
    return { success: true, trip: newTrip };
  }

  // Admin Bookings Management: Edit destination, seat, status, cancel
  public getAllBookings(): Booking[] {
    return this.data.bookings;
  }

  public updateBookingByAdmin(bookingId: string, updates: Partial<Booking>): { success: boolean; error?: string } {
    const booking = this.data.bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, error: 'الحجز غير موجود' };

    Object.assign(booking, updates);
    this.saveData(this.data);
    return { success: true };
  }

  // Support & Announcements
  public getSupportTickets(): SupportTicket[] {
    return this.data.tickets;
  }

  public createSupportTicket(subject: string, message: string): SupportTicket {
    const newTicket: SupportTicket = {
      id: `spt-${Date.now()}`,
      userId: this.currentUser?.id || 'guest',
      userName: this.currentUser?.name || 'مستخدم',
      userPhone: this.currentUser?.phone || '',
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
      createdAt: new Date().toISOString()
    };
    this.data.tickets.unshift(newTicket);
    this.saveData(this.data);
    return newTicket;
  }

  public replyAndCloseTicket(ticketId: string, reply: string): { success: boolean; error?: string } {
    const ticket = this.data.tickets.find(t => t.id === ticketId);
    if (!ticket) return { success: false, error: 'التذكرة غير موجودة' };
    ticket.adminReply = reply.trim();
    ticket.status = 'closed';
    this.saveData(this.data);
    return { success: true };
  }

  public getAnnouncement(): Announcement {
    return this.data.announcement;
  }

  public updateAnnouncement(text: string, active: boolean): Announcement {
    this.data.announcement = {
      id: `ann-${Date.now()}`,
      text: text.trim(),
      active,
      publishedAt: new Date().toISOString()
    };
    this.saveData(this.data);
    return this.data.announcement;
  }

  public getAllTrips(): Trip[] {
    return this.data.trips;
  }

  public resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    this.data = this.loadData();
    this.notify();
  }
}

export const transitStore = new TransitStore();
