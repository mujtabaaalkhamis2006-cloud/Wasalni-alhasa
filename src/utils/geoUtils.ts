import { TransitStation, TransitRoute } from '../types/transit';

export interface UserCoordinates {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
  isSimulated?: boolean;
}

export interface NearestStationResult {
  station: TransitStation;
  distanceMeters: number;
  formattedDistance: string;
  walkingMinutes: number;
  servingRoutes: TransitRoute[];
}



/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula
 */
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Format meters to friendly Arabic string (e.g. 350 متر or 1.4 كم)
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} متر`;
  }
  const km = (meters / 1000).toFixed(1);
  return `${km} كم`;
}

/**
 * Estimate walking duration in minutes (average walking speed ~4.8 km/h or 80 m/min)
 */
export function estimateWalkingMinutes(meters: number): number {
  const minutes = Math.ceil(meters / 80);
  return Math.max(1, minutes);
}

/**
 * Estimate bus arrival duration in minutes (average urban transit speed ~36 km/h or 600 m/min)
 */
export function estimateBusArrivalMinutes(meters: number): number {
  const minutes = Math.ceil(meters / 600);
  return Math.max(1, minutes);
}

/**
 * Check if coordinate is approximately within the Al-Ahsa region boundary
 */
export function isInAlAhsaRegion(lat: number, lng: number): boolean {
  return lat >= 25.1 && lat <= 25.8 && lng >= 49.3 && lng <= 49.9;
}

/**
 * Finds the nearest station to given user coordinates among all provided routes
 */
export function findNearestStation(
  userCoords: { lat: number; lng: number },
  routes: TransitRoute[],
  stationFilter?: (station: TransitStation) => boolean
): NearestStationResult | null {
  const stationsMap = new Map<string, { station: TransitStation; routes: TransitRoute[] }>();

  for (const route of routes) {
    for (const station of route.stations) {
      if (stationFilter && !stationFilter(station)) continue;
      const existing = stationsMap.get(station.id);
      if (existing) {
        if (!existing.routes.some(r => r.id === route.id)) {
          existing.routes.push(route);
        }
      } else {
        stationsMap.set(station.id, { station, routes: [route] });
      }
    }
  }

  let nearest: NearestStationResult | null = null;
  let minDistance = Infinity;

  for (const { station, routes: servingRoutes } of stationsMap.values()) {
    const dist = calculateDistanceMeters(userCoords.lat, userCoords.lng, station.lat, station.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        station,
        distanceMeters: dist,
        formattedDistance: formatDistance(dist),
        walkingMinutes: estimateWalkingMinutes(dist),
        servingRoutes
      };
    }
  }

  return nearest;
}

/**
 * Request user's current GPS position using browser Geolocation API with robust timeout & options
 */
// In-flight promise cache to prevent multiple concurrent GPS queries on mobile
let inFlightLocationPromise: Promise<UserCoordinates> | null = null;
let lastKnownLocation: { coords: UserCoordinates; time: number } | null = null;

/**
 * Request user's current GPS position using browser Geolocation API with robust timeout & options.
 * Deduplicates in-flight calls and leverages recent cache to ensure fast responsiveness on mobile.
 */
export function requestUserLocation(forceFresh = false): Promise<UserCoordinates> {
  const now = Date.now();
  // Return recent location if fresh within 10 seconds and not forced
  if (!forceFresh && lastKnownLocation && now - lastKnownLocation.time < 10000) {
    return Promise.resolve(lastKnownLocation.coords);
  }

  if (inFlightLocationPromise) {
    return inFlightLocationPromise;
  }

  inFlightLocationPromise = new Promise<UserCoordinates>((resolve) => {
    let resolved = false;
    const finish = (coords: UserCoordinates) => {
      if (resolved) return;
      resolved = true;
      lastKnownLocation = { coords, time: Date.now() };
      inFlightLocationPromise = null;
      resolve(coords);
    };

    if (typeof window === 'undefined' || !navigator.geolocation) {
      // IP physical device fallback if geolocation API is absent
      fetch('/api/transit/detect-ip')
        .then(r => r.json())
        .then(data => {
          finish({
            lat: data?.lat || 25.3835,
            lng: data?.lng || 49.5862,
            accuracy: 50,
            timestamp: Date.now()
          });
        })
        .catch(() => {
          finish({ lat: 25.3835, lng: 49.5862, accuracy: 50, timestamp: Date.now() });
        });
      return;
    }

    const fallbackToIp = async () => {
      try {
        const ipRes = await fetch('/api/transit/detect-ip');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.success && typeof ipData.lat === 'number' && typeof ipData.lng === 'number') {
            finish({
              lat: Number(ipData.lat.toFixed(6)),
              lng: Number(ipData.lng.toFixed(6)),
              accuracy: 50,
              timestamp: Date.now()
            });
            return;
          }
        }
      } catch (e) {}
      finish({
        lat: 25.3835,
        lng: 49.5862,
        accuracy: 30,
        timestamp: Date.now()
      });
    };

    const tryStandardAccuracy = () => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            finish({
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
              accuracy: pos.coords.accuracy || 15,
              timestamp: pos.timestamp
            });
          },
          () => {
            fallbackToIp();
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
        );
      } catch {
        fallbackToIp();
      }
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          finish({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
            accuracy: position.coords.accuracy || 5,
            timestamp: position.timestamp
          });
        },
        () => {
          tryStandardAccuracy();
        },
        {
          enableHighAccuracy: true,
          timeout: 4500,
          maximumAge: 15000 // allows phone to use recent fix without spinning GPS hardware
        }
      );
    } catch {
      tryStandardAccuracy();
    }
  });

  return inFlightLocationPromise;
}
