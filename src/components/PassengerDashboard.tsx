import React, { useState, useEffect } from 'react';
import { transitStore } from '../services/transitStore';
import { User, Trip, Booking, TransitRoute, TransitStation, SupportTicket } from '../types/transit';
import { AlAhsaMap } from './AlAhsaMap';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Phone,
  Ticket,
  MapPin,
  CheckCircle2,
  XCircle,
  HelpCircle,
  MessageSquare,
  Bus,
  AlertTriangle,
  ChevronRight,
  Send,
  Navigation,
  RefreshCw,
  LocateFixed,
  Compass,
  Footprints,
  Sparkles,
  Info
} from 'lucide-react';
import {
  requestUserLocation,
  findNearestStation,
  UserCoordinates,
  NearestStationResult,
  isInAlAhsaRegion,
  calculateDistanceMeters,
  formatDistance,
  estimateBusArrivalMinutes
} from '../utils/geoUtils';

interface PassengerDashboardProps {
  currentUser: User;
  routes: TransitRoute[];
  trips: Trip[];
}

export const PassengerDashboard: React.FC<PassengerDashboardProps> = ({
  currentUser,
  routes,
  trips
}) => {
  // Navigation tabs for passenger:
  // 1: trips (الرحلات المتاحة)
  // 2: bookings (حجوزاتي)
  // 3: map (خريطة الأحساء)
  // 4: help (مركز المساعدة)
  const [activeTab, setActiveTab] = useState<'trips' | 'bookings' | 'map' | 'help'>('trips');

  // Geolocation & Nearest Bus Stop State
  const [userCoords, setUserCoords] = useState<UserCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearestStationResult, setNearestStationResult] = useState<NearestStationResult | null>(null);
  const [filterOnlyNearestTrips, setFilterOnlyNearestTrips] = useState<boolean>(false);
  const [mapSelectedStation, setMapSelectedStation] = useState<TransitStation | null>(null);
  const [nearestBookingNotification, setNearestBookingNotification] = useState<string | null>(null);

  // Live Bus Tracking State
  const [trackedTripId, setTrackedTripId] = useState<string | null>(null);

  const handleStartTracking = (tripId: string) => {
    setTrackedTripId(tripId);
    setActiveTab('map');
    if (!userCoords) {
      handleGetLocation().catch(() => {});
    }
  };

  // Auto track active in_progress trip when switching to map tab if none selected
  useEffect(() => {
    if (activeTab === 'map' && !trackedTripId) {
      const activeTrip = trips.find(t => t.status === 'in_progress');
      if (activeTrip) {
        setTrackedTripId(activeTrip.id);
      }
    }
  }, [activeTab, trips, trackedTripId]);

  // Non-blocking auto detection of user physical device location on mount
  useEffect(() => {
    let isMounted = true;
    requestUserLocation()
      .then(coords => {
        if (!isMounted) return;
        setUserCoords(coords);
        const nearest = findNearestStation(coords, routes);
        setNearestStationResult(nearest);
        if (nearest && !mapSelectedStation) {
          setMapSelectedStation(nearest.station);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Booking Modal State
  const [selectedTripForBooking, setSelectedTripForBooking] = useState<Trip | null>(null);
  const [selectedStation, setSelectedStation] = useState<TransitStation | null>(null);
  const [customDropoffName, setCustomDropoffName] = useState<string>('');
  const [customCoords, setCustomCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<Booking | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // My Bookings
  const [myBookings, setMyBookings] = useState<(Booking & { trip?: Trip })[]>([]);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  // Support Center state
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportFeedback, setSupportFeedback] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);

  // Function to request real device location & calculate nearest stop
  const handleGetLocation = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const coords = await requestUserLocation();
      setUserCoords(coords);
      const nearest = findNearestStation(coords, routes);
      setNearestStationResult(nearest);
      if (nearest) {
        setMapSelectedStation(nearest.station);
      }
    } catch (err: any) {
      setLocationError(err?.message || 'تعذر تحديد موقع جهازك الجغرافي. يرجى التأكد من تفعيل صلاحية الموقع.');
    } finally {
      setIsLocating(false);
    }
  };

  // Helper to auto-pick nearest stop on the trip route when booking
  const handleSelectNearestForBooking = async (activeRoute?: TransitRoute) => {
    setIsLocating(true);
    setLocationError(null);
    try {
      let coords = userCoords;
      if (!coords) {
        coords = await requestUserLocation();
        setUserCoords(coords);
      }

      const targetRoutes = activeRoute ? [activeRoute] : routes;
      const nearest = findNearestStation(coords, targetRoutes);
      if (nearest) {
        setSelectedStation(nearest.station);
        setCustomDropoffName('');
        setCustomCoords(null);
        setNearestBookingNotification(
          `تم اختيار أقرب محطة: ${nearest.station.nameAr} (${nearest.formattedDistance} تقريباً)`
        );
        setTimeout(() => setNearestBookingNotification(null), 4000);
      }
    } catch (e: any) {
      setLocationError(e?.message || 'تعذر تحديد أقرب محطة لموقع جهازك الحالي');
    } finally {
      setIsLocating(false);
    }
  };

  // Refresh data function
  const refreshPassengerData = () => {
    setMyBookings(transitStore.getMyBookings());
    const allTickets = transitStore.getSupportTickets();
    setMyTickets(allTickets.filter(t => t.userId === currentUser.id));
  };

  useEffect(() => {
    refreshPassengerData();
    const unsub = transitStore.subscribe(refreshPassengerData);
    return unsub;
  }, [currentUser]);

  // Handle open booking modal
  const handleOpenBooking = (trip: Trip) => {
    setSelectedTripForBooking(trip);
    setBookingError(null);
    setBookingSuccess(null);
    setCustomDropoffName('');
    setCustomCoords(null);

    // Default to the first station in the route if available
    const route = routes.find(r => r.id === trip.routeId);
    if (route && route.stations.length > 0) {
      setSelectedStation(route.stations[route.stations.length - 1]);
    } else {
      setSelectedStation(null);
    }
  };

  // Execute booking submission
  const handleConfirmBooking = () => {
    if (!selectedTripForBooking) return;
    setIsSubmittingBooking(true);
    setBookingError(null);

    const dropoffLabel = customDropoffName.trim() || selectedStation?.nameAr || 'المحطة الأخيرة';
    const dropoffCoords = customCoords || (selectedStation ? { lat: selectedStation.lat, lng: selectedStation.lng } : undefined);

    const result = transitStore.bookTrip(selectedTripForBooking.id, dropoffLabel, dropoffCoords);
    setIsSubmittingBooking(false);

    if (result.success && result.booking) {
      setBookingSuccess(result.booking);
      refreshPassengerData();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // ignore
      }
    } else {
      setBookingError(result.error || 'فشل إتمام الحجز');
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Handle Cancel Booking
  const handleCancelBooking = (bookingId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'إلغاء حجز المقعد',
      message: 'هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟ سيتم استرجاع المقعد للرحلة تلقائياً وإلغاء تذكرتك.',
      confirmLabel: 'تأكيد إلغاء الحجز',
      type: 'danger',
      onConfirm: () => {
        const res = transitStore.cancelBooking(bookingId);
        if (res.success) {
          setCancelFeedback('تم إلغاء الحجز بنجاح ✓');
          setTimeout(() => setCancelFeedback(null), 3000);
          refreshPassengerData();
        } else {
          setCancelFeedback(res.error || 'لا يمكن إلغاء الحجز');
          setTimeout(() => setCancelFeedback(null), 4000);
        }
      }
    });
  };

  // Handle Send Support Ticket
  const handleSendTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject || !supportMessage) return;

    transitStore.createSupportTicket(supportSubject, supportMessage);
    setSupportSubject('');
    setSupportMessage('');
    setSupportFeedback('تم إرسال تذكرتك بنجاح، سيقوم فريق الدعم بالرد قريباً.');
    setTimeout(() => setSupportFeedback(null), 4000);
    refreshPassengerData();
  };

  // Get active route for the currently selected trip in booking modal
  const activeBookingRoute = selectedTripForBooking
    ? routes.find(r => r.id === selectedTripForBooking.routeId)
    : null;

  const [isRefreshing, setIsRefreshing] = useState(false);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Passenger Header & Profile Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-sky-400 font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>لوحة تحكم الراكب المعتمد</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            مرحباً، {currentUser.name} 👋
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            رقم الجوال: <span dir="ltr">{currentUser.phone}</span> | احجز رحلاتك في الأحساء وتتبع الحافلات مباشرة
          </p>
        </div>

        {/* Passenger Main Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-2xl border border-slate-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('trips')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'trips'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>الرحلات المتاحة</span>
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative ${
              activeTab === 'bookings'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>حجوزاتي</span>
            {myBookings.filter(b => b.status === 'confirmed').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] flex items-center justify-center">
                {myBookings.filter(b => b.status === 'confirmed').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'map'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>خريطة الأحساء</span>
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'help'
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>مركز المساعدة</span>
          </button>
        </div>
      </div>

      {/* Geolocation Quick Access Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            nearestStationResult
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
          }`}>
            <LocateFixed className={`w-5 h-5 ${isLocating ? 'animate-spin' : ''}`} />
          </div>
          <div>
            {userCoords ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    <span>موقع جهازك الفعلي (GPS):</span>
                  </span>
                  <span className="text-cyan-300 font-mono font-bold" dir="ltr">
                    {userCoords.lat.toFixed(5)}, {userCoords.lng.toFixed(5)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    (دقة: ±{userCoords.accuracy || 15}م)
                  </span>
                </div>
                {nearestStationResult && (
                  <div className="text-[11px] text-amber-300 mt-1 flex flex-wrap items-center gap-1.5">
                    <span>أقرب محطة حافلات:</span>
                    <strong className="text-white">{nearestStationResult.station.nameAr.split('(')[0]}</strong>
                    <span className="bg-amber-950/80 border border-amber-800/60 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {nearestStationResult.formattedDistance} (~{nearestStationResult.walkingMinutes} دقيقة مشياً)
                    </span>
                    <span className="text-slate-400 text-[10px]">· الخطوط: {nearestStationResult.servingRoutes.map(r => r.code).join(' ، ')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>تحديد موقع جهازك الفعلي (GPS)</span>
                  <span className="bg-sky-950 text-sky-400 text-[10px] px-2 py-0.5 rounded-full border border-sky-800">مباشر</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {isLocating ? 'جاري استقبال إحداثيات جهازك الفعلي عبر مستشعر GPS...' : 'اضغط زر التحديد لمزامنة موقع هاتفك الفعلي واكتشاف أقرب محطة حافلات في الأحساء'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {nearestStationResult ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('map');
                  setMapSelectedStation(nearestStationResult.station);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>عرض على الخريطة</span>
              </button>
              <button
                type="button"
                onClick={() => handleGetLocation()}
                disabled={isLocating}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-all flex items-center gap-1"
                title="إعادة فحص الموقع"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-amber-400' : ''}`} />
                <span>تحديث</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'جاري تحديد موقعك الفعلي...' : 'تحديد موقعي الفعلي وأقرب محطة (GPS)'}</span>
            </button>
          )}
        </div>
      </div>

      {locationError && (
        <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{locationError}</span>
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow"
          >
            إعادة المحاولة عبر GPS 🔄
          </button>
        </div>
      )}

      {cancelFeedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{cancelFeedback}</span>
        </div>
      )}

      {/* TAB 1: AVAILABLE TRIPS */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">الرحلات المتاحة في الأحساء</h3>
              <p className="text-xs text-slate-400">اختر رحلتك وحدد محطة النزول لتحصل على أول مقعد متاح فوراً</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsRefreshing(true);
                  transitStore.triggerRefresh();
                  setCancelFeedback('تم تحديث الرحلات المتاحة بنجاح ✓');
                  setTimeout(() => {
                    setIsRefreshing(false);
                    setCancelFeedback(null);
                  }, 1200);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>تحديث الرحلات الآن</span>
              </button>
              <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                سقف الأسعار: <span className="text-amber-400 font-bold">8 ر.س كحد أقصى</span>
              </div>
            </div>
          </div>

          {/* Nearest Station Filter Banner */}
          {nearestStationResult && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-slate-300">
                  أنت على بعد <strong className="text-amber-300 font-bold">{nearestStationResult.formattedDistance}</strong> من <strong className="text-white font-bold">{nearestStationResult.station.nameAr}</strong> (~{nearestStationResult.walkingMinutes} دقيقة سيراً)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilterOnlyNearestTrips(!filterOnlyNearestTrips)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterOnlyNearestTrips
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-amber-300 hover:bg-slate-700 border border-amber-500/30'
                }`}
              >
                <span>{filterOnlyNearestTrips ? 'عرض كافة الرحلات' : 'تصفية الرحلات المارة بأقرب محطة'}</span>
              </button>
            </div>
          )}

          {/* Online Drivers Cross-Device Status Strip */}
          {(() => {
            const onlineDrivers = transitStore.getOnlineDrivers();
            if (onlineDrivers.length === 0) return null;
            return (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-emerald-950/50 border border-emerald-500/40 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>السائقون المتصلون الآن من أجهزتهم ({onlineDrivers.length})</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.2 rounded font-bold">بث حي 🟢</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2.5">
                      {onlineDrivers.map(d => (
                        <span key={d.sessionId} className="text-emerald-300 font-semibold flex items-center gap-1">
                          <Bus className="w-3 h-3 text-amber-400" />
                          <span>الكابتن {d.userName} ({d.deviceName})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-800">
                  متاح للركاب فوراً ✓
                </div>
              </div>
            );
          })()}

          {trips
            .filter(t => t.status === 'scheduled' || t.status === 'in_progress')
            .filter(t => {
              if (!filterOnlyNearestTrips || !nearestStationResult) return true;
              const tripRoute = routes.find(r => r.id === t.routeId);
              return tripRoute?.stations.some(s => s.id === nearestStationResult.station.id);
            }).length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-3">
              <Bus className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-white font-black text-sm">
                {filterOnlyNearestTrips ? 'لا توجد رحلات مجدولة حالياً تمر بأقرب محطة' : 'لا توجد رحلات متاحة للحجز حالياً'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {filterOnlyNearestTrips
                  ? 'يمكنك إلغاء التصفية لاستعراض كافة الرحلات في مسارات الأحساء الأخرى.'
                  : 'بانتظار قيام السائقين المعتمدين بتحديد مساراتهم وإطلاق رحلاتهم.'}
              </p>
              {filterOnlyNearestTrips && (
                <button
                  type="button"
                  onClick={() => setFilterOnlyNearestTrips(false)}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  عرض جميع الرحلات
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trips
                .filter(t => t.status === 'scheduled' || t.status === 'in_progress')
                .filter(t => {
                  if (!filterOnlyNearestTrips || !nearestStationResult) return true;
                  const tripRoute = routes.find(r => r.id === t.routeId);
                  return tripRoute?.stations.some(s => s.id === nearestStationResult.station.id);
                })
                .map(trip => {
                  const isStarted = trip.status === 'in_progress';
                  const formattedTime = new Date(trip.departureTime).toLocaleTimeString('ar-SA', {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const passesNearest = nearestStationResult && routes.find(r => r.id === trip.routeId)?.stations.some(s => s.id === nearestStationResult.station.id);

                return (
                  <div
                    key={trip.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Passes Nearest Station Tag */}
                      {passesNearest && (
                        <div className="mb-2.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-[11px] text-amber-300 font-bold flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>تمر بأقرب محطة لك ({nearestStationResult?.station.nameAr.split('(')[0]})</span>
                        </div>
                      )}

                      {/* Route Header & Price */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: trip.routeColor }}
                          />
                          <span className="font-bold text-white text-sm line-clamp-1">
                            {trip.routeName}
                          </span>
                        </div>
                        <div className="text-left shrink-0">
                          <span className="text-lg font-black text-amber-400">{trip.price}</span>
                          <span className="text-[11px] text-slate-400 mr-1">ر.س</span>
                        </div>
                      </div>

                      {/* Status / Timing Badge */}
                      <div className="mb-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-sky-400" />
                          <span>الانطلاق: {formattedTime}</span>
                        </div>
                        {isStarted ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                            جارية على الطريق
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 text-[10px] font-bold">
                            مجدولة
                          </span>
                        )}
                      </div>

                      {/* Explicit Departure Station with Driver GPS Highlight */}
                      {(() => {
                        const tripRoute = routes.find(r => r.id === trip.routeId);
                        const departureStation = tripRoute?.stations?.[0];
                        const isGpsStart = departureStation?.id.includes('gps') || (departureStation?.area && departureStation.area.includes('انطلاق السائق'));

                        if (!departureStation) return null;
                        return (
                          <div className={`mb-3 p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                            isGpsStart
                              ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-300'
                              : 'bg-slate-800/40 border-slate-700/50 text-slate-300'
                          }`}>
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className={`w-3.5 h-3.5 shrink-0 ${isGpsStart ? 'text-emerald-400' : 'text-sky-400'}`} />
                              <span className="text-[11px] text-slate-400 shrink-0">محطة الانطلاق:</span>
                              <span className="font-bold text-white truncate">{departureStation.nameAr}</span>
                            </div>
                            {isGpsStart && (
                              <span className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                موقع السائق الفعلي 📍
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Live Bus GPS Telemetry Card */}
                      {isStarted ? (
                        <div className="mb-3.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span>موقع السائق الفعلي (GPS حي)</span>
                            </span>
                            <span className="text-[11px] font-mono font-bold text-amber-300">
                              ⚡ {typeof trip.currentLocation?.speed === 'number' ? `${trip.currentLocation.speed} كم/س` : '0 كم/س'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300" dir="ltr">
                            <span>{trip.currentLocation ? `${trip.currentLocation.lat.toFixed(5)}, ${trip.currentLocation.lng.toFixed(5)}` : 'جاري استقبال إشارة السائق...'}</span>
                            <span className="text-[10px] text-slate-400">±{trip.currentLocation?.accuracy || 5}م</span>
                          </div>
                        </div>
                      ) : trip.currentLocation ? (
                        <div className="mb-3.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs flex items-center justify-between text-slate-300">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-sky-400" />
                            <span>موقع انطلاق الرحلة (GPS):</span>
                          </span>
                          <span className="font-mono text-cyan-300 text-[10px]" dir="ltr">
                            {trip.currentLocation.lat.toFixed(4)}, {trip.currentLocation.lng.toFixed(4)}
                          </span>
                        </div>
                      ) : null}

                      {/* Driver & Bus Details */}
                      <div className="space-y-2 p-3 bg-slate-800/50 rounded-xl text-xs text-slate-300 mb-4 border border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span>السائق:</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{trip.driverName}</span>
                            {transitStore.getOnlineDrivers().some(d => d.userId === trip.driverId || d.userName === trip.driverName) && (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>متصل الآن 📱</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>الجوال:</span>
                          </span>
                          <span dir="ltr" className="text-sky-400">{trip.driverPhone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">الحافلة:</span>
                          <span className="text-slate-200">{trip.busModel} ({trip.busPlate})</span>
                        </div>
                      </div>

                      {/* Remaining Seats Counter */}
                      <div className="flex items-center justify-between text-xs mb-4">
                        <span className="text-slate-400">المقاعد المتبقية:</span>
                        <span
                          className={`font-black ${
                            trip.availableSeats <= 3 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {trip.availableSeats} من أصل {trip.totalSeats} مقعد
                        </span>
                      </div>
                    </div>

                    {/* Live Bus Tracking Action Button */}
                    <button
                      type="button"
                      onClick={() => handleStartTracking(trip.id)}
                      className={`w-full mb-2.5 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                        isStarted
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-amber-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
                      }`}
                    >
                      <Navigation className={`w-3.5 h-3.5 ${isStarted ? 'text-slate-950 animate-spin' : 'text-sky-400'}`} />
                      <span>{isStarted ? 'تتبع موقع السائق الفعلي على الخريطة مباشرة 🎯' : 'استعراض المسار وتتبع الحافلة 🗺️'}</span>
                    </button>

                    {/* Book Action or Direct Cancel Action if already booked */}
                    {(() => {
                      const passengerTripBooking = myBookings.find(
                        b => b.tripId === trip.id && (b.status === 'confirmed' || b.status === 'boarded')
                      );

                      if (passengerTripBooking) {
                        return (
                          <div className="space-y-2">
                            <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-xs flex items-center justify-between">
                              <div>
                                <div className="font-bold text-emerald-300 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>لديك حجز مؤكد (مقعد #{passengerTripBooking.seatNumber})</span>
                                </div>
                                <div className="text-[11px] text-emerald-400/80 mt-0.5">
                                  وجهة النزول: {passengerTripBooking.dropoffStation}
                                </div>
                              </div>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                                {passengerTripBooking.status === 'boarded' ? 'تم الصعود ✓' : 'مؤكد'}
                              </span>
                            </div>

                            {passengerTripBooking.status === 'confirmed' && !isStarted && (
                              <button
                                onClick={() => handleCancelBooking(passengerTripBooking.id)}
                                className="w-full py-2 rounded-xl font-bold text-xs bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                                <span>إلغاء حجزك في هذه الرحلة</span>
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button
                          onClick={() => handleOpenBooking(trip)}
                          disabled={isStarted || trip.availableSeats <= 0}
                          className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 ${
                            isStarted
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : trip.availableSeats <= 0
                              ? 'bg-rose-950 text-rose-400 cursor-not-allowed border border-rose-900'
                              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/20'
                          }`}
                        >
                          <Ticket className="w-4 h-4" />
                          <span>
                            {isStarted
                              ? 'انطلقت الرحلة (لا يمكن الحجز)'
                              : trip.availableSeats <= 0
                              ? 'الرحلة ممتلئة بالكامل'
                              : 'حجز مقعد الآن'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY BOOKINGS */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">سجل حجوزاتي في حافلات الأحساء</h3>
              <p className="text-xs text-slate-400">تابع حالة صعودك للحافلة، رقم مقعدك، وإمكانية إلغاء الحجز</p>
            </div>
            <button
              onClick={refreshPassengerData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث الحجوزات</span>
            </button>
          </div>

          {myBookings.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/60 border border-slate-800 rounded-3xl p-8">
              <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">لا توجد لديك حجوزات حالية</h4>
              <p className="text-xs text-slate-400 mb-4">تصفح الرحلات المتاحة واحجز رحلتك القادمة الآن</p>
              <button
                onClick={() => setActiveTab('trips')}
                className="px-4 py-2 bg-sky-600 text-white font-bold rounded-xl text-xs hover:bg-sky-500"
              >
                استعراض الرحلات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myBookings.map(b => {
                const trip = b.trip;
                const statusStyles = {
                  confirmed: {
                    label: 'مؤكد (في انتظار الحافلة)',
                    bg: 'bg-sky-950/80 text-sky-400 border-sky-800'
                  },
                  boarded: {
                    label: 'تم تأكيد الصعود للحافلة ✓',
                    bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  },
                  no_show: {
                    label: 'لم يصعد (No Show)',
                    bg: 'bg-rose-950/80 text-rose-400 border-rose-800'
                  },
                  cancelled: {
                    label: 'حجز ملغي',
                    bg: 'bg-slate-800 text-slate-400 border-slate-700'
                  }
                };

                const currentStatus = statusStyles[b.status] || statusStyles.confirmed;

                return (
                  <div
                    key={b.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between"
                  >
                    <div>
                      {/* Ticket header */}
                      <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
                        <div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            تذكرة حافلة رقم #{b.id.slice(-6)}
                          </div>
                          <h4 className="font-bold text-white text-sm">
                            {trip ? trip.routeName : 'رحلة حافلات الأحساء'}
                          </h4>
                        </div>
                        <div className="text-left">
                          <span className="text-lg font-black text-amber-400">{b.price}</span>
                          <span className="text-[11px] text-slate-400 mr-1">ر.س</span>
                        </div>
                      </div>

                      {/* Ticket Seat and Status */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                          <div className="text-[10px] text-slate-400">رقم المقعد المخصص</div>
                          <div className="text-lg font-black text-sky-400">مقعد #{b.seatNumber}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                          <div className="text-[10px] text-slate-400">حالة التذكرة</div>
                          <div className="text-xs font-bold mt-1 text-slate-200">
                            {currentStatus.label}
                          </div>
                        </div>
                      </div>

                      {/* Destination Station */}
                      <div className="p-2.5 rounded-xl bg-slate-800/40 text-xs text-slate-300 mb-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <span>محطة النزول المحددة:</span>
                        </div>
                        <div className="font-bold text-white pr-5">{b.dropoffStation}</div>
                      </div>

                      {/* Driver info */}
                      {trip && (
                        <div className="text-xs text-slate-400 flex items-center justify-between mb-3">
                          <span>السائق: {trip.driverName}</span>
                          <span dir="ltr" className="text-sky-400">{trip.driverPhone}</span>
                        </div>
                      )}

                      {/* Live Bus Tracking from Booking Ticket */}
                      {trip && (
                        <button
                          type="button"
                          onClick={() => handleStartTracking(trip.id)}
                          className="w-full py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Navigation className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span>تتبع حركة حافلة هذه الرحلة مباشرة 🚌</span>
                        </button>
                      )}
                    </div>

                    {/* Cancel action if not started or boarded */}
                    {b.status === 'confirmed' && trip?.status !== 'in_progress' && (
                      <div className="mt-4 pt-3 border-t border-slate-800">
                        <button
                          onClick={() => handleCancelBooking(b.id)}
                          className="w-full py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/40 border border-rose-900/60 transition-colors flex items-center justify-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>إلغاء هذا الحجز</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AL-AHSA MAP & GEOLOCATION & LIVE BUS TRACKING */}
      {activeTab === 'map' && (() => {
        const trackedTrip = trips.find(t => t.id === trackedTripId);
        const busDistMeters = (userCoords && trackedTrip?.currentLocation)
          ? calculateDistanceMeters(userCoords.lat, userCoords.lng, trackedTrip.currentLocation.lat, trackedTrip.currentLocation.lng)
          : null;

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">خريطة شبكة حافلات الأحساء وتتبع الحافلات المباشر</h3>
                <p className="text-xs text-slate-400">
                  تتبع حركة الحافلات الجارية على الطريق مباشرة، واكتشف موقعك عبر GPS وأقرب محطة إليك
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <LocateFixed className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'جاري تحديد موقعك الفعلي...' : 'تحديد موقعي الفعلي (GPS)'}</span>
                </button>
              </div>
            </div>

            {/* Active Buses in Service Quick Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                <span className="font-bold text-white">حافلات الأحساء الجارية على الطريق الآن:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {trips.filter(t => t.status === 'in_progress').length === 0 ? (
                  <span className="text-slate-400 text-xs">لا توجد حافلات متحركة حالياً</span>
                ) : (
                  trips.filter(t => t.status === 'in_progress').map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTrackedTripId(t.id === trackedTripId ? null : t.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                        trackedTripId === t.id
                          ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                          : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.routeColor }} />
                      <span>{t.routeName.split('(')[0]} ({t.busPlate})</span>
                      {trackedTripId === t.id && (
                        <span className="text-[10px] bg-slate-950 text-amber-300 px-1 rounded font-black">
                          تتبع نشط 🎯
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Active Tracked Bus Live Radar Card */}
            {trackedTrip && (
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-emerald-950/60 border-2 border-amber-500/60 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                    <Bus className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-950 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>رادار التتبع المباشر لحركة الحافلة</span>
                      </span>
                      <span className="text-xs text-emerald-400 font-bold">الحافلة تتحرك على المسار الآن</span>
                    </div>
                    <h4 className="text-xl font-black text-white flex items-center gap-2">
                      <span>{trackedTrip.routeName}</span>
                      <span className="text-xs text-amber-300 font-mono bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                        {trackedTrip.busPlate}
                      </span>
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span className="text-slate-200">
                        السائق: <strong className="text-white font-bold">{trackedTrip.driverName}</strong>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-sky-400 font-mono" dir="ltr">{trackedTrip.driverPhone}</span>
                      <span className="text-slate-500">|</span>
                      <span className="text-amber-400 font-bold font-mono">
                        السرعة: {typeof trackedTrip.currentLocation?.speed === 'number' ? `${trackedTrip.currentLocation.speed} كم/س` : '0 كم/س'}
                      </span>
                      {typeof trackedTrip.currentLocation?.heading === 'number' && (
                        <>
                          <span className="text-slate-500">|</span>
                          <span className="text-amber-300 font-bold flex items-center gap-1">
                            <Compass className="w-3.5 h-3.5 text-amber-400" />
                            <span>الاتجاه: {trackedTrip.currentLocation.heading}°</span>
                          </span>
                        </>
                      )}
                      <span className="text-slate-500">|</span>
                      <span className="text-cyan-300 font-mono text-[11px]" dir="ltr">
                        GPS: {trackedTrip.currentLocation?.lat.toFixed(4)}, {trackedTrip.currentLocation?.lng.toFixed(4)}
                      </span>
                      {busDistMeters !== null && (
                        <>
                          <span className="text-slate-500">|</span>
                          <span className="text-emerald-300 font-black flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                            <span>تبعد عن موقعك: {formatDistance(busDistMeters)} (~{estimateBusArrivalMinutes(busDistMeters)} دقائق للوصول)</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setTrackedTripId(null)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all shadow"
                  >
                    إلغاء قفل التتبع ✕
                  </button>
                </div>
              </div>
            )}

            {/* Detailed Nearest Station Card */}
            {nearestStationResult && (
              <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-950/50 via-slate-900 to-sky-950/50 border border-amber-500/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-950/90 border border-amber-800/80 px-2 py-0.5 rounded-full">
                        أقرب محطة حافلات لموقعك
                      </span>
                      <span className="text-xs text-slate-400">· المنطقة: {nearestStationResult.station.area}</span>
                    </div>
                    <h4 className="text-xl font-black text-white">
                      {nearestStationResult.station.nameAr}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <span className="flex items-center gap-1 font-bold text-amber-300">
                        <Footprints className="w-3.5 h-3.5 text-amber-400" />
                        <span>المسافة: {nearestStationResult.formattedDistance}</span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>الوقت التقريبي سيراً: ~{nearestStationResult.walkingMinutes} دقائق</span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                        GPS: {userCoords?.lat.toFixed(4)}, {userCoords?.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Serving routes & Action buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterOnlyNearestTrips(true);
                      setActiveTab('trips');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Bus className="w-3.5 h-3.5" />
                    <span>عرض رحلات هذه المحطة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapSelectedStation(nearestStationResult.station)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>تحديد على الخريطة</span>
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Al-Ahsa Map with User Location Marker, tracked bus radar & connection line */}
            <AlAhsaMap
              routes={routes}
              trips={trips}
              interactive={true}
              userLocation={userCoords ? { lat: userCoords.lat, lng: userCoords.lng, label: `موقع جهازك الفعلي 📍 (${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)})` } : null}
              nearestStationId={nearestStationResult?.station.id}
              selectedStation={mapSelectedStation}
              onSelectStation={st => setMapSelectedStation(st)}
              trackedTripId={trackedTripId}
              onSelectTrip={t => setTrackedTripId(t.id)}
            />
          </div>
        );
      })()}

      {/* TAB 4: HELP CENTER */}
      {activeTab === 'help' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* FAQs */}
          <div className="md:col-span-6 space-y-4">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-sky-400" />
              <span>الأسئلة الشائعة حول حافلات الأحساء</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <h4 className="font-bold text-white mb-1.5">ما هي أقصى تسعيرة لتذكرة الحافلة؟</h4>
                <p className="text-slate-400 leading-relaxed">
                  وفق لائحة النقل المعتمدة في الأحساء، فإن السعر الأقصى لأي تذكرة لا يتجاوز 8 ريالات سعودية، وتبدأ الأسعار من 4 إلى 5 ريالات للمسارات الداخلية.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <h4 className="font-bold text-white mb-1.5">كيف يتم توزيع المقاعد للركاب؟</h4>
                <p className="text-slate-400 leading-relaxed">
                  يتحقق النظام فورياً من توفر المقاعد ويعطيك أول مقعد متاح تلقائياً بمجرد إتمام الحجز.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <h4 className="font-bold text-white mb-1.5">ما هو شرط الفارق الزمني بين الحجوزات؟</h4>
                <p className="text-slate-400 leading-relaxed">
                  يشترط النظام ألا يكون للراكب حجز آخر في رحلة ثانية بفارق زمني أقل من ساعة كاملة، وذلك لضمان التزام الركاب وانسيابية الجداول.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <h4 className="font-bold text-white mb-1.5">كيف يتم تأكيد صعودي للحافلة؟</h4>
                <p className="text-slate-400 leading-relaxed">
                  عند حضورك للحافلة، يضغط السائق على زر "تأكيد الصعود" بجوار اسمك في قائمته المحدثة، فتتحول حالة حجزك فوراً إلى (تم الصعود boarded).
                </p>
              </div>
            </div>
          </div>

          {/* Submit Support Ticket */}
          <div className="md:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5 text-sky-400" />
                <span>إرسال تذكرة دعم للإدارة</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                هل لديك استفسار أو شكوى بخصوص رحلة معينة؟ أرسل تذكرتك وسيرد عليك مشرفو العمليات.
              </p>

              {supportFeedback && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300">
                  {supportFeedback}
                </div>
              )}

              <form onSubmit={handleSendTicket} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">موضوع التذكرة</label>
                  <input
                    type="text"
                    required
                    value={supportSubject}
                    onChange={e => setSupportSubject(e.target.value)}
                    placeholder="مثال: استفسار عن مواعيد حافلات خط الجامعة"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">تفاصيل الرسالة</label>
                  <textarea
                    rows={4}
                    required
                    value={supportMessage}
                    onChange={e => setSupportMessage(e.target.value)}
                    placeholder="اكتب استفسارك بالتفصيل..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال التذكرة</span>
                </button>
              </form>
            </div>

            {/* My Support Tickets History */}
            {myTickets.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-300">تذاكري السابقة ({myTickets.length})</h4>
                <div className="space-y-2.5">
                  {myTickets.map(t => (
                    <div key={t.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{t.subject}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.status === 'open'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-emerald-950 text-emerald-400'
                          }`}
                        >
                          {t.status === 'open' ? 'قيد المراجعة' : 'تم الرد والإغلاق'}
                        </span>
                      </div>
                      <p className="text-slate-400">{t.message}</p>
                      {t.adminReply && (
                        <div className="mt-2 p-2 rounded-lg bg-sky-950/60 border border-sky-800/50 text-sky-200">
                          <span className="font-bold text-[11px] block mb-0.5">رد الإدارة:</span>
                          <span>{t.adminReply}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE BOOKING MODAL */}
      {selectedTripForBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] font-bold text-sky-400 uppercase">حجز مقعد جديد</div>
                <h3 className="text-lg font-black text-white">
                  {selectedTripForBooking.routeName}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTripForBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {bookingSuccess ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-xl font-black text-white">تم تأكيد حجزك بنجاح! 🎉</h4>
                <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">رقم المقعد المخصص:</span>
                    <span className="text-base font-black text-sky-400">مقعد #{bookingSuccess.seatNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">محطة النزول:</span>
                    <span className="font-bold text-white">{bookingSuccess.dropoffStation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">سعر التذكرة:</span>
                    <span className="font-bold text-amber-400">{bookingSuccess.price} ر.س</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">السائق:</span>
                    <span>{selectedTripForBooking.driverName} ({selectedTripForBooking.driverPhone})</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  يرجى الحضور في موعد انطلاق الحافلة، وسيقوم السائق بتأكيد صعودك بمجرد ركوبك.
                </p>
                <button
                  onClick={() => {
                    setSelectedTripForBooking(null);
                    setActiveTab('bookings');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500"
                >
                  عرض في قائمة حجوزاتي
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Trip info brief */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-800/60 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">موعد الانطلاق</span>
                    <span className="font-bold text-white">
                      {new Date(selectedTripForBooking.departureTime).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">السعر المحدد</span>
                    <span className="font-black text-amber-400">{selectedTripForBooking.price} ر.س</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">المقاعد المتوفرة</span>
                    <span className="font-bold text-emerald-400">{selectedTripForBooking.availableSeats} مقعد</span>
                  </div>
                </div>

                {/* Dropoff selection rule: Select from route stations on map or click any point */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="block text-xs font-bold text-white">
                      اختر محطة النزول (اضغط من المسار أو اختر من القائمة):
                    </label>
                    <button
                      type="button"
                      onClick={() => handleSelectNearestForBooking(activeBookingRoute || undefined)}
                      disabled={isLocating}
                      className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <LocateFixed className={`w-3 h-3 text-sky-400 ${isLocating ? 'animate-spin' : ''}`} />
                      <span>{isLocating ? 'جاري الفحص...' : 'أقرب محطة لموقعي'}</span>
                    </button>
                  </div>

                  {nearestBookingNotification && (
                    <div className="mb-2 p-2 px-3 rounded-xl bg-sky-950/90 border border-sky-700 text-xs text-sky-200 flex items-center gap-1.5 animate-in fade-in">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{nearestBookingNotification}</span>
                    </div>
                  )}

                  {/* Stations picker buttons */}
                  {activeBookingRoute && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {activeBookingRoute.stations.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStation(st);
                            setCustomDropoffName('');
                            setCustomCoords(null);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            selectedStation?.id === st.id && !customCoords
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          <span>{st.nameAr}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Interactive Map for clicking any dropoff point on route */}
                  <div className="mb-3">
                    <AlAhsaMap
                      routes={activeBookingRoute ? [activeBookingRoute] : routes}
                      selectedStation={selectedStation}
                      userLocation={userCoords ? { lat: userCoords.lat, lng: userCoords.lng, label: 'موقعك الحالي' } : null}
                      nearestStationId={selectedStation?.id}
                      onSelectStation={st => {
                        setSelectedStation(st);
                        setCustomDropoffName('');
                        setCustomCoords(null);
                      }}
                      onSelectCustomPoint={pt => {
                        setCustomCoords({ lat: pt.lat, lng: pt.lng });
                        setCustomDropoffName(pt.name);
                        setSelectedStation(null);
                      }}
                    />
                  </div>

                  {/* Selected station feedback */}
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs flex items-center justify-between">
                    <span className="text-slate-400">محطة النزول المحددة:</span>
                    <span className="font-bold text-amber-400">
                      {customDropoffName || selectedStation?.nameAr || 'يرجى التحديد من المسار'}
                    </span>
                  </div>
                </div>

                {/* Verification alerts or errors */}
                {bookingError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedTripForBooking(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={isSubmittingBooking}
                    className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 disabled:opacity-50 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmittingBooking ? 'جاري التحقق والحجز...' : 'تأكيد الحجز وتخصيص المقعد'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal */}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
};
