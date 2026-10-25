import React, { useState } from 'react';
import { TransitRoute, TransitStation, Trip, Booking } from '../types/transit';
import { MapPin, Bus, Navigation, Info, CheckCircle2, Crosshair, Compass, LocateFixed } from 'lucide-react';

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

// Default Bounding box for Al-Ahsa Oasis map view:
const DEFAULT_MIN_LAT = 25.26;
const DEFAULT_MAX_LAT = 25.64;
const DEFAULT_MIN_LNG = 49.46;
const DEFAULT_MAX_LNG = 49.76;

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
  const [filterRouteId, setFilterRouteId] = useState<string>(activeRouteId || 'all');
  const [hoveredStation, setHoveredStation] = useState<TransitStation | null>(null);
  const [hoveredTrip, setHoveredTrip] = useState<Trip | null>(null);
  const [hoveredBooking, setHoveredBooking] = useState<Booking | null>(null);

  const displayedRoutes = routes.filter(r => filterRouteId === 'all' || r.id === filterRouteId);
  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const trackedTrip = trips.find(t => t.id === trackedTripId);

  // Dynamic Map Bounds ensuring all stations, live buses, and the user's real device position fit comfortably
  const { coordsToPercent, mapBounds } = React.useMemo(() => {
    let minLat = DEFAULT_MIN_LAT;
    let maxLat = DEFAULT_MAX_LAT;
    let minLng = DEFAULT_MIN_LNG;
    let maxLng = DEFAULT_MAX_LNG;

    if (userLocation && typeof userLocation.lat === 'number' && typeof userLocation.lng === 'number') {
      minLat = Math.min(minLat, userLocation.lat);
      maxLat = Math.max(maxLat, userLocation.lat);
      minLng = Math.min(minLng, userLocation.lng);
      maxLng = Math.max(maxLng, userLocation.lng);
    }

    trips.forEach(t => {
      if (t.status === 'in_progress' && t.currentLocation) {
        minLat = Math.min(minLat, t.currentLocation.lat);
        maxLat = Math.max(maxLat, t.currentLocation.lat);
        minLng = Math.min(minLng, t.currentLocation.lng);
        maxLng = Math.max(maxLng, t.currentLocation.lng);
      }
    });

    const latPad = (maxLat - minLat) * 0.08 || 0.02;
    const lngPad = (maxLng - minLng) * 0.08 || 0.02;

    const bMinLat = minLat - latPad;
    const bMaxLat = maxLat + latPad;
    const bMinLng = minLng - lngPad;
    const bMaxLng = maxLng + lngPad;

    const toPercent = (lat: number, lng: number) => {
      const x = Math.max(4, Math.min(96, ((lng - bMinLng) / (bMaxLng - bMinLng)) * 92 + 4));
      const y = Math.max(4, Math.min(96, ((bMaxLat - lat) / (bMaxLat - bMinLat)) * 92 + 4));
      return { x, y };
    };

    return {
      coordsToPercent: toPercent,
      mapBounds: { bMinLat, bMaxLat, bMinLng, bMaxLng }
    };
  }, [userLocation, trips]);

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelectCustomPoint || !interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    // Convert back from percent to lat/lng
    const { bMinLat, bMaxLat, bMinLng, bMaxLng } = mapBounds;
    const lng = bMinLng + ((clickX * 100 - 4) / 92) * (bMaxLng - bMinLng);
    const lat = bMaxLat - ((clickY * 100 - 4) / 92) * (bMaxLat - bMinLat);

    onSelectCustomPoint({
      lat: Number(lat.toFixed(4)),
      lng: Number(lng.toFixed(4)),
      name: `نقطة مخصصة على الخريطة (${lat.toFixed(2)}, ${lng.toFixed(2)})`
    });
  };

  const allStations = routes.flatMap(r => r.stations);
  const nearestStation = nearestStationId ? allStations.find(s => s.id === nearestStationId) : null;
  const userPercent = userLocation ? coordsToPercent(userLocation.lat, userLocation.lng) : null;
  const nearestPercent = nearestStation ? coordsToPercent(nearestStation.lat, nearestStation.lng) : null;
  const trackedBusPercent = trackedTrip?.currentLocation ? coordsToPercent(trackedTrip.currentLocation.lat, trackedTrip.currentLocation.lng) : null;

  return (
    <div className="relative w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Map Header / Filters */}
      <div className="p-4 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">
              {isDriverView ? 'خريطة ركاب الرحلة والنزول' : 'خريطة مسارات حافلات الأحساء المباشرة'}
            </h3>
            <p className="text-xs text-slate-400">
              {isDriverView
                ? 'مواقع نزول ركابك على مسار الرحلة'
                : 'تحديث حي لمواقع الحافلات الجارية كل 10 ثوانٍ'}
            </p>
          </div>
        </div>

        {/* Route switcher tabs */}
        {!isDriverView && (
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800/80 rounded-xl">
            <button
              onClick={() => setFilterRouteId('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
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
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
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

        {/* Live buses pulse tag */}
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2.5 py-1 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{activeTrips.length} حافلة جارية الآن</span>
        </div>
      </div>

      {/* Interactive Map Visual Stage */}
      <div
        className="relative w-full h-[400px] sm:h-[480px] bg-[#0c1427] cursor-crosshair overflow-hidden select-none"
        onClick={handleMapClick}
      >
        {/* Subtle Map Grid & Oasis Geographic Styling */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(#38bdf8 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Oasis green zones / landmarks watermark */}
        <div className="absolute top-[35%] right-[20%] w-36 h-28 bg-emerald-900/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-[20%] left-[25%] w-48 h-36 bg-sky-900/10 rounded-full blur-3xl pointer-events-none" />

        {/* Area Names Watermarks */}
        <div className="absolute top-[18%] left-[45%] text-[11px] font-bold text-slate-700/60 pointer-events-none">
          شمال الأحساء (العيون)
        </div>
        <div className="absolute top-[38%] left-[28%] text-[11px] font-bold text-slate-700/60 pointer-events-none">
          مدينة المبرز
        </div>
        <div className="absolute top-[52%] left-[38%] text-[11px] font-bold text-slate-700/60 pointer-events-none">
          مدينة الهفوف
        </div>
        <div className="absolute top-[48%] right-[15%] text-[11px] font-bold text-slate-700/60 pointer-events-none">
          القرى الشرقية وجبل القارة
        </div>
        <div className="absolute bottom-[10%] left-[12%] text-[11px] font-bold text-slate-700/60 pointer-events-none">
          مطار الأحساء الدولي
        </div>

        {/* SVG Route Paths & Connection Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            {displayedRoutes.map(route => (
              <linearGradient key={`grad-${route.id}`} id={`grad-${route.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={route.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={route.color} stopOpacity="1" />
              </linearGradient>
            ))}
          </defs>

          {/* Dotted Walking Connection from User Location to Nearest Station */}
          {userPercent && nearestPercent && (
            <g key="user-to-nearest-link">
              <line
                x1={`${userPercent.x}%`}
                y1={`${userPercent.y}%`}
                x2={`${nearestPercent.x}%`}
                y2={`${nearestPercent.y}%`}
                stroke="#06b6d4"
                strokeWidth="3"
                strokeDasharray="6 4"
                strokeLinecap="round"
                opacity="0.85"
              />
            </g>
          )}

          {/* Dotted Radar Tracking Line from User Location to Tracked Bus */}
          {userPercent && trackedBusPercent && (
            <g key="user-to-tracked-bus-link">
              <line
                x1={`${userPercent.x}%`}
                y1={`${userPercent.y}%`}
                x2={`${trackedBusPercent.x}%`}
                y2={`${trackedBusPercent.y}%`}
                stroke="#f59e0b"
                strokeWidth="3.5"
                strokeDasharray="5 3"
                strokeLinecap="round"
                opacity="0.9"
              />
            </g>
          )}

          {displayedRoutes.map(route => {
            if (route.stations.length < 2) return null;
            const points = route.stations.map(st => {
              const { x, y } = coordsToPercent(st.lat, st.lng);
              return `${x}%,${y}%`;
            });
            const pathData = `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ');

            return (
              <g key={`route-path-${route.id}`}>
                {/* Route Glow */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={route.color}
                  strokeWidth="8"
                  strokeOpacity="0.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Core Route Line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={route.color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 2"
                />
              </g>
            );
          })}
        </svg>

        {/* Stations Markers */}
        {displayedRoutes.flatMap(r => r.stations).reduce<TransitStation[]>((acc, s) => {
          if (!acc.some(x => x.id === s.id)) acc.push(s);
          return acc;
        }, []).map(station => {
          const { x, y } = coordsToPercent(station.lat, station.lng);
          const isSelected = selectedStation?.id === station.id;
          const isNearest = nearestStationId === station.id;
          const isDriverStart = station.id.startsWith('st-driver-gps') || station.id.startsWith('st-gps') || (station.area && station.area.includes('انطلاق السائق'));

          return (
            <div
              key={`marker-${station.id}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectStation) onSelectStation(station);
              }}
              onMouseEnter={() => setHoveredStation(station)}
              onMouseLeave={() => setHoveredStation(null)}
            >
              <div
                className={`relative flex items-center justify-center transition-transform group-hover:scale-125 ${
                  isSelected || isNearest || isDriverStart ? 'scale-125' : ''
                }`}
              >
                {/* Pulse ring if this is the nearest station or driver departure station */}
                {isDriverStart ? (
                  <span className="animate-ping absolute -inset-2 rounded-full bg-emerald-400 opacity-75" />
                ) : isNearest ? (
                  <span className="animate-ping absolute -inset-2 rounded-full bg-amber-400 opacity-75" />
                ) : null}

                <div
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    isDriverStart
                      ? 'bg-emerald-500 border-white ring-4 ring-emerald-500/50 shadow-lg'
                      : isNearest
                      ? 'bg-amber-400 border-white ring-4 ring-amber-400/50 shadow-lg'
                      : isSelected
                      ? 'bg-amber-400 border-white ring-4 ring-amber-400/40 shadow-lg'
                      : 'bg-slate-900 border-sky-400 group-hover:border-white'
                  }`}
                />
                <span className={`absolute -bottom-5 whitespace-nowrap text-[10px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none ${
                  isDriverStart
                    ? 'text-emerald-300 bg-emerald-950/90 border border-emerald-500/60 z-30'
                    : isNearest
                    ? 'text-amber-300 bg-amber-950/90 border border-amber-500/60 z-30'
                    : 'text-slate-300 bg-slate-950/80'
                }`}>
                  {isDriverStart ? `📍 انطلاق السائق: ${station.nameAr.split('(')[0].trim()}` : isNearest ? `★ أقرب محطة: ${station.nameAr.split('(')[0].trim()}` : station.nameAr.split('(')[0].trim()}
                </span>
              </div>
            </div>
          );
        })}

        {/* User Current Location Marker */}
        {userLocation && userPercent && (
          <div
            key="user-location-marker"
            style={{ left: `${userPercent.x}%`, top: `${userPercent.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-35 cursor-pointer pointer-events-auto"
            title="موقعك الحالي عبر GPS"
          >
            <div className="relative flex flex-col items-center">
              {/* Radar waves */}
              <span className="animate-ping absolute -inset-3 rounded-full bg-cyan-400 opacity-75 pointer-events-none" />
              <span className="animate-pulse absolute -inset-5 rounded-full bg-cyan-500/30 pointer-events-none" />

              {/* Pin body */}
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white border-2 border-white shadow-2xl flex items-center justify-center ring-4 ring-cyan-500/40">
                <LocateFixed className="w-4 h-4" />
              </div>

              {/* Tag */}
              <div className="mt-1 bg-slate-950/95 border border-cyan-400 text-cyan-300 text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-xl flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>{userLocation.label || `موقع جهازك الفعلي 📍 (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`}</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Buses (in_progress) with moving pulse and active tracking radar */}
        {activeTrips.map(trip => {
          const lat = trip.currentLocation?.lat || 25.38;
          const lng = trip.currentLocation?.lng || 49.58;
          const { x, y } = coordsToPercent(lat, lng);
          const isTracked = trackedTripId === trip.id;

          return (
            <div
              key={`bus-${trip.id}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-out cursor-pointer ${
                isTracked ? 'z-40 scale-125' : 'z-30 hover:scale-115'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectTrip) onSelectTrip(trip);
              }}
              onMouseEnter={() => setHoveredTrip(trip)}
              onMouseLeave={() => setHoveredTrip(null)}
            >
              <div className="relative">
                {/* Radar ripples */}
                {isTracked ? (
                  <>
                    <span className="animate-ping absolute -inset-4 rounded-full bg-amber-400 opacity-75" />
                    <span className="animate-pulse absolute -inset-6 rounded-full bg-amber-500/30" />
                  </>
                ) : (
                  <span className="animate-ping absolute -inset-2 rounded-full bg-emerald-400 opacity-60" />
                )}

                <div
                  className={`relative w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all ${
                    isTracked
                      ? 'bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 ring-4 ring-amber-400/60 shadow-amber-500/50'
                      : 'bg-emerald-500 text-slate-950'
                  }`}
                >
                  <Bus className="w-4 h-4 animate-pulse" />
                  {typeof trip.currentLocation?.heading === 'number' && trip.currentLocation.heading > 0 && (
                    <div
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center text-[8px] font-black border border-amber-400 shadow"
                      style={{ transform: `rotate(${trip.currentLocation.heading}deg)` }}
                      title={`الاتجاه: ${trip.currentLocation.heading}°`}
                    >
                      ▲
                    </div>
                  )}
                </div>

                {isTracked ? (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                    <span>تتبع حي: {trip.busPlate} ({typeof trip.currentLocation?.speed === 'number' ? `${trip.currentLocation.speed} كم/س` : 'مباشر'})</span>
                  </div>
                ) : (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-950/90 border border-emerald-500/50 text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-md">
                    {trip.routeName.split(':')[0]}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Active Bus Tracking HUD overlay */}
        {trackedTrip && (
          <div className="absolute top-3 left-3 z-35 bg-slate-900/95 border border-amber-500/70 p-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Bus className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black text-amber-300">
                  موقع السائق الفعلي مباشر ({trackedTrip.driverName} - {trackedTrip.busPlate})
                </span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold font-mono">
                  ⚡ {typeof trackedTrip.currentLocation?.speed === 'number' ? `${trackedTrip.currentLocation.speed} كم/س` : 'حي'}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                <span>المسار: <strong className="text-white">{trackedTrip.routeName.split('(')[0]}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-300 font-mono text-[10px]" dir="ltr">
                  GPS: {trackedTrip.currentLocation ? `${trackedTrip.currentLocation.lat.toFixed(5)}, ${trackedTrip.currentLocation.lng.toFixed(5)}` : 'جاري استقبال الإشارة'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Driver View: Passenger dropoff pins */}
        {isDriverView &&
          passengerBookings.map((booking, idx) => {
            if (!booking.dropoffCoordinates) return null;
            const { x, y } = coordsToPercent(booking.dropoffCoordinates.lat, booking.dropoffCoordinates.lng);
            const isBoarded = booking.status === 'boarded';

            return (
              <div
                key={`passenger-pin-${booking.id}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-25 cursor-pointer"
                onMouseEnter={() => setHoveredBooking(booking)}
                onMouseLeave={() => setHoveredBooking(null)}
              >
                <div className="relative group">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md border ${
                      isBoarded
                        ? 'bg-emerald-600 text-white border-emerald-300'
                        : 'bg-amber-500 text-slate-950 border-white animate-bounce'
                    }`}
                  >
                    {booking.seatNumber}
                  </div>
                  <div className="absolute top-7 left-1/2 -translate-x-1/2 bg-slate-950/90 text-white text-[9px] px-1 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {booking.passengerName} (مقعد {booking.seatNumber})
                  </div>
                </div>
              </div>
            );
          })}

        {/* Hover Popover: Station Details */}
        {hoveredStation && (
          <div className="absolute bottom-4 right-4 z-40 bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-xl max-w-xs text-xs pointer-events-none backdrop-blur-md">
            <div className="font-bold text-white mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span>{hoveredStation.nameAr}</span>
            </div>
            <div className="text-slate-400">المنطقة: {hoveredStation.area}</div>
            <div className="mt-1 text-[11px] text-amber-400">
              انقر لتحديد هذه المحطة كنقطة نزول
            </div>
          </div>
        )}

        {/* Hover Popover: Live Bus Details */}
        {hoveredTrip && (
          <div className="absolute bottom-4 left-4 z-40 bg-slate-900/95 border border-emerald-600/50 p-3 rounded-xl shadow-xl max-w-xs text-xs pointer-events-none backdrop-blur-md">
            <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
              <Bus className="w-3.5 h-3.5" />
              <span>{hoveredTrip.routeName}</span>
            </div>
            <div className="text-slate-300">السائق: {hoveredTrip.driverName}</div>
            <div className="text-slate-400">الحافلة: {hoveredTrip.busModel} ({hoveredTrip.busPlate})</div>
            <div className="text-slate-400">المقاعد المتبقية: {hoveredTrip.availableSeats} من {hoveredTrip.totalSeats}</div>
            <div className="mt-1.5 text-emerald-300 font-semibold">رحلة جارية على الطريق الآن</div>
          </div>
        )}

        {/* Hover Popover: Passenger Booking Details in Driver view */}
        {hoveredBooking && (
          <div className="absolute top-4 left-4 z-40 bg-slate-900/95 border border-amber-500/50 p-3 rounded-xl shadow-xl max-w-xs text-xs pointer-events-none backdrop-blur-md">
            <div className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>راكب: {hoveredBooking.passengerName}</span>
            </div>
            <div className="text-slate-300">المقعد رقم: {hoveredBooking.seatNumber}</div>
            <div className="text-slate-300">محطة النزول: {hoveredBooking.dropoffStation}</div>
            <div className="text-slate-400">الجوال: {hoveredBooking.passengerPhone}</div>
            <div className="mt-1 font-bold text-sky-400">
              الحالة: {hoveredBooking.status === 'boarded' ? 'صعد للحافلة ✓' : 'في انتظار الصعود'}
            </div>
          </div>
        )}

        {/* Custom Point Click Indicator Hint */}
        {interactive && (
          <div className="absolute top-3 right-3 bg-slate-950/80 border border-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1.5 pointer-events-none">
            <Crosshair className="w-3 h-3 text-sky-400" />
            <span>يمكنك الضغط على أي محطة أو أي نقطة على الخريطة لتحديد النزول</span>
          </div>
        )}
      </div>

      {/* Map Footer: Routes legend & pricing */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-300">
          <span className="text-slate-500 font-medium">دليل المسارات والأسعار:</span>
          {routes.map(r => (
            <div key={`legend-${r.id}`} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="font-medium">{r.nameAr.split('(')[0]}</span>
              <span className="text-amber-400 font-bold">{r.price} ر.س</span>
            </div>
          ))}
        </div>
        <div className="text-slate-400 text-[11px]">
          * الحد الأقصى لسعر أي تذكرة حافلة في الأحساء 8 ريال
        </div>
      </div>
    </div>
  );
};
