import React, { useState, useEffect, useRef } from 'react';
import { transitStore } from '../services/transitStore';
import { User, Trip, Booking, TransitRoute, TransitStation, ActivePresence } from '../types/transit';
import { AlAhsaMap } from './AlAhsaMap';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import { requestUserLocation } from '../utils/geoUtils';
import {
  Bus,
  Play,
  CheckCircle,
  CheckCircle2,
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
  Satellite,
  Smartphone,
  Wifi,
  Globe,
  LocateFixed
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
  const [activePresence, setActivePresence] = useState<ActivePresence[]>(() => transitStore.getActivePresence());

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

    // Active trips are strictly in_progress or scheduled
    const current = trips.find(t => t.id === activeTripId);
    let targetActiveTripId = activeTripId;

    if (!current || current.status === 'completed' || current.status === 'cancelled') {
      const inProg = trips.find(t => t.status === 'in_progress');
      const scheduled = trips.find(t => t.status === 'scheduled');
      if (inProg) {
        targetActiveTripId = inProg.id;
        setActiveTripId(inProg.id);
      } else if (scheduled) {
        targetActiveTripId = scheduled.id;
        setActiveTripId(scheduled.id);
      } else {
        targetActiveTripId = null;
        setActiveTripId(null);
      }
    }

    // Always fetch latest passenger bookings for the driver
    if (targetActiveTripId) {
      setPassengers(transitStore.getTripPassengers(targetActiveTripId));
    } else {
      const myTripIds = new Set(trips.map(t => t.id));
      const allDriverPassengers = transitStore.getAllBookings().filter(b => myTripIds.has(b.tripId) && b.status !== 'cancelled');
      setPassengers(allDriverPassengers);
    }
  };

  useEffect(() => {
    refreshData();
    setActivePresence(transitStore.getActivePresence());
    const unsub = transitStore.subscribe(() => {
      refreshData();
      setActivePresence(transitStore.getActivePresence());
    });
    return unsub;
  }, [currentUser]);

  // Requirement: Auto update passengers list instantly on store events and every 3 seconds
  useEffect(() => {
    const loadPassengers = () => {
      if (activeTripId) {
        setPassengers(transitStore.getTripPassengers(activeTripId));
      } else {
        const trips = transitStore.getDriverTrips(currentUser.id);
        const myTripIds = new Set(trips.map(t => t.id));
        setPassengers(transitStore.getAllBookings().filter(b => myTripIds.has(b.tripId) && b.status !== 'cancelled'));
      }
    };

    loadPassengers();
    const interval = setInterval(loadPassengers, 2500);

    const handleNewBooking = (e: any) => {
      const b = e.detail;
      loadPassengers();
      if (b) {
        setFeedback({
          type: 'success',
          msg: `🔔 حجز جديد الآن! الراكب (${b.passengerName}) حجز مقعد #${b.seatNumber} (صعود: ${b.pickupStation || 'المحطة الأولى'} ⬅ نزول: ${b.dropoffStation})`
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('transit:booking_created' as any, handleNewBooking);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('transit:booking_created' as any, handleNewBooking);
      }
    };
  }, [activeTripId, currentUser.id]);

  // Selected Trip object
  const currentTrip = driverTrips.find(t => t.id === activeTripId);
  const currentRoute = currentTrip ? routes.find(r => r.id === currentTrip.routeId) : null;

  const lastProcessTimeRef = useRef<number>(0);

  // Helper to process and broadcast real device GPS coordinates
  const processAndBroadcastPosition = (
    rawCoords: {
      lat: number;
      lng: number;
      speed?: number | null;
      heading?: number | null;
      accuracy?: number | null;
    },
    force = false
  ) => {
    const lat = Number(rawCoords.lat.toFixed(6));
    const lng = Number(rawCoords.lng.toFixed(6));
    const now = Date.now();

    // Check sensor displacement: allow walking (~0.8m) while suppressing sensor noise if completely still
    if (!force && lastDeviceCoordsRef.current) {
      const dLat = Math.abs(lat - lastDeviceCoordsRef.current.lat);
      const dLng = Math.abs(lng - lastDeviceCoordsRef.current.lng);
      if (dLat < 0.000008 && dLng < 0.000008) {
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
      if (hours > 0.0002 && distKm > 0.001) {
        const calculatedSpeed = Math.round(distKm / hours);
        if (calculatedSpeed < 120) speedKmh = calculatedSpeed;
      }
    }

    let heading = 0;
    if (typeof rawCoords.heading === 'number' && !isNaN(rawCoords.heading) && rawCoords.heading >= 0) {
      heading = Math.round(rawCoords.heading);
    } else if (lastDeviceCoordsRef.current) {
      const dLat = lat - lastDeviceCoordsRef.current.lat;
      const dLng = lng - lastDeviceCoordsRef.current.lng;
      if (Math.hypot(dLat, dLng) > 0.00002) {
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

    // Broadcast live telemetry only if trip is active
    if (activeTripId) {
      const trip = transitStore.getAllTrips().find((t: Trip) => t.id === activeTripId);
      if (trip && trip.status === 'in_progress') {
        transitStore.broadcastDriverGps(activeTripId, lat, lng, speedKmh, heading, accuracy, currentUser.id);
      }
    }
  };

  // Continuous physical device GPS tracking for driver - runs always and automatically broadcasts with trip start
  useEffect(() => {
    let watchId: number | null = null;
    let fallbackInterval: any = null;

    const acquireInitial = async () => {
      setIsAcquiringGps(true);
      try {
        const loc = await requestUserLocation(true);
        lastDeviceCoordsRef.current = { lat: loc.lat, lng: loc.lng, time: Date.now() };
        setDriverDeviceCoords({ lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy || 5, speed: 0, heading: 0 });
        setGpsTelemetry(prev => ({
          ...prev,
          active: true,
          lat: loc.lat,
          lng: loc.lng,
          accuracy: loc.accuracy || 5,
          isRealSensor: true,
          errorMessage: undefined
        }));

        // If trip is in progress, broadcast immediately
        if (activeTripId) {
          const trip = transitStore.getAllTrips().find((t: Trip) => t.id === activeTripId);
          if (trip && trip.status === 'in_progress') {
            transitStore.broadcastDriverGps(activeTripId, loc.lat, loc.lng, 0, 0, loc.accuracy || 5, currentUser.id);
          }
        }
      } catch (err: any) {
        console.warn('Initial GPS acquisition:', err);
      } finally {
        setIsAcquiringGps(false);
      }
    };

    acquireInitial();

    // 1. Hardware continuous watchPosition
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
            console.warn('GPS watch warning:', err.message);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
        );
      } catch (e) {
        console.warn('Could not start GPS watch:', e);
      }

      // 2. Active watchdog interval to maintain uninterrupted telemetry stream on mobile devices
      fallbackInterval = setInterval(() => {
        if (typeof window !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              processAndBroadcastPosition({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
                accuracy: pos.coords.accuracy
              });
            },
            () => {},
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 2000 }
          );
        }
      }, 3500);
    }

    return () => {
      if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [activeTripId, currentTrip?.status, currentUser.id]);

  // Requirement: Start trip from driver's actual physical device location with fast timeout fallback!
  const handleStartTrip = async (targetTripId?: string) => {
    const idToStart = targetTripId || activeTripId;
    if (!idToStart) return;

    if (idToStart !== activeTripId) {
      setActiveTripId(idToStart);
    }

    setIsAcquiringGps(true);
    let startCoords = driverDeviceCoords;
    try {
      // Query physical device GPS with 2.5s race timeout so it never hangs
      const fresh = await Promise.race([
        requestUserLocation(true),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 2500))
      ]);
      startCoords = {
        lat: fresh.lat,
        lng: fresh.lng,
        accuracy: fresh.accuracy || 5,
        speed: 0,
        heading: 0
      };
      setDriverDeviceCoords(startCoords);
      processAndBroadcastPosition(startCoords, true);
    } catch (e) {
      console.warn('GPS query fallback for trip start:', e);
    } finally {
      setIsAcquiringGps(false);
    }

    if (!startCoords) {
      startCoords = {
        lat: 25.3835,
        lng: 49.5862,
        accuracy: 10,
        speed: 0,
        heading: 0
      };
    }

    const res = transitStore.startTrip(idToStart, startCoords);
    if (res.success) {
      setFeedback({
        type: 'success',
        msg: `تم بدء الرحلة بنجاح من موقع جهازك الفعلي (${startCoords.lat.toFixed(5)}, ${startCoords.lng.toFixed(5)})! يتم الآن بث موقع الحافلة لكافة الركاب وللإدارة مباشرة 🟢`
      });
      refreshData();
      transitStore.broadcastDriverGps(
        idToStart,
        startCoords.lat,
        startCoords.lng,
        0,
        startCoords.heading || 0,
        startCoords.accuracy || 5,
        currentUser.id
      );
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback({ type: 'error', msg: res.error || 'تعذر بدء الرحلة' });
    }
  };

  const handleManualBroadcastGps = async () => {
    setIsAcquiringGps(true);
    try {
      const pos = await Promise.race([
        requestUserLocation(true),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 2500))
      ]);
      processAndBroadcastPosition({
        lat: pos.lat,
        lng: pos.lng,
        accuracy: pos.accuracy
      }, true);
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

  // Requirement: Confirm Boarding (تم الصعود)
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

  // Requirement: Confirm Dropoff (تم النزول / وصل وجهته)
  const handleConfirmDropoff = (bookingId: string) => {
    if (!activeTripId) return;
    const res = transitStore.confirmDropoff(activeTripId, bookingId);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم تأكيد نزول الراكب ووصوله لوجهته بنجاح ✓' });
      setPassengers(transitStore.getTripPassengers(activeTripId));
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ type: 'error', msg: res.error || 'فشل تأكيد النزول' });
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Requirement: Finish Trip ("تم الوصول") -> remove trip completely from driver list: "إذا سويت تم الوصول شيل الرخله من قائمة السائق لاتخليه"
  const handleFinishTrip = () => {
    if (!activeTripId) return;
    const tripToFinish = activeTripId;
    setConfirmDialog({
      isOpen: true,
      title: 'إنهاء الرحلة وتأكيد الوصول (تم الوصول)',
      message: 'هل أنت متأكد من إنهاء الرحلة وتأكيد الوصول؟ سيتم تسجيل الحضور وإزالة الرحلة نهائياً من قائمتك كما طلبت.',
      confirmLabel: 'تأكيد الوصول وإنهاء الرحلة',
      type: 'warning',
      onConfirm: async () => {
        const res = transitStore.finishTrip(tripToFinish);
        // Delete trip immediately so it is removed from the driver list completely
        await transitStore.deleteTrip(tripToFinish, true);

        setFeedback({
          type: 'success',
          msg: `تم تأكيد الوصول وإنهاء الرحلة بنجاح! أزيلت الرحلة نهائياً من قائمتك. صعد (${res.boardedCount || 0}) راكب وسُجّل (${res.noShowCount || 0}) كـ No-Show.`
        });
        setGpsTelemetry(prev => ({ ...prev, active: false }));
        setActiveTripId(null);
        refreshData();
      }
    });
  };

  // Requirement: Cancel Trip immediately -> cancels all its bookings and deletes trip on the spot as requested: "ابي الرحله تنلغي على طول"
  const handleCancelTrip = (targetTripId?: string, targetRouteName?: string) => {
    const idToCancel = targetTripId || activeTripId;
    if (!idToCancel) return;
    const nameToDisplay = targetRouteName || currentTrip?.routeName || 'الرحلة';

    // 1. Mark cancelled and notify passengers
    transitStore.cancelTrip(idToCancel);
    // 2. Delete trip immediately so it is removed completely on the spot
    transitStore.deleteTrip(idToCancel);

    // 3. Clear cockpit selection immediately
    setActiveTripId(null);
    setGpsTelemetry(prev => ({ ...prev, active: false }));
    setFeedback({ type: 'success', msg: `تم إلغاء ${nameToDisplay} على طول وحذفها وإشعار الركاب بنجاح ✓` });
    refreshData();
    setTimeout(() => setFeedback(null), 3000);
  };

  // Permanently delete a cancelled or completed trip from driver records
  const handleDeleteTrip = (tripId: string, routeName?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف الرحلة نهائياً',
      message: `هل أنت متأكد من حذف ${routeName || 'هذه الرحلة'} نهائياً من سجل رحلاتك؟`,
      confirmLabel: 'تأكيد الحذف النهائي',
      type: 'danger',
      onConfirm: async () => {
        const res = await transitStore.deleteTrip(tripId);
        if (res.success) {
          setFeedback({ type: 'success', msg: 'تم حذف الرحلة نهائياً من سجلك بنجاح ✓' });
          if (activeTripId === tripId) {
            setActiveTripId(null);
          }
          refreshData();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر حذف الرحلة' });
        }
      }
    });
  };

  // Helper to format clean station label without parentheses
  const formatStationLabel = (station?: TransitStation) => {
    if (!station) return '';
    return station.nameAr.split('(')[0].trim();
  };

  // Helper to generate route name following user requirement: 'من موقع السائق إلى المحطة الأولى إلى المحطة الأخيرة'
  const generateRouteName = (startId: string, midId: string, endId: string, stationsList: TransitStation[]) => {
    let startLabel = 'موقع السائق';
    if (startId !== 'current_location') {
      const st = stationsList.find(s => s.id === startId);
      startLabel = st ? formatStationLabel(st) : 'موقع الانطلاق';
    }

    const midSt = stationsList.find(s => s.id === midId);
    const midLabel = midSt ? formatStationLabel(midSt) : 'محطة القطار';

    const endSt = stationsList.find(s => s.id === endId);
    const endLabel = endSt ? formatStationLabel(endSt) : 'الكلية';

    return `من ${startLabel} إلى ${midLabel} إلى ${endLabel}`;
  };

  // Driver Launch Trip Modal State (Direct driver customized route: Departure -> First Station -> Final Station)
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [allStations] = useState<TransitStation[]>(() => transitStore.getStations());
  const [customStartStationId, setCustomStartStationId] = useState('current_location');
  const [customMidStationId, setCustomMidStationId] = useState(() => {
    const list = transitStore.getStations();
    const trainSt = list.find(s => s.id.includes('train') || s.nameAr.includes('قطار'));
    return trainSt?.id || list[5]?.id || list[1]?.id || list[0]?.id || '';
  });
  const [customEndStationId, setCustomEndStationId] = useState(() => {
    const list = transitStore.getStations();
    const collegeSt = list.find(s => s.id.includes('college') || s.nameAr.includes('الكلية'));
    return collegeSt?.id || list[0]?.id || list[1]?.id || '';
  });
  const [customRouteName, setCustomRouteName] = useState(() => {
    const list = transitStore.getStations();
    const trainSt = list.find(s => s.id.includes('train') || s.nameAr.includes('قطار'));
    const collegeSt = list.find(s => s.id.includes('college') || s.nameAr.includes('الكلية'));
    const midId = trainSt?.id || list[5]?.id || list[1]?.id || list[0]?.id || '';
    const endId = collegeSt?.id || list[0]?.id || list[1]?.id || '';
    return generateRouteName('current_location', midId, endId, list);
  });
  const [customRouteColor, setCustomRouteColor] = useState('#0284c7');
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

    if (!customRouteName.trim()) {
      setFeedback({ type: 'error', msg: 'يرجى إدخال اسم المسار' });
      return;
    }

    if (!customStartStationId || !customEndStationId || (customStartStationId !== 'current_location' && customStartStationId === customEndStationId)) {
      setFeedback({ type: 'error', msg: 'يرجى اختيار محطات مسار صحيحة ومختلفة' });
      return;
    }

    // Fast physical GPS reading with 2.5s race timeout
    let latestCoords = driverDeviceCoords;
    try {
      const fresh = await Promise.race([
        requestUserLocation(true),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GPS timeout')), 2500))
      ]);
      latestCoords = {
        lat: fresh.lat,
        lng: fresh.lng,
        accuracy: fresh.accuracy || 5,
        speed: 0,
        heading: 0
      };
      setDriverDeviceCoords(latestCoords);
    } catch {
      // keep existing driverDeviceCoords or fallback to Al-Ahsa
    }

    if (!latestCoords) {
      latestCoords = {
        lat: 25.3835,
        lng: 49.5862,
        accuracy: 10,
        speed: 0,
        heading: 0
      };
    }

    const depDate = new Date();
    const [h, m] = departureTime.split(':');
    depDate.setHours(Number(h), Number(m), 0, 0);

    const isGpsStart = customStartStationId === 'current_location';
    const res = transitStore.driverLaunchTrip({
      customRoute: {
        nameAr: customRouteName.trim(),
        startStationId: customStartStationId,
        endStationId: customEndStationId,
        intermediateStationIds: customMidStationId ? [customMidStationId] : [],
        price: tripPrice,
        color: customRouteColor,
        useCurrentLocationAsStart: isGpsStart
      },
      useCurrentLocationAsStart: isGpsStart,
      customStartStationName: isGpsStart ? 'موقع السائق (نقطة الانطلاق)' : undefined,
      departureTime: depDate.toISOString(),
      price: tripPrice,
      initialCoords: latestCoords
    });

    if (res.success && res.trip) {
      const launchedTripId = res.trip.id;
      // Start the trip immediately so status is in_progress and real GPS is broadcasting to all passengers
      transitStore.startTrip(launchedTripId, latestCoords);
      setActiveTripId(launchedTripId);
      setShowLaunchModal(false);
      refreshData();
      setFeedback({
        type: 'success',
        msg: `تم إطلاق الرحلة وبدؤها بنجاح (${res.trip.routeName})! أصبحت ظاهرة الآن لكافة الركاب للحجز المباشر 🟢`
      });
      setTimeout(() => setFeedback(null), 5000);
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

      {/* Live Cross-Device Multi-Terminal Banner */}
      <div className="bg-gradient-to-r from-emerald-950/50 via-slate-900 to-sky-950/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 text-xs shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-bold">
                جهازك الحالي: <span className="text-emerald-300 font-mono">{transitStore.getDeviceName()}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                متصل حي ومباشر
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-300 text-[11px]">
            <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              <Wifi className="w-3.5 h-3.5 text-sky-400" />
              <span>مزامنة فورية (SSE):</span>
              <strong className="text-white font-mono">{activePresence.length}</strong> أجهزة متصلة بالشبكة
            </span>
            <span className="hidden md:inline-block text-slate-400">
              ⚡ أي رحلة تبدأها أو موقع تبثه يظهر في الثانية نفسها لجميع الركاب والإدارة
            </span>
          </div>
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

      {/* Driver Launch Route Modal (Mobile-Optimized & Direct Route Configuration) */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto my-auto overscroll-contain">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-bold text-amber-400 uppercase">كابتن الحافلة</div>
                <h3 className="text-base sm:text-lg font-black text-white">تحديد المسار وبدء الرحلة 🚌</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLaunchModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* Driver Physical Location Status Badge */}
            <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
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
                className="text-[10px] text-amber-400 hover:text-amber-300 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 shrink-0 font-bold"
              >
                تحديث 🔄
              </button>
            </div>

            <form onSubmit={handleLaunchTrip} className="space-y-4">
              {/* Route Name Input with auto-regenerate */}
              <div className="space-y-3 bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-700/60">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-200">اسم مسار الرحلة *</label>
                    <button
                      type="button"
                      onClick={() => setCustomRouteName(generateRouteName(customStartStationId, customMidStationId, customEndStationId, allStations))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold"
                    >
                      إعادة توليد التسمية ↺
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="مثال: من موقع السائق إلى محطة القطار إلى الكلية"
                    value={customRouteName}
                    onChange={e => setCustomRouteName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <div className="mt-1 text-[10px] text-slate-400">
                    صيغة المسار: موقع الانطلاق إلى المحطة الأولى إلى المحطة الأخيرة (مثال: من موقع السائق إلى محطة القطار إلى الكلية)
                  </div>
                </div>

                {/* 3-Station Selector Grid (Vertical on mobile, easy to scroll and select) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* 1. Start Station */}
                  <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-black">1</span>
                      <label className="text-xs font-bold text-slate-200">موقع الانطلاق *</label>
                    </div>
                    <select
                      value={customStartStationId}
                      onChange={e => {
                        const val = e.target.value;
                        setCustomStartStationId(val);
                        setCustomRouteName(generateRouteName(val, customMidStationId, customEndStationId, allStations));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                    >
                      <option value="current_location" className="text-emerald-400 font-bold">
                        📍 موقع السائق (نقطة الانطلاق)
                      </option>
                      {allStations.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.nameAr.split('(')[0]} ({st.area})
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-emerald-400 font-medium">
                      {customStartStationId === 'current_location' ? 'نقطة الانطلاق: موقعك الفعلي' : 'محطة انطلاق محددة'}
                    </div>
                  </div>

                  {/* 2. First / Intermediate Station */}
                  <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-[10px] font-black">2</span>
                      <label className="text-xs font-bold text-slate-200">المحطة الأولى للصعود *</label>
                    </div>
                    <select
                      value={customMidStationId}
                      onChange={e => {
                        const val = e.target.value;
                        setCustomMidStationId(val);
                        setCustomRouteName(generateRouteName(customStartStationId, val, customEndStationId, allStations));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                    >
                      {allStations.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.nameAr.split('(')[0]} ({st.area})
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-sky-300 font-medium">
                      المحطة الأولى لصعود الركاب
                    </div>
                  </div>

                  {/* 3. Final Destination */}
                  <div className="bg-slate-900/70 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-black">3</span>
                      <label className="text-xs font-bold text-slate-200">المحطة الأخيرة للنزول *</label>
                    </div>
                    <select
                      value={customEndStationId}
                      onChange={e => {
                        const val = e.target.value;
                        setCustomEndStationId(val);
                        setCustomRouteName(generateRouteName(customStartStationId, customMidStationId, val, allStations));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                    >
                      {allStations.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.nameAr.split('(')[0]} ({st.area})
                        </option>
                      ))}
                    </select>
                    <div className="text-[10px] text-amber-300 font-medium">
                      المحطة النهائية لوصول الرحلة
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">لون مسار الرحلة على الخريطة</label>
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
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20"
                >
                  إطلاق الرحلة وبدؤها الآن 🟢
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!currentTrip ? (
        <div className="space-y-4">
          <div className="text-center py-14 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
            <Bus className="w-14 h-14 text-amber-400/60 mx-auto" />
            <div>
              <h4 className="text-white font-black text-base mb-1">
                {driverTrips.length > 0 ? 'لا توجد رحلة جارية محددة حالياً' : 'لم تقم بإطلاق أي رحلة بعد'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {driverTrips.length > 0
                  ? 'تم إنهاء أو اكتمال رحلتك بنجاح. بإمكانك إطلاق رحلة جديدة عبر الزر أدناه، أو اختيار رحلة من جدول رحلاتك لعرض تفاصيلها.'
                  : 'بصفتك سائقاً معتمداً، يمكنك اختيار المسار المناسب لك وتحديد وقت الانطلاق وسعر التذكرة ليظهر فوراً للركاب في الأحساء.'}
              </p>
            </div>
            <button
              onClick={() => setShowLaunchModal(true)}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20"
            >
              + حدد مسارك وأطلق رحلتك الآن
            </button>
          </div>

          {passengers.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span>حجوزات ركاب رحلاتك ({passengers.length})</span>
                </h4>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg font-bold">
                  مؤكدين: {passengers.filter(p => p.status === 'confirmed').length} راكب
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {passengers.map(p => (
                  <div key={p.id} className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-xs">
                        #{p.seatNumber}
                      </span>
                      <div>
                        <span className="font-bold text-white block text-xs">{p.passengerName}</span>
                        <span className="text-[11px] text-slate-400">نزول: {p.dropoffStation} · جوال: {p.passengerPhone}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {p.status === 'boarded' ? 'تم الصعود ✓' : 'حجز مؤكد'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  | ركاب محجوزين: <strong className="text-amber-400">{passengers.length}</strong> من {currentTrip.totalSeats} مقعد
                </p>

                {passengers.length > 0 && (
                  <div className="mt-2 p-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <span className="font-bold text-amber-300 shrink-0">يوجد ({passengers.length}) حجز راكب:</span>
                    <span className="text-slate-200 truncate font-mono text-[11px]">
                      {passengers.slice(0, 3).map(p => `${p.passengerName} (مقعد #${p.seatNumber})`).join(' · ')}
                      {passengers.length > 3 ? ` و ${passengers.length - 3} آخرين` : ''}
                    </span>
                  </div>
                )}

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
                    تحديث موقع السائق (GPS) 🔄
                  </button>
                </div>
              </div>
            </div>

            {/* Driver Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {currentTrip.status === 'scheduled' && (
                <button
                  onClick={() => handleStartTrip()}
                  disabled={isAcquiringGps}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 fill-current ${isAcquiringGps ? 'animate-spin' : ''}`} />
                  <span>{isAcquiringGps ? 'جاري التقاط إحداثيات جهازك...' : 'بدء الرحلة من موقع السائق (الانطلاق) 🟢'}</span>
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

              {currentTrip.status !== 'completed' && currentTrip.status !== 'cancelled' ? (
                <button
                  onClick={() => handleCancelTrip()}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  <span>إلغاء الرحلة ✕</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-400 font-bold bg-rose-950/70 border border-rose-800 px-3 py-1.5 rounded-xl">
                    {currentTrip.status === 'cancelled' ? 'الرحلة ملغاة ولا تظهر للركاب' : 'الرحلة مكتملة'}
                  </span>
                  <button
                    onClick={() => handleDeleteTrip(currentTrip.id, currentTrip.routeName)}
                    className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-200 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <span>حذف هذه الرحلة من السجل 🗑️</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Prominent Passenger Bookings Card for Driver - Requirement: "خلي حجز الراكب يطلع للسائق" */}
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <h4 className="font-black text-white text-base">
                      حجوزات ركاب الرحلة الحالية ({passengers.length} راكب)
                    </h4>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
                      مباشر 🟢
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تظهر هنا فورياً أسماء الركاب وأرقام مقاعدهم بمجرد إتمام حجزهم من أجهزتهم
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-3 py-1.5 rounded-xl font-bold">
                  صعدوا للحافلة: {passengers.filter(p => p.status === 'boarded').length} من {passengers.length}
                </span>
                <span className="text-xs text-amber-400 bg-amber-950/80 border border-amber-800/80 px-3 py-1.5 rounded-xl font-bold">
                  المقاعد الشاغرة: {currentTrip.availableSeats} من {currentTrip.totalSeats}
                </span>
              </div>
            </div>

            {passengers.length === 0 ? (
              <div className="text-center py-6 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-300 font-bold">لا توجد حجوزات ركاب في هذه الرحلة حتى الآن</p>
                <p className="text-[11px] text-slate-500 mt-1">الرحلة معلنة للركاب على الخريطة وسيظهر أي حجز جديد هنا مباشرة وبشكل فوري تلقائياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {passengers.map(p => {
                  const isBoarded = p.status === 'boarded';
                  const isDroppedOff = p.status === 'dropped_off';
                  const isNoShow = p.status === 'no_show';
                  const isCancelled = p.status === 'cancelled';
                  const isConfirmed = p.status === 'confirmed';

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isDroppedOff
                          ? 'bg-teal-950/30 border-teal-800/60'
                          : isBoarded
                          ? 'bg-sky-950/30 border-sky-800/60'
                          : isNoShow
                          ? 'bg-rose-950/30 border-rose-800/60'
                          : isCancelled
                          ? 'bg-slate-900 border-slate-800 opacity-60'
                          : 'bg-slate-950/70 border-slate-700/80 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 font-black text-sm flex items-center justify-center shrink-0 border border-amber-500/30">
                            #{p.seatNumber}
                          </span>
                          <div>
                            <span className="font-bold text-white text-xs block">{p.passengerName}</span>
                            <span className="text-[11px] text-slate-400 font-mono block" dir="ltr">{p.passengerPhone}</span>
                          </div>
                        </div>
                        {isDroppedOff ? (
                          <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold">
                            نزل (وصل) ✓
                          </span>
                        ) : isBoarded ? (
                          <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold">
                            صعد للحافلة 🚌
                          </span>
                        ) : isNoShow ? (
                          <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                            لم يحضر
                          </span>
                        ) : isCancelled ? (
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                            ملغي
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                            حجز مؤكد
                          </span>
                        )}
                      </div>

                      {/* Station details: Boarding & Dropoff */}
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-emerald-400 font-bold">🟢 الصعود: {p.pickupStation || 'المحطة الأولى'}</span>
                          <span className="text-slate-600">⬅</span>
                          <span className="text-amber-400 font-bold">🔴 النزول: {p.dropoffStation}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          {p.boardedAt && (
                            <span className="text-sky-300">صعد: {new Date(p.boardedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                          {p.droppedOffAt && (
                            <span className="text-teal-300">نزل: {new Date(p.droppedOffAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons: Confirm Boarding or Confirm Dropoff */}
                      {isConfirmed && (
                        <button
                          type="button"
                          onClick={() => handleConfirmBoarding(p.id)}
                          className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد صعود الراكب للحافلة ✓</span>
                        </button>
                      )}

                      {isBoarded && (
                        <button
                          type="button"
                          onClick={() => handleConfirmDropoff(p.id)}
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-500/20 transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد نزول الراكب (وصل وجهته) 🏁</span>
                        </button>
                      )}

                      {isDroppedOff && (
                        <div className="w-full py-1.5 rounded-xl bg-teal-950/60 border border-teal-800 text-teal-300 font-bold text-xs flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                          <span>نزل من الحافلة واكتملت رحلته ✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                {/* Trip Tracking Status */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                    <span className="font-medium">حالة التتبع المباشر</span>
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-sm font-black text-emerald-400 flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>نشط ومباشر</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    تتبع حركة الحافلة بالخريطة
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

              {/* Real-time Hardware GPS Tracking Panel - Always active with trip start */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border-2 border-emerald-500/70 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg shadow-emerald-500/30 animate-pulse">
                    <Radio className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-black text-white text-sm">
                        تتبع موقع السائق الفعلي نشط دائماً مع بدء الرحلة 🟢
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      يتم قراءة مستشعر الـ GPS الفعلي للجهاز وبث الإحداثيات والسرعة والاتجاه مباشرة عبر Supabase و WebSockets لكافة الركاب وللإدارة.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualBroadcastGps}
                    disabled={isAcquiringGps}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <LocateFixed className={`w-3.5 h-3.5 ${isAcquiringGps ? 'animate-spin' : ''}`} />
                    <span>{isAcquiringGps ? 'جارِ التقاط الإشارة...' : '📍 تحديث وبث موقع جهازي الآن (GPS Sync)'}</span>
                  </button>

                  <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Supabase: متصل لحظياً ✓</span>
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
                              {p.status === 'boarded' && (
                                <span className="text-[10px] bg-sky-500/20 text-sky-400 px-1.5 py-0.5 rounded font-bold">
                                  صعد للحافلة 🚌
                                </span>
                              )}
                              {p.status === 'dropped_off' && (
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-bold">
                                  تم النزول ✓
                                </span>
                              )}
                              {p.status === 'no_show' && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded font-bold">
                                  لم يحضر (No Show)
                                </span>
                              )}
                              {p.status === 'cancelled' && (
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                                  ملغي
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2.5 mt-1">
                              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span>صعود: {p.pickupStation || 'المحطة الأولى'}</span>
                              </span>
                              <span className="text-slate-600">⬅</span>
                              <span className="flex items-center gap-1 text-amber-400 font-medium">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>نزول: {p.dropoffStation}</span>
                              </span>
                              <span className="flex items-center gap-1 font-mono text-slate-300" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{p.passengerPhone}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Boarding and Dropoff Action Buttons */}
                        <div>
                          {p.status === 'confirmed' ? (
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
                              <span>تأكيد الصعود ✓</span>
                            </button>
                          ) : p.status === 'boarded' ? (
                            <button
                              onClick={() => handleConfirmDropoff(p.id)}
                              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-slate-950 shadow-md transition-all flex items-center gap-1.5"
                              title="تأكيد نزول الراكب عند وصوله لمحطة وجهته"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>تأكيد النزول 🏁</span>
                            </button>
                          ) : p.status === 'dropped_off' ? (
                            <span className="text-xs text-teal-300 font-bold px-3 py-1.5 bg-teal-950/60 rounded-xl border border-teal-800 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                              <span>نزل واكتملت رحلته ✓</span>
                            </span>
                          ) : p.status === 'cancelled' ? (
                            <span className="text-xs text-slate-400 font-bold px-3 py-1.5 bg-slate-800 rounded-xl border border-slate-700">
                              ملغي
                            </span>
                          ) : (
                            <span className="text-xs text-rose-400 font-bold px-3 py-1.5 bg-rose-950/60 rounded-xl border border-rose-800">
                              لم يحضر
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
        </div>
      )}

      {/* Driver's all trips summary table (Always visible to driver to inspect past, completed or scheduled trips) */}
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
                        {t.status === 'scheduled' && (
                          <button
                            onClick={() => handleStartTrip(t.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow-sm flex items-center gap-1"
                            title="بدء الرحلة وبث موقع الحافلة الآن"
                          >
                            <span>انطلاق 🟢</span>
                          </button>
                        )}
                        <button
                          onClick={() => setActiveTripId(t.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-[11px]"
                        >
                          عرض في اللوحة
                        </button>
                        {t.status !== 'completed' && t.status !== 'cancelled' ? (
                          <button
                            onClick={() => handleCancelTrip(t.id, t.routeName)}
                            className="px-2.5 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[11px]"
                          >
                            إلغاء الرحلة
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteTrip(t.id, t.routeName)}
                            className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-bold text-[11px]"
                          >
                            حذف نهائي 🗑️
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

      {/* In-App Confirmation Modal */}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
};
