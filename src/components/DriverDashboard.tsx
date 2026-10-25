import React, { useState, useEffect, useRef } from 'react';
import { transitStore } from '../services/transitStore';
import { User, Trip, Booking, TransitRoute, TransitStation } from '../types/transit';
import { AlAhsaMap } from './AlAhsaMap';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { requestUserLocation } from '../utils/geoUtils';
import {
  Bus,
  Play,
  CheckCircle,
  XCircle,
  Flag,
  MapPin,
  Phone,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
  Navigation,
  ShieldAlert,
  Radio,
  Compass,
  Activity,
  Satellite
} from 'lucide-react';

interface DriverDashboardProps {
  currentUser: User;
  routes: TransitRoute[];
}

function getCompassDirectionAr(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return 'شمال';
  if (normalized >= 22.5 && normalized < 67.5) return 'شمال شرق';
  if (normalized >= 67.5 && normalized < 112.5) return 'شرق';
  if (normalized >= 112.5 && normalized < 157.5) return 'جنوب شرق';
  if (normalized >= 157.5 && normalized < 202.5) return 'جنوب';
  if (normalized >= 202.5 && normalized < 247.5) return 'جنوب غرب';
  if (normalized >= 247.5 && normalized < 292.5) return 'غرب';
  return 'شمال غرب';
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  currentUser,
  routes
}) => {
  const [driverTrips, setDriverTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [passengers, setPassengers] = useState<Booking[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // GPS Telemetry State (Pure Real Physical Device GPS)
  const [gpsTelemetry, setGpsTelemetry] = useState<{
    active: boolean;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    accuracy: number;
    isRealSensor: boolean;
    lastBroadcast: Date | null;
    broadcastCount: number;
    errorMessage?: string;
  }>({
    active: false,
    lat: 25.352,
    lng: 49.568,
    speed: 0,
    heading: 0,
    accuracy: 5,
    isRealSensor: false,
    lastBroadcast: null,
    broadcastCount: 0
  });

  const [driverDeviceCoords, setDriverDeviceCoords] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  } | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const lastDeviceCoordsRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Refresh driver trips and passengers
  const refreshData = () => {
    const trips = transitStore.getDriverTrips(currentUser.id);
    setDriverTrips(trips);

    // Pick active in_progress trip or first scheduled
    if (!activeTripId && trips.length > 0) {
      const inProg = trips.find(t => t.status === 'in_progress');
      if (inProg) {
        setActiveTripId(inProg.id);
      } else {
        setActiveTripId(trips[0].id);
      }
    }
  };

  useEffect(() => {
    refreshData();
    const unsub = transitStore.subscribe(refreshData);
    return unsub;
  }, [currentUser]);

  // Requirement: Auto update passengers list every 15 seconds
  useEffect(() => {
    if (!activeTripId) return;

    const loadPassengers = () => {
      setPassengers(transitStore.getTripPassengers(activeTripId));
    };

    loadPassengers();
    const interval = setInterval(loadPassengers, 15000);
    return () => clearInterval(interval);
  }, [activeTripId]);

  // Selected Trip object
  const currentTrip = driverTrips.find(t => t.id === activeTripId);
  const currentRoute = currentTrip ? routes.find(r => r.id === currentTrip.routeId) : null;

  const lastProcessTimeRef = useRef<number>(0);

  // Helper to process and broadcast real device GPS coordinates
  const processAndBroadcastPosition = (rawCoords: {
    lat: number;
    lng: number;
    speed?: number | null;
    heading?: number | null;
    accuracy?: number | null;
  }) => {
    const lat = Number(rawCoords.lat.toFixed(6));
    const lng = Number(rawCoords.lng.toFixed(6));
    const now = Date.now();

    // Throttle updates: if less than 1200ms and movement < 4 meters, skip re-render
    if (lastDeviceCoordsRef.current && now - lastProcessTimeRef.current < 1200) {
      const dLat = Math.abs(lat - lastDeviceCoordsRef.current.lat);
      const dLng = Math.abs(lng - lastDeviceCoordsRef.current.lng);
      if (dLat < 0.00004 && dLng < 0.00004) {
        return;
      }
    }
    lastProcessTimeRef.current = now;

    let speedKmh = 0;
    if (typeof rawCoords.speed === 'number' && !isNaN(rawCoords.speed) && rawCoords.speed > 0) {
      speedKmh = Math.round(rawCoords.speed * 3.6);
    } else if (lastDeviceCoordsRef.current) {
      const dLat = (lat - lastDeviceCoordsRef.current.lat) * (Math.PI / 180);
      const dLng = (lng - lastDeviceCoordsRef.current.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lastDeviceCoordsRef.current.lat * (Math.PI / 180)) *
          Math.cos(lat * (Math.PI / 180)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = 6371 * c;
      const hours = (now - lastDeviceCoordsRef.current.time) / 3600000;
      if (hours > 0.0005 && distKm > 0.003) {
        const calculatedSpeed = Math.round(distKm / hours);
        if (calculatedSpeed < 130) speedKmh = calculatedSpeed;
      }
    }

    let heading = 0;
    if (typeof rawCoords.heading === 'number' && !isNaN(rawCoords.heading) && rawCoords.heading > 0) {
      heading = Math.round(rawCoords.heading);
    } else if (lastDeviceCoordsRef.current) {
      const dLat = lat - lastDeviceCoordsRef.current.lat;
      const dLng = lng - lastDeviceCoordsRef.current.lng;
      if (Math.hypot(dLat, dLng) > 0.00005) {
        const rad = Math.atan2(dLng, dLat);
        heading = Math.round(((rad * 180) / Math.PI + 360) % 360);
      } else {
        heading = gpsTelemetry.heading;
      }
    }

    const accuracy = typeof rawCoords.accuracy === 'number' ? Math.round(rawCoords.accuracy) : 5;
    lastDeviceCoordsRef.current = { lat, lng, time: now };
    setDriverDeviceCoords({ lat, lng, accuracy, speed: speedKmh, heading });

    setGpsTelemetry(prev => ({
      active: true,
      lat,
      lng,
      speed: speedKmh,
      heading,
      accuracy,
      isRealSensor: true,
      lastBroadcast: new Date(),
      broadcastCount: prev.broadcastCount + 1,
      errorMessage: undefined
    }));

    // Broadcast live telemetry to server so passengers and admin see it immediately
    if (activeTripId) {
      transitStore.broadcastDriverGps(activeTripId, lat, lng, speedKmh, heading, accuracy, currentUser.id);
    }
  };

  // Continuous physical device GPS acquisition for driver
  useEffect(() => {
    let watchId: number | null = null;
    let pulseInterval: any = null;

    const acquireInitial = async () => {
      setIsAcquiringGps(true);
      try {
        const loc = await requestUserLocation();
        processAndBroadcastPosition({
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy
        });
      } catch (err: any) {
        console.warn('Initial GPS acquisition:', err);
      } finally {
        setIsAcquiringGps(false);
      }
    };

    acquireInitial();

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            processAndBroadcastPosition({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              accuracy: pos.coords.accuracy
            });
          },
          (err) => {
            console.warn('GPS watch error:', err.message);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
        );
      } catch (e) {
        console.warn('Could not start GPS watch:', e);
      }
    }

    // Gentle heartbeat interval for stationary broadcasts without locking GPS hardware
    pulseInterval = setInterval(() => {
      if (activeTripId && currentTrip?.status === 'in_progress' && lastDeviceCoordsRef.current) {
        transitStore.broadcastDriverGps(
          activeTripId,
          lastDeviceCoordsRef.current.lat,
          lastDeviceCoordsRef.current.lng,
          0,
          gpsTelemetry.heading,
          gpsTelemetry.accuracy,
          currentUser.id
        );
      }
    }, 4500);

    return () => {
      if (watchId !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchId);
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [activeTripId, currentTrip?.status]);

  // Requirement: Start trip from driver's actual physical device location!
  const handleStartTrip = async () => {
    if (!activeTripId) return;

    setIsAcquiringGps(true);
    let startCoords = driverDeviceCoords;
    try {
      // Always query fresh physical device GPS right when starting the trip
      const fresh = await requestUserLocation(true);
      startCoords = {
        lat: fresh.lat,
        lng: fresh.lng,
        accuracy: fresh.accuracy || 5,
        speed: 0,
        heading: 0
      };
      processAndBroadcastPosition(startCoords);
    } catch (e) {
      console.warn('Could not get fresh device GPS for trip start:', e);
    } finally {
      setIsAcquiringGps(false);
    }

    const res = transitStore.startTrip(activeTripId, startCoords || undefined);
    if (res.success) {
      setFeedback({
        type: 'success',
        msg: startCoords
          ? `تم بدء الرحلة بنجاح من موقع جهازك الفعلي (${startCoords.lat.toFixed(5)}, ${startCoords.lng.toFixed(5)})! يتم الآن بث موقع الحافلة لكافة الركاب وللإدارة مباشرة 🟢`
          : 'تم بدء الرحلة بنجاح! يتم الآن بث موقع الحافلة للركاب وللإدارة مباشرة 🟢'
      });
      refreshData();
      if (startCoords) {
        transitStore.broadcastDriverGps(
          activeTripId,
          startCoords.lat,
          startCoords.lng,
          0,
          startCoords.heading || 0,
          startCoords.accuracy || 5,
          currentUser.id
        );
      }
    } else {
      setFeedback({ type: 'error', msg: res.error || 'تعذر بدء الرحلة' });
    }
  };

  const handleManualBroadcastGps = async () => {
    setIsAcquiringGps(true);
    try {
      const pos = await requestUserLocation();
      processAndBroadcastPosition({
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy
      });
      if (activeTripId) {
        transitStore.broadcastDriverGps(
          activeTripId,
          pos.lat,
          pos.lng,
          0,
          gpsTelemetry.heading,
          pos.accuracy || 5,
          currentUser.id
        );
      }
      setFeedback({ type: 'success', msg: 'تم بث موقع جهازك الفعلي بنجاح لكافة الركاب والإدارة ✓' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: 'تعذر تحديد موقع الجهاز: ' + (err?.message || '') });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsAcquiringGps(false);
    }
  };

  // Requirement: Confirm Boarding -> only during in_progress and for confirmed bookings
  const handleConfirmBoarding = (bookingId: string) => {
    if (!activeTripId) return;
    const res = transitStore.confirmBoarding(activeTripId, bookingId);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم تأكيد صعود الراكب للحافلة بنجاح ✓' });
      setPassengers(transitStore.getTripPassengers(activeTripId));
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', msg: res.error || 'فشل تأكيد الصعود' });
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Requirement: Finish Trip -> non-boarded become no_show
  const handleFinishTrip = () => {
    if (!activeTripId) return;
    setConfirmDialog({
      isOpen: true,
      title: 'إنهاء الرحلة الحالية',
      message: 'هل أنت متأكد من إنهاء الرحلة؟ سيتم تحويل أي راكب لم يصعد بعد إلى حالة (لم يحضر - No Show).',
      confirmLabel: 'تأكيد إنهاء الرحلة',
      type: 'warning',
      onConfirm: () => {
        const res = transitStore.finishTrip(activeTripId);
        if (res.success) {
          setFeedback({
            type: 'success',
            msg: `تم إنهاء الرحلة بنجاح! صعد (${res.boardedCount}) راكب، وسُجّل (${res.noShowCount}) كـ No-Show.`
          });
          setGpsTelemetry(prev => ({ ...prev, active: false }));
          refreshData();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر إنهاء الرحلة' });
        }
      }
    });
  };

  // Requirement: Cancel Trip -> cancels all its bookings
  const handleCancelTrip = (targetTripId?: string, targetRouteName?: string) => {
    const idToCancel = targetTripId || activeTripId;
    if (!idToCancel) return;
    const nameToDisplay = targetRouteName || currentTrip?.routeName || 'الرحلة';

    setConfirmDialog({
      isOpen: true,
      title: 'إلغاء الرحلة',
      message: `هل أنت متأكد من رغبتك في إلغاء ${nameToDisplay}؟ سيتم إشعار جميع الركاب وإلغاء حجوزاتهم فوراً.`,
      confirmLabel: 'تأكيد إلغاء الرحلة',
      type: 'danger',
      onConfirm: () => {
        const res = transitStore.cancelTrip(idToCancel);
        if (res.success) {
          setFeedback({ type: 'success', msg: `تم إلغاء ${nameToDisplay} وجميع حجوزاتها المرتبطة بنجاح ✓` });
          refreshData();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر إلغاء الرحلة' });
        }
      }
    });
  };

  // Driver Launch Trip Modal State
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [routeMode, setRouteMode] = useState<'custom' | 'existing'>('custom');
  const [allStations] = useState<TransitStation[]>(() => transitStore.getStations());
  const [customStartStationId, setCustomStartStationId] = useState('current_location');
  const [customEndStationId, setCustomEndStationId] = useState(allStations[1]?.id || allStations[0]?.id || '');
  const [customRouteName, setCustomRouteName] = useState(() => {
    const endSt = allStations[1]?.nameAr.split('(')[0] || 'الوجهة';
    return `من موقعي الفعلي إلى ${endSt}`;
  });
  const [customRouteColor, setCustomRouteColor] = useState('#0284c7');
  const [selectedRouteId, setSelectedRouteId] = useState(routes[0]?.id || '');
  const [useGpsForExistingRoute, setUseGpsForExistingRoute] = useState(true);
  const [departureTime, setDepartureTime] = useState(() => {
    const d = new Date(Date.now() + 15 * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [tripPrice, setTripPrice] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLaunchTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departureTime) {
      setFeedback({ type: 'error', msg: 'يرجى تحديد موعد الانطلاق' });
      return;
    }

    // Try to get freshest physical GPS reading from device sensor
    let latestCoords = driverDeviceCoords;
    try {
      const fresh = await requestUserLocation(true);
      latestCoords = {
        lat: fresh.lat,
        lng: fresh.lng,
        accuracy: fresh.accuracy || 5,
        speed: 0,
        heading: 0
      };
      setDriverDeviceCoords(latestCoords);
    } catch (e) {
      // keep existing driverDeviceCoords
    }

    const depDate = new Date();
    const [h, m] = departureTime.split(':');
    depDate.setHours(Number(h), Number(m), 0, 0);

    let res;
    if (routeMode === 'custom') {
      if (!customRouteName.trim()) {
        setFeedback({ type: 'error', msg: 'يرجى إدخال اسم المسار' });
        return;
      }
      if (!customStartStationId || !customEndStationId || (customStartStationId !== 'current_location' && customStartStationId === customEndStationId)) {
        setFeedback({ type: 'error', msg: 'يرجى اختيار محطتي انطلاق ووصول مختلفتين' });
        return;
      }
      const isGpsStart = customStartStationId === 'current_location';
      res = transitStore.driverLaunchTrip({
        customRoute: {
          nameAr: customRouteName.trim(),
          startStationId: customStartStationId,
          endStationId: customEndStationId,
          price: tripPrice,
          color: customRouteColor,
          useCurrentLocationAsStart: isGpsStart
        },
        useCurrentLocationAsStart: isGpsStart,
        departureTime: depDate.toISOString(),
        price: tripPrice,
        initialCoords: latestCoords || undefined
      });
    } else {
      if (!selectedRouteId) {
        setFeedback({ type: 'error', msg: 'يرجى اختيار المسار' });
        return;
      }
      res = transitStore.driverLaunchTrip({
        routeId: selectedRouteId,
        useCurrentLocationAsStart: useGpsForExistingRoute,
        departureTime: depDate.toISOString(),
        price: tripPrice,
        initialCoords: latestCoords || undefined
      });
    }

    if (res.success && res.trip) {
      setFeedback({
        type: 'success',
        msg: latestCoords
          ? `تم إطلاق الرحلة بنجاح! تم اعتماد موقع جهازك الفعلي (${latestCoords.lat.toFixed(4)}, ${latestCoords.lng.toFixed(4)}) كمحطة انطلاق أولى للرحلة لتظهر لكافة الركاب 🟢`
          : 'تم إطلاق الرحلة بنجاح وتحديد المسار! أصبحت الرحلة ظاهرة الآن للركاب للحجز الفوري.'
      });
      setShowLaunchModal(false);
      refreshData();
      setActiveTripId(res.trip.id);
    } else {
      setFeedback({ type: 'error', msg: res.error || 'تعذر إطلاق الرحلة' });
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    transitStore.triggerRefresh();
    refreshData();
    if (activeTripId) {
      setPassengers(transitStore.getTripPassengers(activeTripId));
    }
    setFeedback({ type: 'success', msg: 'تم تحديث بيانات الرحلات والركاب بنجاح ✓' });
    setTimeout(() => {
      setIsRefreshing(false);
      setFeedback(null);
    }, 1200);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Driver Header */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-400 font-bold mb-1">
            <Bus className="w-4 h-4" />
            <span>لوحة تحكم السائق المعتمد (/driver-login.html)</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            الكابتن / {currentUser.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            الحافلة: <span className="text-slate-200 font-bold">{currentUser.busDetails?.model}</span> (لوحة: {currentUser.busDetails?.plateNumber}) | المقاعد: {currentUser.busDetails?.seatsCount}
          </p>
        </div>

        {/* Trips selector and Launch New Trip Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            <span>تحديث الرحلات والركاب</span>
          </button>

          <button
            onClick={() => setShowLaunchModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
          >
            <span>+ تحديد مسار وإطلاق رحلة جديدة</span>
          </button>

          {driverTrips.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">الرحلة المعروضة:</span>
              <select
                value={activeTripId || ''}
                onChange={e => setActiveTripId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
              >
                {driverTrips.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.routeName} [{t.status === 'in_progress' ? 'جارية' : t.status === 'completed' ? 'منتهية' : t.status === 'cancelled' ? 'ملغاة' : 'مجدولة'}]
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : 'bg-rose-950/80 border-rose-700 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Driver Launch Route Modal (Supports Custom Driver Defined Route) */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-bold text-amber-400 uppercase">سائق الحافلة</div>
                <h3 className="text-base font-black text-white">تحديد مسار وإطلاق رحلة جديدة</h3>
              </div>
              <button onClick={() => setShowLaunchModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Mode Toggle: Driver Custom Route vs Existing Route */}
            <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setRouteMode('custom')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  routeMode === 'custom'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                تحديد مسار جديد خاص بك
              </button>
              <button
                type="button"
                onClick={() => setRouteMode('existing')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                  routeMode === 'existing'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                اختيار من المسارات المعتمدة
              </button>
            </div>

            {/* Driver Physical Location Status Badge */}
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <div>
                  <div className="font-bold text-white">موقع انطلاق الرحلة: موقع جهازك الفعلي 📍</div>
                  <div className="text-[11px] text-emerald-400 font-mono" dir="ltr">
                    {driverDeviceCoords ? `${driverDeviceCoords.lat.toFixed(5)}, ${driverDeviceCoords.lng.toFixed(5)} (±${driverDeviceCoords.accuracy || 5}m)` : 'جاري قراءة مستشعر GPS من جهازك...'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualBroadcastGps}
                className="text-[10px] text-amber-400 hover:text-amber-300 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700"
              >
                تحديث الإحداثيات 🔄
              </button>
            </div>

            <form onSubmit={handleLaunchTrip} className="space-y-4">
              {routeMode === 'custom' ? (
                /* Driver defines their own custom route! */
                <div className="space-y-3 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">اسم المسار الذي تريد قيادته *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: خط جامعة الملك فيصل - سوق القيصرية"
                      value={customRouteName}
                      onChange={e => setCustomRouteName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">محطة الانطلاق *</label>
                      <select
                        value={customStartStationId}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomStartStationId(val);
                          if (val === 'current_location') {
                            const endSt = allStations.find(s => s.id === customEndStationId);
                            setCustomRouteName(`من موقعي الفعلي إلى ${endSt ? endSt.nameAr.split('(')[0] : 'الوجهة'}`);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                      >
                        <option value="current_location" className="text-emerald-400 font-bold">
                          📍 موقعي الفعلي الحالي (GPS) {driverDeviceCoords ? `(${driverDeviceCoords.lat.toFixed(4)}, ${driverDeviceCoords.lng.toFixed(4)})` : ''}
                        </option>
                        {allStations.map(st => (
                          <option key={st.id} value={st.id}>
                            {st.nameAr.split('(')[0]} ({st.area})
                          </option>
                        ))}
                      </select>
                      {customStartStationId === 'current_location' && (
                        <div className="mt-1.5 text-[10px] text-emerald-300 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>ستكون محطة الانطلاق هي موقع جهازك الفعلي (GPS)</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">محطة الوصول *</label>
                      <select
                        value={customEndStationId}
                        onChange={e => {
                          const val = e.target.value;
                          setCustomEndStationId(val);
                          if (customStartStationId === 'current_location') {
                            const endSt = allStations.find(s => s.id === val);
                            setCustomRouteName(`من موقعي الفعلي إلى ${endSt ? endSt.nameAr.split('(')[0] : 'الوجهة'}`);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        {allStations.map(st => (
                          <option key={st.id} value={st.id}>
                            {st.nameAr.split('(')[0]} ({st.area})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">لون المسار على الخريطة</label>
                    <div className="flex items-center gap-2">
                      {['#0284c7', '#059669', '#d97706', '#e11d48', '#8b5cf6', '#06b6d4'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCustomRouteColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${
                            customRouteColor === c ? 'scale-125 border-white shadow' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Select Existing Route */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">اختر المسار *</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {routes.map(r => (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedRouteId(r.id);
                            setTripPrice(r.price);
                          }}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                            selectedRouteId === r.id
                              ? 'bg-amber-950/40 border-amber-500 text-white shadow-md'
                              : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                            <div>
                              <div className="font-bold text-xs">{r.nameAr}</div>
                              <div className="text-[11px] text-slate-400 line-clamp-1">{r.description}</div>
                            </div>
                          </div>
                          <div className="text-left font-black text-amber-400 text-xs shrink-0">
                            {r.price} ر.س
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Departure from Driver Physical Location Option for Existing Route */}
                  <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <span className="font-bold text-white block">انطلاق المسار من موقع جهازي الفعلي 📍</span>
                        <span className="text-[11px] text-emerald-300">يتم استبدال محطة الانطلاق الأولى بموقعك الفعلي ليبدأ الركاب بتتبعك منه</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={useGpsForExistingRoute}
                      onChange={e => setUseGpsForExistingRoute(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* Time and Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">موعد الانطلاق *</label>
                  <input
                    type="time"
                    required
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">سعر التذكرة للراكب (سقف 8 ر.س) *</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={tripPrice}
                    onChange={e => setTripPrice(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Bus Details Summary */}
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-xs text-slate-300 space-y-1">
                <div className="text-[10px] text-slate-400">حافلتك المسجلة لهذه الرحلة:</div>
                <div className="font-bold text-white">
                  {currentUser.busDetails?.model} (لوحة: {currentUser.busDetails?.plateNumber}) - سعة {currentUser.busDetails?.seatsCount} مقعد
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLaunchModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20"
                >
                  إطلاق الرحلة وإعلانها للركاب الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!currentTrip ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
          <Bus className="w-14 h-14 text-amber-400/60 mx-auto" />
          <div>
            <h4 className="text-white font-black text-base mb-1">لم تقم بإطلاق أي رحلة بعد</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              بصفتك سائقاً معتمداً، يمكنك اختيار المسار المناسب لك وتحديد وقت الانطلاق وسعر التذكرة ليظهر فوراً للركاب في الأحساء.
            </p>
          </div>
          <button
            onClick={() => setShowLaunchModal(true)}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20"
          >
            + حدد مسارك وأطلق رحلتك الآن
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Trip Control Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                {currentTrip.status === 'in_progress' ? (
                  <Navigation className="w-6 h-6 animate-spin text-emerald-400" />
                ) : (
                  <Bus className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">{currentTrip.routeName}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      currentTrip.status === 'in_progress'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : currentTrip.status === 'completed'
                        ? 'bg-slate-800 text-slate-400'
                        : currentTrip.status === 'cancelled'
                        ? 'bg-rose-950 text-rose-400'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {currentTrip.status === 'in_progress'
                      ? 'رحلة جارية على الطريق'
                      : currentTrip.status === 'completed'
                      ? 'رحلة منتهية'
                      : currentTrip.status === 'cancelled'
                      ? 'رحلة ملغاة'
                      : 'مجدولة - جاهزة للانطلاق'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  موعد الانطلاق:{' '}
                  {new Date(currentTrip.departureTime).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}{' '}
                  | ركاب محجوزين: {passengers.length} من {currentTrip.totalSeats} مقعد
                </p>

                {/* Driver Device Physical Location Live Tag */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <div className="flex items-center gap-1.5 text-cyan-300 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>موقع جهاز السائق الفعلي:</span>
                    <strong className="font-mono" dir="ltr">
                      {driverDeviceCoords ? `${driverDeviceCoords.lat.toFixed(5)}, ${driverDeviceCoords.lng.toFixed(5)}` : 'جاري استقبال إشارة GPS...'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualBroadcastGps}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                  >
                    تحديث موقعي الفعلي 🔄
                  </button>
                </div>
              </div>
            </div>

            {/* Driver Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {currentTrip.status === 'scheduled' && (
                <button
                  onClick={handleStartTrip}
                  disabled={isAcquiringGps}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 fill-current ${isAcquiringGps ? 'animate-spin' : ''}`} />
                  <span>{isAcquiringGps ? 'جاري التقاط إحداثيات جهازك...' : 'بدء الرحلة من موقع جهازي الفعلي 🟢'}</span>
                </button>
              )}

              {currentTrip.status === 'in_progress' && (
                <button
                  onClick={handleFinishTrip}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/30 transition-all"
                >
                  <Flag className="w-4 h-4" />
                  <span>إنهاء الرحلة (تم الوصول)</span>
                </button>
              )}

              {currentTrip.status !== 'completed' && currentTrip.status !== 'cancelled' && (
                <button
                  onClick={() => handleCancelTrip()}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  <span>إلغاء الرحلة ✕</span>
                </button>
              )}
            </div>
          </div>

          {/* Real Driver GPS Telemetry Cockpit */}
          {currentTrip.status === 'in_progress' && (
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-2 border-emerald-500/50 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Satellite className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <h4 className="font-black text-white text-sm">
                        لوحة التحكم بنظام التتبع المباشر (GPS Telemetry Cockpit)
                      </h4>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold">
                        بث مباشر نشط للأجهزة الأخرى 📡
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يتم تحديث موقع الحافلة والسرعة والاتجاه وبثها فوراً للركاب على كافة الأجهزة
                    </p>
                  </div>
                </div>

                {/* Real Device GPS Status and Broadcast Button */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <Satellite className="w-3.5 h-3.5 text-emerald-400" />
                    <span>حساس GPS الفعلي لهذا الجهاز (مباشر 100%)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualBroadcastGps}
                    className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-sky-600/30"
                    title="بث إحداثيات هذا الجهاز الحالية فوراً للركاب"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
                    <span>تحديث وبث موقع الجهاز الآن 📡</span>
                  </button>
                </div>
              </div>

              {/* Telemetry Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Speed */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span className="font-medium">السرعة الحالية</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400 font-mono">
                    {gpsTelemetry.speed} <span className="text-xs font-normal text-slate-400">كم/س</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    سرعة واقعية ومحدثة
                  </div>
                </div>

                {/* Heading / Compass */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span className="font-medium">الاتجاه والبوصلة</span>
                    <Compass
                      className="w-4 h-4 text-amber-400 transition-transform duration-500"
                      style={{ transform: `rotate(${gpsTelemetry.heading}deg)` }}
                    />
                  </div>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    {gpsTelemetry.heading}° <span className="text-xs font-bold text-white">({getCompassDirectionAr(gpsTelemetry.heading)})</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    زاوية تحرك الحافلة
                  </div>
                </div>

                {/* Coordinates */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span className="font-medium">إحداثيات GPS</span>
                    <MapPin className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="text-xs font-black text-sky-400 font-mono" dir="ltr">
                    {gpsTelemetry.lat.toFixed(5)}, {gpsTelemetry.lng.toFixed(5)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    دقة الإشارة: ±{gpsTelemetry.accuracy}م
                  </div>
                </div>

                {/* Broadcast Counter */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span className="font-medium">حالة الإرسال</span>
                    <Radio className="w-4 h-4 text-emerald-400 animate-ping" />
                  </div>
                  <div className="text-sm font-black text-white">
                    {gpsTelemetry.broadcastCount} <span className="text-xs text-slate-400 font-normal">تحديث مرسل</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-1">
                    {gpsTelemetry.lastBroadcast ? `آخر بث: ${gpsTelemetry.lastBroadcast.toLocaleTimeString('ar-SA')}` : 'جاري البث...'}
                  </div>
                </div>
              </div>

              {gpsTelemetry.errorMessage && (
                <div className="p-3 rounded-2xl bg-amber-950/80 border border-amber-700 text-amber-200 text-xs flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{gpsTelemetry.errorMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualBroadcastGps}
                    className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                  >
                    إعادة المحاولة وتفعيل GPS 🔄
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Passengers Boarding Management (Left col 7) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    <span>قائمة ركاب الرحلة ({passengers.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    تتحدث تلقائياً كل 15 ثانية | اضغط "تأكيد الصعود" بجانب اسم كل راكب لما يركب الحافلة
                  </p>
                </div>
                <div className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-1 rounded-lg">
                  صعدوا: {passengers.filter(p => p.status === 'boarded').length} / {passengers.length}
                </div>
              </div>

              {passengers.length === 0 ? (
                <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <p className="text-xs text-slate-400">لا يوجد ركاب حجزوا في هذه الرحلة حتى الآن</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {passengers.map(p => {
                    const isBoarded = p.status === 'boarded';
                    const isNoShow = p.status === 'no_show';
                    const isConfirmed = p.status === 'confirmed';

                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                          isBoarded
                            ? 'bg-emerald-950/30 border-emerald-800/60'
                            : isNoShow
                            ? 'bg-rose-950/30 border-rose-800/60'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Passenger Details */}
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                              isBoarded
                                ? 'bg-emerald-500 text-slate-950'
                                : isNoShow
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-800 text-amber-400 border border-slate-700'
                            }`}
                          >
                            #{p.seatNumber}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>{p.passengerName}</span>
                              {isBoarded && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                  تم الصعود ✓
                                </span>
                              )}
                              {isNoShow && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                                  لم يحضر (No Show)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>نزول: {p.dropoffStation}</span>
                              </span>
                              <span className="flex items-center gap-1" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{p.passengerPhone}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Boarding Action Button */}
                        <div>
                          {isConfirmed ? (
                            <button
                              onClick={() => handleConfirmBoarding(p.id)}
                              disabled={currentTrip.status !== 'in_progress'}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                                currentTrip.status === 'in_progress'
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              }`}
                              title={
                                currentTrip.status !== 'in_progress'
                                  ? 'يجب بدء الرحلة أولاً لتأكيد صعود الركاب'
                                  : 'تأكيد صعود الراكب للحافلة'
                              }
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>تأكيد الصعود</span>
                            </button>
                          ) : isBoarded ? (
                            <span className="text-xs text-emerald-400 font-bold px-3 py-1.5 bg-emerald-950/60 rounded-xl border border-emerald-800">
                              صعد للحافلة ✓
                            </span>
                          ) : (
                            <span className="text-xs text-rose-400 font-bold px-3 py-1.5 bg-rose-950/60 rounded-xl border border-rose-800">
                              لم يصعد
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Passenger Dropoff Map (Right col 5) */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-400" />
                  <span>خريطة الركاب ونقاط النزول</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  دبوس لكل راكب يوضح مكان نزوله ورقم مقعده لتسهيل التوقف والتنزيل
                </p>
              </div>

              <AlAhsaMap
                routes={currentRoute ? [currentRoute] : routes}
                trips={[currentTrip]}
                passengerBookings={passengers}
                isDriverView={true}
                interactive={false}
              />
            </div>
          </div>

          {/* Driver's all trips summary table */}
          {driverTrips.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm">سجل رحلاتي ({driverTrips.length})</h4>
                <span className="text-[11px] text-slate-400">بإمكانك التبديل بين رحلاتك أو إلغاء أي رحلة مجدولة</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">المسار</th>
                      <th className="p-3">الانطلاق</th>
                      <th className="p-3">السعر</th>
                      <th className="p-3">المقاعد</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">إجراءات السائق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {driverTrips.map(t => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-white">{t.routeName}</td>
                        <td className="p-3 text-slate-300">
                          {new Date(t.departureTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-amber-400 font-bold">{t.price} ر.س</td>
                        <td className="p-3 text-emerald-400 font-bold">{t.availableSeats} متبقي / {t.totalSeats}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'in_progress' ? 'bg-emerald-950 text-emerald-400' :
                            t.status === 'completed' ? 'bg-slate-800 text-slate-400' :
                            t.status === 'cancelled' ? 'bg-rose-950 text-rose-400' :
                            'bg-sky-950 text-sky-400'
                          }`}>
                            {t.status === 'in_progress' ? 'جارية' : t.status === 'completed' ? 'منتهية' : t.status === 'cancelled' ? 'ملغاة' : 'مجدولة'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setActiveTripId(t.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px]"
                            >
                              عرض في اللوحة
                            </button>
                            {t.status !== 'completed' && t.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelTrip(t.id, t.routeName)}
                                className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[11px]"
                              >
                                إلغاء الرحلة
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* In-App Confirmation Modal */}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
};
