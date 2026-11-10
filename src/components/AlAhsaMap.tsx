import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { TransitRoute, TransitStation, Trip, Booking } from '../types/transit';
import { Bus, MapPin, Navigation, Crosshair, LocateFixed, Layers, Compass } from 'lucide-react';

interface AlAhsaMapProps {
  routes: TransitRoute[];
  trips?: Trip[];
  passengerBookings?: Booking[];
  selectedStation?: TransitStation | null;
  onSelectStation?: (station: TransitStation) => void;
  onSelectCustomPoint?: (coords: { lat: number; lng: number; name: string }) => void;
  activeRouteId?: string;
  isDriverView?: boolean;
  interactive?: boolean;
  userLocation?: { lat: number; lng: number; label?: string } | null;
  nearestStationId?: string | null;
  trackedTripId?: string | null;
  onSelectTrip?: (trip: Trip) => void;
}

// Al-Ahsa Oasis center (Hofuf / Mubarraz)
const AL_AHSA_CENTER: [number, number] = [25.3835, 49.5862];
const DEFAULT_ZOOM = 12;

// Custom HTML Pin icons for stations, buses, user, and dropoffs
function createStationIcon(station: TransitStation, isSelected: boolean, isNearest: boolean, isDriverStart: boolean) {
  const isSpecial = isDriverStart || isNearest || isSelected;
  const pinColor = isDriverStart ? '#10b981' : isNearest ? '#f59e0b' : isSelected ? '#38bdf8' : '#0284c7';
  const label = isDriverStart
    ? `📍 انطلاق السائق: ${station.nameAr.split('(')[0].trim()}`
    : isNearest
    ? `★ أقرب محطة: ${station.nameAr.split('(')[0].trim()}`
    : station.nameAr.split('(')[0].trim();

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer select-none">
      ${isSpecial ? `<span class="animate-ping absolute -top-1 w-5 h-5 rounded-full ${isDriverStart ? 'bg-emerald-400' : isNearest ? 'bg-amber-400' : 'bg-sky-400'} opacity-75"></span>` : ''}
      <div style="background-color: ${pinColor}; box-shadow: 0 4px 14px rgba(0,0,0,0.45);" class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-125">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div class="mt-1 px-2 py-0.5 rounded-md shadow-lg text-[10px] font-bold whitespace-nowrap pointer-events-none ${
        isDriverStart
          ? 'bg-emerald-950 text-emerald-200 border border-emerald-500'
          : isNearest
          ? 'bg-amber-950 text-amber-200 border border-amber-500'
          : 'bg-slate-900/90 text-slate-200 border border-slate-700'
      }">
        ${label}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-station-icon',
    iconSize: [120, 48],
    iconAnchor: [60, 14],
    popupAnchor: [0, -18]
  });
}

function createBusIcon(trip: Trip, isTracked: boolean) {
  const heading = trip.currentLocation?.heading || 0;
  const label = isTracked
    ? `تتبع حي: ${trip.busPlate}`
    : trip.busPlate || trip.routeName.split(':')[0];

  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer select-none">
      ${isTracked ? '<span class="animate-ping absolute -top-2 w-10 h-10 rounded-full bg-amber-400 opacity-75"></span><span class="animate-pulse absolute -top-3 w-12 h-12 rounded-full bg-amber-500/30"></span>' : '<span class="animate-ping absolute -top-1 w-7 h-7 rounded-full bg-emerald-400 opacity-60"></span>'}
      <div class="relative w-9 h-9 rounded-2xl border-2 border-white shadow-2xl flex items-center justify-center transition-transform duration-300 ${
        isTracked
          ? 'bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 ring-4 ring-amber-400/50 shadow-amber-500/50 scale-110'
          : 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 ring-2 ring-emerald-400/40 shadow-emerald-500/30'
      }">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.6-.3-1.1-.8-1.4l-1.7-.8c-.6-.3-1.4-.3-2 .1L16 13"/><path d="M4 18h11"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="16.5" cy="18.5" r="2.5"/></svg>
        ${heading > 0 ? `
          <div style="transform: rotate(${heading}deg);" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center text-[8px] font-black border border-amber-400 shadow">
            ▲
          </div>
        ` : ''}
      </div>
      <div class="mt-1 px-2.5 py-0.5 rounded-full shadow-xl text-[10px] font-black whitespace-nowrap pointer-events-none flex items-center gap-1.5 ${
        isTracked
          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
          : 'bg-slate-950/90 text-emerald-300 border border-emerald-500/60'
      }">
        <span class="w-1.5 h-1.5 rounded-full ${isTracked ? 'bg-slate-950' : 'bg-emerald-400'} animate-ping"></span>
        <span>${label}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-bus-icon',
    iconSize: [140, 52],
    iconAnchor: [70, 18],
    popupAnchor: [0, -22]
  });
}

function createUserIcon(label?: string) {
  const html = `
    <div class="relative flex flex-col items-center select-none">
      <span class="animate-ping absolute -top-2 w-9 h-9 rounded-full bg-cyan-400 opacity-75"></span>
      <span class="animate-pulse absolute -top-3 w-11 h-11 rounded-full bg-cyan-500/30"></span>
      <div class="relative w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white border-2 border-white shadow-2xl flex items-center justify-center ring-4 ring-cyan-500/40">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/></svg>
      </div>
      <div class="mt-1 px-2.5 py-0.5 rounded-full bg-slate-950/95 border border-cyan-400 text-cyan-300 text-[10px] font-black whitespace-nowrap shadow-xl">
        ${label || 'موقعك الحالي 📍'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-user-icon',
    iconSize: [120, 50],
    iconAnchor: [60, 16],
    popupAnchor: [0, -20]
  });
}

function createPassengerIcon(booking: Booking) {
  const isBoarded = booking.status === 'boarded';
  const html = `
    <div class="relative flex flex-col items-center group cursor-pointer select-none">
      <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white ${
        isBoarded
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-500 text-slate-950 animate-bounce'
      }">
        #${booking.seatNumber}
      </div>
      <div class="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/90 text-white text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        ${booking.passengerName} (نزول: ${booking.dropoffStation})
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-passenger-icon',
    iconSize: [100, 40],
    iconAnchor: [50, 14],
    popupAnchor: [0, -16]
  });
}

export const AlAhsaMap: React.FC<AlAhsaMapProps> = ({
  routes,
  trips = [],
  passengerBookings = [],
  selectedStation,
  onSelectStation,
  onSelectCustomPoint,
  activeRouteId,
  isDriverView = false,
  interactive = true,
  userLocation,
  nearestStationId,
  trackedTripId,
  onSelectTrip
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.LayerGroup | null>(null);
  const stationMarkersRef = useRef<L.LayerGroup | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const activeRoutePolylineRef = useRef<L.Polyline | null>(null);
  const activeRouteGlowPolylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const passengerMarkersRef = useRef<L.LayerGroup | null>(null);

  const [filterRouteId, setFilterRouteId] = useState<string>(activeRouteId || 'all');
  const [mapTileStyle, setMapTileStyle] = useState<'streets' | 'satellite'>('streets');
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const lastPannedCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastBusMarkerCoordsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const trackedTrip = trips.find(t => t.id === trackedTripId) || (trackedTripId ? null : activeTrips[0]);
  const displayedRoutes = trackedTrip
    ? routes.filter(r => r.id === trackedTrip.routeId)
    : routes.filter(r => filterRouteId === 'all' || r.id === filterRouteId);

  const [autoFollowDriver, setAutoFollowDriver] = useState<boolean>(true);

  // Initialize Real Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // OpenStreetMap Standard High-Performance CDN Tiles with Arabic places (Hofuf, Mubarraz, Al-Qarah, etc.)
    const initialTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const map = L.map(mapContainerRef.current, {
      center: AL_AHSA_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false
    });

    const tile = L.tileLayer(initialTileUrl, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    tileLayerRef.current = tile;

    // Custom Zoom controls at bottom-left
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    routeLayersRef.current = L.layerGroup().addTo(map);
    stationMarkersRef.current = L.layerGroup().addTo(map);
    passengerMarkersRef.current = L.layerGroup().addTo(map);

    // Map click handler for custom drop-off point selection
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!onSelectCustomPoint || !interactive) return;
      onSelectCustomPoint({
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5)),
        name: `نقطة نزول مخصصة بالخريطة (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`
      });
    });

    // Disable auto-follow if user manually drags or zooms map
    map.on('dragstart', () => {
      setAutoFollowDriver(false);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Toggle Map Style: Streets vs Satellite
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);

    const newUrl = mapTileStyle === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTile = L.tileLayer(newUrl, {
      maxZoom: mapTileStyle === 'satellite' ? 18 : 19,
      subdomains: mapTileStyle === 'satellite' ? [] : ['a', 'b', 'c'],
      attribution: mapTileStyle === 'satellite' ? '&copy; Esri World Imagery' : '&copy; OpenStreetMap'
    }).addTo(mapRef.current);

    tileLayerRef.current = newTile;
  }, [mapTileStyle]);

  // Render Routes and Real Route Paths
  useEffect(() => {
    if (!mapRef.current || !routeLayersRef.current) return;
    routeLayersRef.current.clearLayers();

    displayedRoutes.forEach(route => {
      if (route.stations.length < 2) return;
      const latlngs: [number, number][] = route.stations.map(s => [s.lat, s.lng]);

      // Glow underlay line
      L.polyline(latlngs, {
        color: route.color,
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayersRef.current!);

      // Main Route line
      const line = L.polyline(latlngs, {
        color: route.color,
        weight: 4,
        opacity: 0.95,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(routeLayersRef.current!);

      line.bindTooltip(`مسار ${route.code}: ${route.nameAr} (${route.price} ر.س)`, {
        direction: 'top',
        className: 'route-tooltip font-bold text-xs'
      });
    });
  }, [displayedRoutes]);

  // Render Stations
  useEffect(() => {
    if (!mapRef.current || !stationMarkersRef.current) return;
    stationMarkersRef.current.clearLayers();

    const uniqueStations = displayedRoutes
      .flatMap(r => r.stations)
      .reduce<TransitStation[]>((acc, s) => {
        if (!acc.some(x => x.id === s.id)) acc.push(s);
        return acc;
      }, []);

    uniqueStations.forEach(station => {
      const isSelected = selectedStation?.id === station.id;
      const isNearest = nearestStationId === station.id;
      const isDriverStart =
        station.id.startsWith('st-driver-gps') ||
        station.id.startsWith('st-gps') ||
        Boolean(station.area && station.area.includes('انطلاق السائق'));

      const marker = L.marker([station.lat, station.lng], {
        icon: createStationIcon(station, isSelected, isNearest, isDriverStart),
        zIndexOffset: isSelected || isNearest || isDriverStart ? 500 : 100
      });

      marker.on('click', () => {
        if (onSelectStation) onSelectStation(station);
      });

      marker.bindPopup(`
        <div class="text-right p-1 font-sans" dir="rtl">
          <div class="font-bold text-slate-900 text-xs mb-1">📍 ${station.nameAr}</div>
          <div class="text-[11px] text-slate-600 mb-1.5">المنطقة: ${station.area}</div>
          <button class="w-full py-1 px-2 text-[10px] bg-sky-600 text-white rounded font-bold">انقر لتحديد هذه المحطة للنزول</button>
        </div>
      `);

      marker.addTo(stationMarkersRef.current!);
    });
  }, [displayedRoutes, selectedStation, nearestStationId, onSelectStation]);

  // Render Passenger Dropoffs in Driver View
  useEffect(() => {
    if (!mapRef.current || !passengerMarkersRef.current) return;
    passengerMarkersRef.current.clearLayers();

    if (isDriverView && passengerBookings.length > 0) {
      passengerBookings.forEach(b => {
        if (!b.dropoffCoordinates) return;
        const marker = L.marker([b.dropoffCoordinates.lat, b.dropoffCoordinates.lng], {
          icon: createPassengerIcon(b),
          zIndexOffset: 300
        });

        marker.bindPopup(`
          <div class="text-right p-1 font-sans" dir="rtl">
            <div class="font-bold text-slate-900 text-xs">راكب: ${b.passengerName} (مقعد #${b.seatNumber})</div>
            <div class="text-[11px] text-slate-600">محطة النزول: ${b.dropoffStation}</div>
            <div class="text-[11px] text-slate-600">الجوال: ${b.passengerPhone}</div>
            <div class="mt-1 font-bold ${b.status === 'boarded' ? 'text-emerald-600' : 'text-amber-600'} text-[11px]">
              ${b.status === 'boarded' ? 'صعد للحافلة ✓' : 'في انتظار الصعود'}
            </div>
          </div>
        `);

        marker.addTo(passengerMarkersRef.current!);
      });
    }
  }, [isDriverView, passengerBookings]);

  // Render User Marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: createUserIcon(userLocation.label),
          zIndexOffset: 800
        }).addTo(mapRef.current);
      } else {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  // Live Driver Trajectory & Moving Bus Tracking (مسار السائق اذا بدأ وحركة التتبع المباشرة معه)
  useEffect(() => {
    if (!mapRef.current) return;

    // 1. Draw Active Driver Route Polyline when trip is in_progress
    if (activeRoutePolylineRef.current) {
      activeRoutePolylineRef.current.remove();
      activeRoutePolylineRef.current = null;
    }
    if (activeRouteGlowPolylineRef.current) {
      activeRouteGlowPolylineRef.current.remove();
      activeRouteGlowPolylineRef.current = null;
    }

    if (trackedTrip && trackedTrip.status !== 'completed' && trackedTrip.status !== 'cancelled') {
      const tripRoute = routes.find(r => r.id === trackedTrip.routeId);
      const points: [number, number][] = [];

      // Add current authentic physical bus location as the starting point
      if (trackedTrip.currentLocation) {
        points.push([trackedTrip.currentLocation.lat, trackedTrip.currentLocation.lng]);
      }

      // Add subsequent stations of the route
      if (tripRoute && tripRoute.stations && tripRoute.stations.length > 0) {
        tripRoute.stations.forEach(s => points.push([s.lat, s.lng]));
      }

      if (points.length >= 2) {
        // Thick road underlay path
        activeRouteGlowPolylineRef.current = L.polyline(points, {
          color: '#059669',
          weight: 9,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        activeRoutePolylineRef.current = L.polyline(points, {
          color: '#10b981',
          weight: 5,
          opacity: 0.95,
          dashArray: '10, 8',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        activeRoutePolylineRef.current.bindTooltip(
          `مسار السائق المباشر (${trackedTrip.driverName} - ${trackedTrip.busPlate})`,
          { permanent: false, direction: 'top', className: 'driver-path-tooltip font-bold text-xs' }
        );
      }

      // Auto follow driver if autoFollowDriver enabled - ONLY pan when physical displacement exceeds threshold
      if (autoFollowDriver && trackedTrip.currentLocation && mapRef.current) {
        const curLat = trackedTrip.currentLocation.lat;
        const curLng = trackedTrip.currentLocation.lng;
        const last = lastPannedCoordsRef.current;
        const dist = last ? Math.hypot(curLat - last.lat, curLng - last.lng) : 999;
        // Pan camera smoothly when physical location updates (displacement > ~0.8m)
        if (!last || dist > 0.000008) {
          lastPannedCoordsRef.current = { lat: curLat, lng: curLng };
          mapRef.current.panTo([curLat, curLng], {
            animate: true,
            duration: 0.8
          });
        }
      }
    }

    // 2. Update Live Bus Markers with smooth motion ONLY upon real physical GPS displacement
    const existingKeys = new Set(busMarkersRef.current.keys());

    const busTrips = trips.filter(t => (t.status === 'in_progress' || t.id === trackedTripId) && t.status !== 'completed' && t.status !== 'cancelled');

    busTrips.forEach(trip => {
      // Strictly do not render arbitrary fallback coordinates if trip has no physical GPS location yet
      if (!trip.currentLocation || typeof trip.currentLocation.lat !== 'number' || typeof trip.currentLocation.lng !== 'number') {
        return;
      }

      const lat = trip.currentLocation.lat;
      const lng = trip.currentLocation.lng;
      const isTracked = trackedTripId === trip.id;

      let marker = busMarkersRef.current.get(trip.id);

      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: createBusIcon(trip, isTracked),
          zIndexOffset: isTracked ? 1000 : 600
        }).addTo(mapRef.current!);

        marker.on('click', () => {
          if (onSelectTrip) onSelectTrip(trip);
        });

        marker.bindPopup(`
          <div class="text-right p-1.5 font-sans" dir="rtl">
            <div class="font-bold text-slate-900 text-xs mb-1">🚌 ${trip.routeName}</div>
            <div class="text-[11px] text-slate-700">السائق: <strong>${trip.driverName}</strong></div>
            <div class="text-[11px] text-slate-700">الحافلة: ${trip.busModel} (${trip.busPlate})</div>
            <div class="text-[11px] text-slate-700">المقاعد المتبقية: ${trip.availableSeats} من ${trip.totalSeats}</div>
            <div class="mt-1 text-emerald-600 font-bold text-[11px]">حافلة جارية على الطريق مباشرة 🟢</div>
          </div>
        `);

        busMarkersRef.current.set(trip.id, marker);
        lastBusMarkerCoordsRef.current.set(trip.id, { lat, lng });
      } else {
        const lastPos = lastBusMarkerCoordsRef.current.get(trip.id);
        const dist = lastPos ? Math.hypot(lat - lastPos.lat, lng - lastPos.lng) : 999;
        // Move marker whenever physical displacement occurs (> ~0.8m)
        if (!lastPos || dist > 0.000008) {
          marker.setLatLng([lat, lng]);
          lastBusMarkerCoordsRef.current.set(trip.id, { lat, lng });
        }
        marker.setIcon(createBusIcon(trip, isTracked));
        marker.setZIndexOffset(isTracked ? 1000 : 600);
      }

      existingKeys.delete(trip.id);
    });

    // Remove finished/cancelled trips
    existingKeys.forEach(tripId => {
      const m = busMarkersRef.current.get(tripId);
      if (m) {
        m.remove();
        busMarkersRef.current.delete(tripId);
      }
      lastBusMarkerCoordsRef.current.delete(tripId);
    });
  }, [trips, activeTrips, trackedTripId, trackedTrip, routes, onSelectTrip, autoFollowDriver]);

  // Auto-pan map smoothly to follow tracked bus
  const handleCenterOnBus = () => {
    setAutoFollowDriver(true);
    if (!mapRef.current || !trackedTrip?.currentLocation) return;
    mapRef.current.flyTo(
      [trackedTrip.currentLocation.lat, trackedTrip.currentLocation.lng],
      15,
      { animate: true, duration: 1.2 }
    );
  };

  const handleCenterOnUser = () => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { animate: true, duration: 1.2 });
  };

  const handleResetAlAhsaView = () => {
    if (!mapRef.current) return;
    mapRef.current.flyTo(AL_AHSA_CENTER, DEFAULT_ZOOM, { animate: true, duration: 1 });
  };

  return (
    <div className="relative w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Map Header / Filters */}
      <div className="p-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span>{isDriverView ? 'خريطة ركاب الرحلة ونقاط النزول' : 'خريطة وصلني في الأحساء الحقيقية (Real Map)'}</span>
              <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full font-bold">
                OpenStreetMap / Sat
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {isDriverView
                ? 'مواقع الركاب ومسار حركتك الفعلي على شوارع الأحساء'
                : 'تتبع حركة ومسار الحافلة خطوة بخطوة بالوقت الفعلي'}
            </p>
          </div>
        </div>

        {/* Route switcher tabs - hidden when tracking a specific trip */}
        {!isDriverView && !trackedTripId && routes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <button
              onClick={() => setFilterRouteId('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                filterRouteId === 'all'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              جميع المسارات
            </button>
            {routes.map(r => (
              <button
                key={r.id}
                onClick={() => setFilterRouteId(r.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  filterRouteId === r.id
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                <span>{r.code} ({r.price} ر.س)</span>
              </button>
            ))}
          </div>
        )}

        {/* Live buses count & layer switcher */}
        <div className="flex items-center gap-2">
          {/* Map Style Toggle */}
          <button
            type="button"
            onClick={() => setMapTileStyle(prev => prev === 'streets' ? 'satellite' : 'streets')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-sky-300 font-bold transition-all shadow"
            title="تبديل نمط الخريطة بين الشوارع والقمر الصناعي"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>{mapTileStyle === 'satellite' ? 'عرض الشوارع 🗺️' : 'قمر صناعي 🛰️'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-1 rounded-full font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>{activeTrips.length} حافلة تسير الآن</span>
          </div>
        </div>
      </div>

      {/* Map Container Area */}
      <div className="relative w-full h-[430px] sm:h-[500px] overflow-hidden bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Floating Quick Navigation Controls (Top Left) */}
        <div className="absolute top-3 left-3 z-[400] flex flex-col gap-2">
          {trackedTrip?.currentLocation && (
            <button
              type="button"
              onClick={handleCenterOnBus}
              className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-xl transition-all border ${
                autoFollowDriver
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300 ring-2 ring-emerald-400/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300'
              }`}
              title="تفعيل التتبع التلقائي وتحريك الكاميرا مع السائق"
            >
              <Bus className="w-4 h-4" />
              <span>{autoFollowDriver ? 'التتبع التلقائي مفعل 📡' : 'متابعة موقع الحافلة 🎯'}</span>
            </button>
          )}

          {userLocation && (
            <button
              type="button"
              onClick={handleCenterOnUser}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xl transition-all border border-sky-400"
              title="التركيز على موقعك"
            >
              <LocateFixed className="w-4 h-4" />
              <span>موقعي الحالي</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetAlAhsaView}
            className="px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 font-bold text-[11px] flex items-center gap-1 shadow-md border border-slate-700 backdrop-blur-sm"
            title="إعادة ضبط الرؤية لوسط الأحساء"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>وسط الأحساء</span>
          </button>
        </div>

        {/* Active Bus Tracking HUD overlay */}
        {trackedTrip && trackedTrip.status === 'in_progress' && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-[400] bg-slate-900/95 border-2 border-emerald-500/70 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Bus className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <span className="text-xs font-black text-white truncate">
                  {trackedTrip.routeName.split('(')[0]}
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold shrink-0">
                  تتبع مباشر نشط 🟢
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                <span>الكابتن: <strong className="text-white">{trackedTrip.driverName}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-300 font-mono font-bold">{trackedTrip.busPlate}</span>
                {trackedTrip.currentLocation && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-cyan-300 font-mono text-[10px]" dir="ltr">
                      GPS: {trackedTrip.currentLocation.lat.toFixed(4)}, {trackedTrip.currentLocation.lng.toFixed(4)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Interactive Click Hint */}
        {interactive && (
          <div className="absolute top-3 right-3 z-[400] bg-slate-950/85 border border-slate-700 text-slate-200 text-[11px] px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 pointer-events-none shadow-lg">
            <Crosshair className="w-3.5 h-3.5 text-sky-400" />
            <span>خريطة حقيقية تفاعلية: انقر على أي محطة أو شارع لتحديد النزول</span>
          </div>
        )}
      </div>

      {/* Map Footer: Routes legend & pricing */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3.5 text-slate-300">
          <span className="text-slate-500 font-bold">دليل مسارات وصلني في الأحساء:</span>
          {routes.map(r => (
            <div key={`legend-${r.id}`} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="font-bold">{r.nameAr.split('(')[0]}</span>
              <span className="text-amber-400 font-bold">({r.price} ر.س)</span>
            </div>
          ))}
        </div>
        <div className="text-slate-400 text-[11px] font-medium">
          * الحد الأقصى لسعر أي تذكرة حافلة في الأحساء 8 ريال
        </div>
      </div>
    </div>
  );
};
