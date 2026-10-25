import React, { useState, useEffect } from 'react';
import { transitStore } from '../services/transitStore';
import {
  User,
  TransitRoute,
  TransitStation,
  Trip,
  Booking,
  SupportTicket,
  Announcement,
  AdminStats,
  ActivePresence
} from '../types/transit';
import { AlAhsaMap } from './AlAhsaMap';
import { ConfirmModal, ConfirmDialogState } from './ConfirmModal';
import {
  Shield,
  TrendingUp,
  DollarSign,
  Users,
  Bus,
  MapPin,
  Calendar,
  Ticket,
  MessageSquare,
  Megaphone,
  Check,
  X,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Navigation,
  Radio,
  Compass,
  Info
} from 'lucide-react';

interface AdminDashboardProps {
  currentUser: User;
  routes: TransitRoute[];
  trips: Trip[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  routes,
  trips
}) => {
  // Navigation tabs for Admin:
  // 'stats' | 'drivers' | 'passengers' | 'routes' | 'trips' | 'bookings' | 'support_announcement'
  const [adminTab, setAdminTab] = useState<'stats' | 'drivers' | 'passengers' | 'routes' | 'trips' | 'bookings' | 'support_announcement'>('stats');

  // Tracked trip for live radar view
  const [adminTrackedTripId, setAdminTrackedTripId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<AdminStats>(transitStore.getAdminStats());
  const [presenceList, setPresenceList] = useState<ActivePresence[]>(() => transitStore.getActivePresence());

  // Drivers & Passengers
  const [drivers, setDrivers] = useState<User[]>(transitStore.getDrivers());
  const [passengers, setPassengers] = useState<User[]>(transitStore.getPassengers());
  const [passengerSearch, setPassengerSearch] = useState('');
  const [editingDriver, setEditingDriver] = useState<User | null>(null);

  // Routes & Stations
  const [stationList, setStationList] = useState<TransitStation[]>(transitStore.getStations());
  const [newRouteCode, setNewRouteCode] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteColor, setNewRouteColor] = useState('#0284c7');
  const [newRoutePrice, setNewRoutePrice] = useState<number>(5);
  const [newRouteStationIds, setNewRouteStationIds] = useState<string[]>([]);
  const [newRouteDescription, setNewRouteDescription] = useState('');
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);

  // Trips Creation (select driver + route + time -> bus & price auto-populate!)
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [tripDriverId, setTripDriverId] = useState('');
  const [tripRouteId, setTripRouteId] = useState('');
  const [tripTime, setTripTime] = useState('');

  // Bookings
  const [allBookings, setAllBookings] = useState<Booking[]>(transitStore.getAllBookings());
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  // Support & Announcement
  const [tickets, setTickets] = useState<SupportTicket[]>(transitStore.getSupportTickets());
  const [announcementText, setAnnouncementText] = useState(transitStore.getAnnouncement().text);
  const [announcementActive, setAnnouncementActive] = useState(transitStore.getAnnouncement().active);
  const [ticketReply, setTicketReply] = useState<{ id: string; reply: string } | null>(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  // Admin name registration state
  const [adminNameInput, setAdminNameInput] = useState(currentUser.name);
  const [isEditingName, setIsEditingName] = useState(false);

  const handleSaveAdminName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminNameInput.trim()) return;
    const res = transitStore.updateAdminName(currentUser.id, adminNameInput.trim());
    if (res.success) {
      setFeedback({ type: 'success', msg: `تم اعتماد وتسجيل اسم مسؤول الإدارة إلى "${adminNameInput.trim()}" بنجاح ✓` });
      setIsEditingName(false);
      refreshAllAdmin();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'تعذر حفظ الاسم' });
    }
  };

  const refreshAllAdmin = () => {
    setStats(transitStore.getAdminStats());
    setDrivers(transitStore.getDrivers());
    setPassengers(transitStore.getPassengers());
    setStationList(transitStore.getStations());
    setAllBookings(transitStore.getAllBookings());
    setTickets(transitStore.getSupportTickets());
    setPresenceList(transitStore.getActivePresence());
  };

  const [isPurgingMock, setIsPurgingMock] = useState(false);

  const handlePurgeMockData = async () => {
    setIsPurgingMock(true);
    try {
      await transitStore.purgeMockData();
      setFeedback({
        type: 'success',
        msg: 'تم تطهير وحظر جميع الحسابات والتسجيلات الوهمية والافتراضية نهائياً من كافة الأجهزة ومن الخادم ✓'
      });
      refreshAllAdmin();
    } catch {
      setFeedback({ type: 'error', msg: 'حدث خطأ أثناء تطهير البيانات الوهمية' });
    } finally {
      setIsPurgingMock(false);
    }
  };

  const handleDeletePassenger = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف حساب الراكب نهائياً',
      message: `هل أنت متأكد من حذف حساب الراكب (${name}) نهائياً؟ سيتم حظر الحساب وحذفه من الخادم وكافة الأجهزة وإلغاء كافة حجوزاته.`,
      confirmLabel: 'تأكيد الحذف النهائي للراكب',
      type: 'danger',
      onConfirm: async () => {
        const res = await transitStore.deletePassenger(id);
        if (res.success) {
          setFeedback({ type: 'success', msg: `تم حذف حساب الراكب (${name}) نهائياً وحظر عودته من كافة الأجهزة ✓` });
          refreshAllAdmin();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر حذف الراكب' });
        }
      }
    });
  };

  const handleAdminCancelTrip = (tripId: string, routeName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'إلغاء الرحلة',
      message: `هل أنت متأكد من إلغاء رحلة (${routeName})؟ سيتم إلغاء كافة حجوزات الركاب على هذه الرحلة فوراً وإشعارهم.`,
      confirmLabel: 'تأكيد إلغاء الرحلة',
      type: 'danger',
      onConfirm: () => {
        const res = transitStore.cancelTrip(tripId);
        if (res.success) {
          setFeedback({ type: 'success', msg: `تم إلغاء رحلة (${routeName}) وجميع حجوزاتها المرتبطة بنجاح ✓` });
          refreshAllAdmin();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر إلغاء الرحلة' });
        }
      }
    });
  };

  const handleAdminDeleteTrip = (tripId: string, routeName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف الرحلة نهائياً',
      message: `هل أنت متأكد من حذف رحلة (${routeName}) نهائياً من سجلات النظام وقاعدة البيانات؟`,
      confirmLabel: 'تأكيد الحذف النهائي للرحلة',
      type: 'danger',
      onConfirm: async () => {
        const res = await transitStore.deleteTrip(tripId);
        if (res.success) {
          setFeedback({ type: 'success', msg: `تم حذف رحلة (${routeName}) نهائياً من كافة الأجهزة والخادم ✓` });
          refreshAllAdmin();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'تعذر حذف الرحلة' });
        }
      }
    });
  };

  useEffect(() => {
    refreshAllAdmin();
    const unsub = transitStore.subscribe(refreshAllAdmin);
    return unsub;
  }, []);

  // 1. Driver Actions: Approve, Reject, Edit, Delete (with constraints)
  const handleApproveDriver = (id: string) => {
    const res = transitStore.approveDriver(id);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم اعتماد وتفعيل السائق بنجاح ✓' });
      refreshAllAdmin();
    }
  };

  const handleRejectDriver = (id: string) => {
    const res = transitStore.rejectDriver(id);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم رفض طلب السائق.' });
      refreshAllAdmin();
    }
  };

  const handleSaveDriverEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver || !editingDriver.busDetails) return;

    const res = transitStore.updateDriver(editingDriver.id, {
      name: editingDriver.name,
      phone: editingDriver.phone,
      plateNumber: editingDriver.busDetails.plateNumber,
      model: editingDriver.busDetails.model,
      seatsCount: editingDriver.busDetails.seatsCount,
      busType: editingDriver.busDetails.busType
    });

    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم حفظ تعديلات السائق والحافلة معاً بنجاح ✓' });
      setEditingDriver(null);
      refreshAllAdmin();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'تعذر حفظ التعديل' });
    }
  };

  const handleDeleteDriver = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف السائق والحافلة نهائياً',
      message: 'هل أنت متأكد من حذف هذا السائق وحافلته نهائياً؟ سيتم حظر الحساب وحذفه من الخادم وكافة الأجهزة وإلغاء رحلاته القادمة تلقائياً. (لن يتم الحذف إذا كانت لديه رحلة جارية حالياً على الطريق).',
      confirmLabel: 'تأكيد الحذف النهائي للسائق',
      type: 'danger',
      onConfirm: async () => {
        const res = await transitStore.deleteDriver(id);
        if (res.success) {
          setFeedback({ type: 'success', msg: 'تم حذف السائق والحافلة نهائياً وحظر عودته من كافة الأجهزة المسجلة ✓' });
          refreshAllAdmin();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'لا يمكن حذف السائق' });
        }
      }
    });
  };

  // 2. Route Actions: Create, Delete (<= 8 SAR limit strictly verified)
  const handleCreateRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoutePrice > 8) {
      setFeedback({ type: 'error', msg: 'عذراً! السعر الأعلى المسموح به لأي مسار هو 8 ريال سعودي.' });
      return;
    }
    if (newRouteStationIds.length < 2) {
      setFeedback({ type: 'error', msg: 'يرجى اختيار محطتين على الأقل لمسار الحافلة.' });
      return;
    }

    const res = transitStore.createRoute(
      newRouteCode,
      newRouteName,
      newRouteColor,
      newRoutePrice,
      newRouteStationIds,
      newRouteDescription
    );

    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم إنشاء المسار بنجاح وحفظ تسعيرته ✓' });
      setShowAddRouteModal(false);
      setNewRouteCode('');
      setNewRouteName('');
      setNewRouteStationIds([]);
      refreshAllAdmin();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'فشل إنشاء المسار' });
    }
  };

  const handleDeleteRoute = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'حذف مسار الحافلة',
      message: 'هل أنت متأكد من حذف هذا المسار؟ سيتم حذفه من شبكة المسارات المتاحة.',
      confirmLabel: 'تأكيد حذف المسار',
      type: 'danger',
      onConfirm: () => {
        const res = transitStore.deleteRoute(id);
        if (res.success) {
          setFeedback({ type: 'success', msg: 'تم حذف المسار بنجاح ✓' });
          refreshAllAdmin();
        } else {
          setFeedback({ type: 'error', msg: res.error || 'لا يمكن حذف المسار' });
        }
      }
    });
  };

  // 3. Trips Creation: Driver + Route + Time -> Bus & Price auto populate!
  const selectedDriverForTrip = drivers.find(d => d.id === tripDriverId);
  const selectedRouteForTrip = routes.find(r => r.id === tripRouteId);

  const handleCreateTripSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripDriverId || !tripRouteId || !tripTime) {
      setFeedback({ type: 'error', msg: 'يرجى تحديد السائق والمسار ووقت الانطلاق' });
      return;
    }

    // Departure time into ISO
    const depDate = new Date();
    const [hours, minutes] = tripTime.split(':');
    depDate.setHours(Number(hours), Number(minutes), 0, 0);

    const res = transitStore.createTrip(tripDriverId, tripRouteId, depDate.toISOString());
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم جدولة الرحلة بنجاح مع انسحاب الحافلة والسعر تلقائياً ✓' });
      setShowCreateTripModal(false);
      setTripDriverId('');
      setTripRouteId('');
      setTripTime('');
      refreshAllAdmin();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'فشل إنشاء الرحلة' });
    }
  };

  // 4. Bookings Management: Edit / Cancel
  const handleSaveBookingEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    const res = transitStore.updateBookingByAdmin(editingBooking.id, {
      dropoffStation: editingBooking.dropoffStation,
      seatNumber: Number(editingBooking.seatNumber),
      status: editingBooking.status
    });

    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم تعديل بيانات الحجز بنجاح ✓' });
      setEditingBooking(null);
      refreshAllAdmin();
    } else {
      setFeedback({ type: 'error', msg: res.error || 'فشل تعديل الحجز' });
    }
  };

  const handleCancelBookingByAdmin = (bookingId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'إلغاء حجز الراكب',
      message: 'هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟',
      confirmLabel: 'تأكيد إلغاء الحجز',
      type: 'danger',
      onConfirm: () => {
        const res = transitStore.cancelBooking(bookingId);
        if (res.success) {
          setFeedback({ type: 'success', msg: 'تم إلغاء الحجز بنجاح ✓' });
          refreshAllAdmin();
        }
      }
    });
  };

  // 5. Support & Announcements
  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    transitStore.updateAnnouncement(announcementText, announcementActive);
    setFeedback({ type: 'success', msg: 'تم تحديث ونشر الإعلان العام على الصفحة الرئيسية بنجاح ✓' });
  };

  const handleReplyTicket = (ticketId: string, replyText: string) => {
    if (!replyText.trim()) return;
    const res = transitStore.replyAndCloseTicket(ticketId, replyText);
    if (res.success) {
      setFeedback({ type: 'success', msg: 'تم الرد على التذكرة وإغلاقها بنجاح.' });
      setTicketReply(null);
      refreshAllAdmin();
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Admin Header */}
      <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-rose-400 font-bold mb-1">
            <Shield className="w-4 h-4" />
            <span>لوحة الإدارة المركزية (/admin-login.html)</span>
          </div>
          <h2 className="text-2xl font-black text-white">
            إدارة شبكة حافلات الأحساء
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
            <span className="text-slate-400 font-medium">مسؤول الإدارة المسجل:</span>
            {isEditingName ? (
              <form onSubmit={handleSaveAdminName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={adminNameInput}
                  onChange={e => setAdminNameInput(e.target.value)}
                  placeholder="سجّل اسم مسؤول الإدارة..."
                  className="bg-slate-800 border border-rose-500/70 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>حفظ الاسم</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminNameInput(currentUser.name);
                    setIsEditingName(false);
                  }}
                  className="px-2 py-1 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-black text-rose-300 bg-rose-950/70 border border-rose-800/60 px-2.5 py-0.5 rounded-full">
                  {currentUser.name}
                </span>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-700 transition-colors"
                  title="تعديل أو تسجيل اسم مسؤول الإدارة"
                >
                  <Edit className="w-3 h-3" />
                  <span>خانة تسجيل / تعديل الاسم</span>
                </button>
              </div>
            )}
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-slate-400 hidden sm:inline">إدارة العمليات المركزية وشبكة الحافلات</span>
          </div>
        </div>

        {/* Tab Controls and Refresh Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setIsRefreshing(true);
              transitStore.triggerRefresh();
              refreshAllAdmin();
              setFeedback({ type: 'success', msg: 'تم تحديث كافة بيانات الرحلات والركاب والسائقين بنجاح ✓' });
              setTimeout(() => {
                setIsRefreshing(false);
                setFeedback(null);
              }, 1200);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>تحديث الرحلات والبيانات</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60">
            <button
              onClick={() => setAdminTab('stats')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'stats' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              الإحصائيات
            </button>
            <button
              onClick={() => setAdminTab('drivers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                adminTab === 'drivers' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>السائقون</span>
              {stats.pendingDrivers > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  {stats.pendingDrivers}
                </span>
              )}
            </button>
            <button
              onClick={() => setAdminTab('passengers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                adminTab === 'passengers' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>الركاب</span>
              <span className="w-4 h-4 rounded-full bg-slate-700 text-white text-[10px] font-black flex items-center justify-center">
                {passengers.length}
              </span>
            </button>
            <button
              onClick={() => setAdminTab('routes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'routes' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              المسارات والأسعار
            </button>
            <button
              onClick={() => setAdminTab('trips')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'trips' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              الرحلات
            </button>
            <button
              onClick={() => setAdminTab('bookings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'bookings' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              حجوزات الركاب
            </button>
            <button
              onClick={() => setAdminTab('support_announcement')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                adminTab === 'support_announcement' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              الدعم والموقع
            </button>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Pending Drivers Notification Banner */}
      {stats.pendingDrivers > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/60 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              {stats.pendingDrivers}
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">
                يوجد {stats.pendingDrivers} طلب تسجيل سائق جديد بانتظار موافقة الإدارة!
              </h4>
              <p className="text-xs text-amber-200/80">
                بإمكانك مراجعة بيانات السائق وحافلته والموافقة عليها ليتمكن من الدخول وتحديد مساراته للركاب.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdminTab('drivers')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 shadow-md"
          >
            الانتقال لاعتماد السائقين
          </button>
        </div>
      )}

      {/* TAB 1: STATS (Strict: Revenue strictly from boarded passengers!) */}
      {adminTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Trips */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">إجمالي الرحلات</span>
                <Bus className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.totalTrips}</div>
              <div className="text-[11px] text-emerald-400 mt-1">
                {stats.activeTripsCount} رحلة جارية حالياً
              </div>
            </div>

            {/* Total Bookings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">إجمالي الحجوزات</span>
                <Ticket className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">{stats.totalBookings}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                تذاكر مسجلة بالنظام
              </div>
            </div>

            {/* Occupancy Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">نسبة الإشغال</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">{stats.occupancyRate}%</div>
              <div className="text-[11px] text-slate-400 mt-1">
                معدل ملء المقاعد
              </div>
            </div>

            {/* Revenue strictly from Boarded Passengers */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 shadow-xl bg-gradient-to-br from-slate-900 to-amber-950/20">
              <div className="flex items-center justify-between text-amber-300 mb-2">
                <span className="text-xs font-bold">الإيرادات الفعلية</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">
                {stats.realRevenue} <span className="text-sm font-bold text-slate-300">ر.س</span>
              </div>
              <div className="text-[10px] text-amber-300/80 mt-1">
                * محسوبة فقط من الركاب الصاعدين (Boarded)
              </div>
            </div>

            {/* Pending Driver Requests */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">طلبات السائقين المعلّقة</span>
                <Users className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400">{stats.pendingDrivers}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                في انتظار الموافقة والاعتماد
              </div>
            </div>
          </div>

          {/* Live Cross-Device Connected Presence Radar */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-base font-black text-white">
                      الأجهزة والمستخدمون المتصلون الآن عبر الشبكة ({presenceList.length})
                    </h3>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5 rounded-full font-bold">
                      مزامنة حية لكل الأجهزة ⚡
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    أي مستخدم يدخل من أي هاتف أو كمبيوتر يظهر هنا ولكافة المشتركين في الوقت الفعلي
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-300 font-bold">
                  سائقون: {presenceList.filter(p => p.role === 'driver').length}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-300 font-bold">
                  ركاب: {presenceList.filter(p => p.role === 'passenger').length}
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 font-bold">
                  إدارة: {presenceList.filter(p => p.role === 'admin').length}
                </span>
              </div>
            </div>

            {presenceList.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                جاري تحديث قائمة الأجهزة المتصلة...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {presenceList.map(p => (
                  <div
                    key={p.sessionId}
                    className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        p.role === 'driver' ? 'bg-amber-500/20 text-amber-400' :
                        p.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'
                      }`}>
                        {p.role === 'driver' ? '🚌' : p.role === 'admin' ? '🛡️' : '👤'}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-white truncate flex items-center gap-1.5">
                          <span>{p.userName}</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            p.role === 'driver' ? 'bg-amber-950 text-amber-400' :
                            p.role === 'admin' ? 'bg-rose-950 text-rose-400' : 'bg-sky-950 text-sky-400'
                          }`}>
                            {p.role === 'driver' ? 'سائق' : p.role === 'admin' ? 'إدارة' : 'راكب'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {p.deviceName} | <span className="text-emerald-400">{p.statusText || 'متصل 🟢'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Fleet Operations Room (غرفة العمليات والمراقبة الميدانية المباشرة) */}
          <div className="space-y-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-base font-black text-white">غرفة العمليات والمراقبة الميدانية المباشرة</h3>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      بث GPS حي من أجهزة السائقين 🛰️
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    متابعة حركة حافلات النقل الجماعي بالأحساء مباشرة على الخريطة وسرعاتها وإحداثياتها اللحظية
                  </p>
                </div>
              </div>

              {/* Active Buses Counter */}
              <div className="text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2">
                <Bus className="w-4 h-4 text-amber-400" />
                <span>الحافلات النشطة: <strong className="text-emerald-400 font-bold">{trips.filter(t => t.status === 'in_progress').length}</strong></span>
              </div>
            </div>

            {/* Active Buses Quick Switcher */}
            {trips.filter(t => t.status === 'in_progress').length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>الحافلات المتحركة في الميدان حالياً (اضغط لتثبيت الرادار على الحافلة):</span>
                  {adminTrackedTripId && (
                    <button
                      onClick={() => setAdminTrackedTripId(null)}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      إلغاء التثبيت وعرض كامل الأسطول
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {trips.filter(t => t.status === 'in_progress').map(t => {
                    const isSelected = adminTrackedTripId === t.id;
                    const speed = typeof t.currentLocation?.speed === 'number' ? t.currentLocation.speed : 0;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setAdminTrackedTripId(t.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-amber-950/40 border-amber-500 shadow-lg ring-1 ring-amber-500'
                            : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-amber-400 border border-slate-700 shrink-0">
                            <Bus className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white line-clamp-1">{t.routeName}</div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>السائق: {t.driverName}</span>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono text-amber-300">{t.busPlate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <div className="text-xs font-bold text-emerald-400 font-mono">
                            ⚡ {speed} كم/س
                          </div>
                          <div className="text-[10px] text-sky-400 font-mono" dir="ltr">
                            {t.currentLocation ? `${t.currentLocation.lat.toFixed(3)}, ${t.currentLocation.lng.toFixed(3)}` : 'جاري التحديد'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400 shrink-0" />
                <span>لا توجد حافلات في حالة حركة ميدانية حالياً. عندما يضغط أي سائق "بدء الرحلة" من لوحته، ستظهر حافلته وموقعه الفعلي هنا مباشرة.</span>
              </div>
            )}

            <AlAhsaMap
              routes={routes}
              trips={trips}
              trackedTripId={adminTrackedTripId || (trips.find(t => t.status === 'in_progress')?.id || null)}
              onSelectTrip={(t) => setAdminTrackedTripId(t.id)}
              interactive={true}
            />
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS MANAGEMENT (Approve, Reject, Edit driver & bus, Delete with in_progress check) */}
      {adminTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">إدارة السائقين والحافلات</h3>
              <p className="text-xs text-slate-400">اعتماد السائقين الجدد (Pending)، تعديل السائق وحافلته معاً، وحذف وحظر السائقين نهائياً</p>
            </div>
            <button
              onClick={handlePurgeMockData}
              disabled={isPurgingMock}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold flex items-center gap-2 transition shadow-sm disabled:opacity-50"
              title="تطهير وحظر كافة التسجيلات والحسابات الوهمية والافتراضية نهائياً من كافة الأجهزة"
            >
              <span>🧹</span>
              <span>{isPurgingMock ? 'جارِ التطهير...' : 'إلغاء وتطهير التسجيلات الوهمية نهائياً'}</span>
            </button>
          </div>

          {drivers.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-3">
              <Bus className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-white font-bold text-sm">لا يوجد سائقين مسجلين في النظام حالياً</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                عندما يسجل أي سائق جديد عبر رابط التسجيل (/driver-register.html)، سيظهر طلبه فوراً هنا لمراجعته والموافقة عليه أو رفضه.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map(drv => {
              const isPending = drv.status === 'pending';
              const isRejected = drv.status === 'rejected';

              return (
                <div
                  key={drv.id}
                  className={`rounded-2xl p-5 border shadow-xl flex flex-col justify-between ${
                    isPending
                      ? 'bg-amber-950/20 border-amber-600/50'
                      : isRejected
                      ? 'bg-rose-950/20 border-rose-800'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-white text-base">{drv.name}</div>
                        <div className="text-xs text-slate-400" dir="ltr">{drv.phone}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPending
                            ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                            : isRejected
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        {isPending ? 'معلّق (Pending)' : isRejected ? 'مرفوض' : 'معتمد ونشط'}
                      </span>
                    </div>

                    {/* Bus Info */}
                    <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1 mb-4">
                      <div className="text-[10px] text-amber-400 font-bold">بيانات الحافلة المسجلة:</div>
                      <div>الموديل: <span className="text-white font-semibold">{drv.busDetails?.model || '—'}</span></div>
                      <div>رقم اللوحة: <span className="text-white font-semibold">{drv.busDetails?.plateNumber || '—'}</span></div>
                      <div>عدد المقاعد: <span className="text-white font-semibold">{drv.busDetails?.seatsCount || 20} مقعد</span></div>
                      <div>التجهيز: <span className="text-slate-400">{drv.busDetails?.busType || 'عادي'}</span></div>
                    </div>

                    {/* Active In-Progress GPS Telemetry for Driver */}
                    {(() => {
                      const activeDriverTrip = trips.find(t => (t.driverId === drv.id || t.driverName === drv.name) && t.status === 'in_progress');
                      if (!activeDriverTrip) return null;
                      return (
                        <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/80 mb-3 text-xs space-y-1">
                          <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              <span>بث GPS حي نشط الآن</span>
                            </span>
                            <span className="font-mono text-amber-300">
                              ⚡ {typeof activeDriverTrip.currentLocation?.speed === 'number' ? `${activeDriverTrip.currentLocation.speed} كم/س` : '0 كم/س'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 flex items-center justify-between">
                            <span className="text-slate-400 line-clamp-1">الرحلة: {activeDriverTrip.routeName.split('(')[0]}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAdminTrackedTripId(activeDriverTrip.id);
                                setAdminTab('stats');
                              }}
                              className="text-amber-400 hover:underline font-bold text-[10px] shrink-0"
                            >
                              تتبع في الرادار 🛰️
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                    {isPending ? (
                      <div className="w-full flex items-center gap-2">
                        <button
                          onClick={() => handleApproveDriver(drv.id)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>موافقة واعتماد</span>
                        </button>
                        <button
                          onClick={() => handleRejectDriver(drv.id)}
                          className="py-2 px-3 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-xs"
                        >
                          رفض
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingDriver(drv)}
                          className="flex-1 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>تعديل السائق والحافلة</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(drv.id)}
                          className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors"
                          title="حذف السائق"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

          {/* Edit Driver & Bus Modal */}
          {editingDriver && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white">تعديل بيانات السائق وحافلته معاً</h3>
                  <button onClick={() => setEditingDriver(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleSaveDriverEdit} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">اسم السائق</label>
                      <input
                        type="text"
                        required
                        value={editingDriver.name}
                        onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">رقم الجوال</label>
                      <input
                        type="tel"
                        required
                        value={editingDriver.phone}
                        onChange={e => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {editingDriver.busDetails && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">لوحة الحافلة</label>
                        <input
                          type="text"
                          required
                          value={editingDriver.busDetails.plateNumber}
                          onChange={e =>
                            setEditingDriver({
                              ...editingDriver,
                              busDetails: { ...editingDriver.busDetails!, plateNumber: e.target.value }
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">طراز وموديل الحافلة</label>
                        <input
                          type="text"
                          required
                          value={editingDriver.busDetails.model}
                          onChange={e =>
                            setEditingDriver({
                              ...editingDriver,
                              busDetails: { ...editingDriver.busDetails!, model: e.target.value }
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">عدد المقاعد</label>
                        <input
                          type="number"
                          min="10"
                          max="60"
                          required
                          value={editingDriver.busDetails.seatsCount}
                          onChange={e =>
                            setEditingDriver({
                              ...editingDriver,
                              busDetails: { ...editingDriver.busDetails!, seatsCount: Number(e.target.value) }
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-300 mb-1">نوع الحافلة</label>
                        <input
                          type="text"
                          value={editingDriver.busDetails.busType}
                          onChange={e =>
                            setEditingDriver({
                              ...editingDriver,
                              busDetails: { ...editingDriver.busDetails!, busType: e.target.value }
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingDriver(null)}
                      className="px-4 py-2 text-xs text-slate-400"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500"
                    >
                      حفظ التعديلات
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PASSENGERS MANAGEMENT (Admin can view and delete passengers) */}
      {adminTab === 'passengers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">إدارة الركاب المسجلين</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-400 font-bold text-xs border border-slate-700">
                  {passengers.length} راكب مسجل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                عرض بيانات الركاب، متابعة حجوزاتهم، وإمكانية حذف أي حساب راكب مع إلغاء حجوزاته النشطة
              </p>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="بحث بالاسم، الجوال، أو البريد..."
                value={passengerSearch}
                onChange={e => setPassengerSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          {passengers.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-3">
              <Users className="w-12 h-12 text-slate-600 mx-auto" />
              <h4 className="text-white font-bold text-sm">لا يوجد ركاب مسجلين في النظام حالياً</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                عند قيام أي مواطن أو مقيم بالتسجيل كراكب جديد من الصفحة الرئيسية، سيظهر حسابه وبياناته وحجوزاته هنا تلقائياً.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">اسم الراكب</th>
                      <th className="p-3.5">رقم الجوال</th>
                      <th className="p-3.5">البريد الإلكتروني</th>
                      <th className="p-3.5">تاريخ التسجيل</th>
                      <th className="p-3.5">الحجوزات النشطة</th>
                      <th className="p-3.5">إجمالي التذاكر</th>
                      <th className="p-3.5 text-center">إجراء الإدارة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {passengers
                      .filter(p => {
                        const q = passengerSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          p.name.toLowerCase().includes(q) ||
                          p.phone.includes(q) ||
                          p.email.toLowerCase().includes(q)
                        );
                      })
                      .map(p => {
                        const userBookings = allBookings.filter(b => b.passengerId === p.id);
                        const activeBookings = userBookings.filter(b => b.status === 'confirmed').length;
                        const completedBookings = userBookings.filter(b => b.status === 'boarded').length;

                        return (
                          <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-white text-sm">{p.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">ID: {p.id}</div>
                            </td>
                            <td className="p-3.5 text-slate-300" dir="ltr">{p.phone}</td>
                            <td className="p-3.5 text-slate-400">{p.email}</td>
                            <td className="p-3.5 text-slate-400">
                              {p.createdAt
                                ? new Date(p.createdAt).toLocaleDateString('ar-SA', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })
                                : 'مسبقاً'}
                            </td>
                            <td className="p-3.5">
                              {activeBookings > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold text-[11px]">
                                  {activeBookings} حجز مؤكد
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">لا يوجد</span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-300">
                              <span className="font-bold text-white">{userBookings.length}</span> تذكرة ({completedBookings} صعد)
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => handleDeletePassenger(p.id, p.name)}
                                className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm"
                                title="حذف حساب الراكب وإلغاء حجوزاته"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                <span>حذف الراكب</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ROUTES & PRICING (Price limit strictly <= 8 SAR) */}
      {adminTab === 'routes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">المسارات والأسعار</h3>
              <p className="text-xs text-slate-400">
                إضافة مسار وتعديله وحذفه. التسعيرة تخضع لسقف 8 ريالات كحد أقصى.
              </p>
            </div>
            <button
              onClick={() => setShowAddRouteModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مسار جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map(r => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full" style={{ backgroundColor: r.color }} />
                      <h4 className="font-bold text-white text-base">مسار {r.code}: {r.nameAr}</h4>
                    </div>
                    <div className="text-left">
                      <span className="text-lg font-black text-amber-400">{r.price}</span>
                      <span className="text-[11px] text-slate-400 mr-1">ر.س</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{r.description}</p>

                  {/* Stations */}
                  <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 text-xs">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">
                      محطات المسار ({r.stations.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {r.stations.map(st => (
                        <span key={st.id} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700">
                          {st.nameAr.split('(')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => handleDeleteRoute(r.id)}
                    className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                    title="حذف المسار"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Route Modal */}
          {showAddRouteModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white">إضافة مسار حافلة جديد</h3>
                  <button onClick={() => setShowAddRouteModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateRoute} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">رمز المسار</label>
                      <input
                        type="text"
                        required
                        value={newRouteCode}
                        onChange={e => setNewRouteCode(e.target.value)}
                        placeholder="505"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">السعر بالريال (سقف 8 ر.س) *</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        required
                        value={newRoutePrice}
                        onChange={e => setNewRoutePrice(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">اسم المسار بالعربية</label>
                    <input
                      type="text"
                      required
                      value={newRouteName}
                      onChange={e => setNewRouteName(e.target.value)}
                      placeholder="مسار الطرف ↔ محطة قطار سار"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">لون المسار على الخريطة</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newRouteColor}
                        onChange={e => setNewRouteColor(e.target.value)}
                        className="w-10 h-8 rounded cursor-pointer bg-slate-800 border border-slate-700"
                      />
                      <span className="text-xs text-slate-400">{newRouteColor}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">اختر محطات المسار (محطتين على الأقل)</label>
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-slate-800/80 rounded-xl border border-slate-700">
                      {stationList.map(st => {
                        const isSelected = newRouteStationIds.includes(st.id);
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              if (isSelected) {
                                setNewRouteStationIds(newRouteStationIds.filter(id => id !== st.id));
                              } else {
                                setNewRouteStationIds([...newRouteStationIds, st.id]);
                              }
                            }}
                            className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between ${
                              isSelected ? 'bg-sky-600/30 border border-sky-500 text-white' : 'text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <span>{st.nameAr}</span>
                            <span className="text-[10px] text-slate-400">{st.area}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">وصف المسار</label>
                    <input
                      type="text"
                      value={newRouteDescription}
                      onChange={e => setNewRouteDescription(e.target.value)}
                      placeholder="يربط المناطق الشرقية بمركز الهفوف"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRouteModal(false)}
                      className="px-4 py-2 text-xs text-slate-400"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500"
                    >
                      حفظ المسار
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TRIPS CREATION & MANAGEMENT (Auto-populating Bus & Price!) */}
      {adminTab === 'trips' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">جدولة وإدارة الرحلات</h3>
              <p className="text-xs text-slate-400">
                إنشاء رحلة باختيار السائق والمسار والوقت، حيث ينسحب طراز الحافلة والسعر تلقائياً
              </p>
            </div>
            <button
              onClick={() => setShowCreateTripModal(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>جدولة رحلة جديدة</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map(t => (
              <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-white text-sm line-clamp-1">{t.routeName}</span>
                    <span className="text-amber-400 font-black text-base">{t.price} ر.س</span>
                  </div>

                  <div className="text-xs text-slate-300 space-y-1.5 p-3 rounded-xl bg-slate-800/60 mb-3 border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">السائق:</span>
                      <span className="font-bold text-white">{t.driverName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">الحافلة:</span>
                      <span>{t.busModel} ({t.busPlate})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">الانطلاق:</span>
                      <span>
                        {new Date(t.departureTime).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">المقاعد المتبقية:</span>
                      <span className="font-bold text-emerald-400">{t.availableSeats} / {t.totalSeats}</span>
                    </div>
                  </div>

                  {/* Live Driver Device GPS Telemetry Card */}
                  {t.status === 'in_progress' && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 mb-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          <span>بث GPS حي من جهاز السائق</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-300">
                          ⚡ {typeof t.currentLocation?.speed === 'number' ? `${t.currentLocation.speed} كم/س` : '0 كم/س'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300" dir="ltr">
                        <span>{t.currentLocation ? `${t.currentLocation.lat.toFixed(5)}, ${t.currentLocation.lng.toFixed(5)}` : 'جاري استقبال الإشارة...'}</span>
                        <span className="text-[10px] text-slate-400">±{t.currentLocation?.accuracy || 5}م</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminTrackedTripId(t.id);
                          setAdminTab('stats');
                        }}
                        className="w-full mt-1.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                        <span>متابعة موقع السائق على خريطة الرادار المباشرة 🗺️</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      t.status === 'in_progress'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse'
                        : t.status === 'completed'
                        ? 'bg-slate-800 text-slate-400'
                        : t.status === 'cancelled'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-sky-950 text-sky-400 border border-sky-800'
                    }`}
                  >
                    {t.status === 'in_progress'
                      ? 'جارية على الطريق'
                      : t.status === 'completed'
                      ? 'منتهية'
                      : t.status === 'cancelled'
                      ? 'ملغاة'
                      : 'مجدولة - جاهزة'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {t.status !== 'completed' && t.status !== 'cancelled' ? (
                      <button
                        onClick={() => handleAdminCancelTrip(t.id, t.routeName)}
                        className="px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                        title="إلغاء الرحلة وإلغاء حجوزات جميع الركاب"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>إلغاء الرحلة</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAdminDeleteTrip(t.id, t.routeName)}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-bold flex items-center gap-1 transition-all"
                        title="حذف سجل الرحلة نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Create Trip Modal */}
          {showCreateTripModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white">جدولة رحلة جديدة في الأحساء</h3>
                  <button onClick={() => setShowCreateTripModal(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleCreateTripSubmit} className="space-y-3.5">
                  {/* Select Driver */}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">اختر السائق المعتمد *</label>
                    <select
                      required
                      value={tripDriverId}
                      onChange={e => setTripDriverId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- حدد السائق --</option>
                      {drivers.filter(d => d.status === 'active').map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.busDetails?.model || 'حافلة'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Route */}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">اختر المسار *</label>
                    <select
                      required
                      value={tripRouteId}
                      onChange={e => setTripRouteId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- حدد مسار الحافلة --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>
                          مسار {r.code}: {r.nameAr} ({r.price} ر.س)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Departure time */}
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">وقت الانطلاق *</label>
                    <input
                      type="time"
                      required
                      value={tripTime}
                      onChange={e => setTripTime(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  {/* Auto-populated details preview box per requirement */}
                  <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 space-y-1.5">
                    <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">
                      بيانات يتم سحبها تلقائياً من السائق والمسار:
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">الحافلة المخصصة:</span>
                      <span className="font-bold text-white">
                        {selectedDriverForTrip?.busDetails?.model || 'تحدد تلقائياً عند اختيار السائق'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">رقم اللوحة:</span>
                      <span className="font-bold text-white">
                        {selectedDriverForTrip?.busDetails?.plateNumber || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">سعر التذكرة المنسحب:</span>
                      <span className="font-black text-amber-400">
                        {selectedRouteForTrip ? `${selectedRouteForTrip.price} ر.س` : 'ينسحب تلقائياً من المسار'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateTripModal(false)}
                      className="px-4 py-2 text-xs text-slate-400"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 shadow-md"
                    >
                      تأكيد وحفظ الرحلة
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PASSENGER BOOKINGS MANAGEMENT (Edit destination, seat, status, cancel) */}
      {adminTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-white">إدارة حجوزات الركاب</h3>
              <p className="text-xs text-slate-400">تعديل أي حجز (الوجهة، رقم المقعد، الحالة) أو إلغاؤه</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">رقم الحجز</th>
                    <th className="p-3">اسم الراكب</th>
                    <th className="p-3">المقعد</th>
                    <th className="p-3">محطة النزول</th>
                    <th className="p-3">السعر</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allBookings.map(b => (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono text-[11px] text-slate-400">#{b.id.slice(-6)}</td>
                      <td className="p-3 font-bold text-white">{b.passengerName}</td>
                      <td className="p-3 text-sky-400 font-bold">#{b.seatNumber}</td>
                      <td className="p-3">{b.dropoffStation}</td>
                      <td className="p-3 text-amber-400 font-bold">{b.price} ر.س</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.status === 'boarded'
                              ? 'bg-emerald-950 text-emerald-400'
                              : b.status === 'no_show'
                              ? 'bg-rose-950 text-rose-400'
                              : b.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-sky-950 text-sky-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingBooking(b)}
                            className="p-1.5 text-sky-400 hover:bg-slate-800 rounded"
                            title="تعديل الحجز"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCancelBookingByAdmin(b.id)}
                            className="p-1.5 text-rose-400 hover:bg-slate-800 rounded"
                            title="إلغاء الحجز"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit Booking Modal */}
          {editingBooking && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-base font-black text-white">تعديل حجز الراكب #{editingBooking.id.slice(-6)}</h3>
                  <button onClick={() => setEditingBooking(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <form onSubmit={handleSaveBookingEdit} className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">الراكب</label>
                    <input
                      type="text"
                      disabled
                      value={editingBooking.passengerName}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">محطة أو وجهة النزول</label>
                    <input
                      type="text"
                      required
                      value={editingBooking.dropoffStation}
                      onChange={e => setEditingBooking({ ...editingBooking, dropoffStation: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">رقم المقعد</label>
                    <input
                      type="number"
                      required
                      value={editingBooking.seatNumber}
                      onChange={e => setEditingBooking({ ...editingBooking, seatNumber: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">حالة الحجز</label>
                    <select
                      value={editingBooking.status}
                      onChange={e => setEditingBooking({ ...editingBooking, status: e.target.value as any })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="confirmed">مؤكد (confirmed)</option>
                      <option value="boarded">صعد للحافلة (boarded)</option>
                      <option value="no_show">لم يحضر (no_show)</option>
                      <option value="cancelled">ملغي (cancelled)</option>
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingBooking(null)}
                      className="px-4 py-2 text-xs text-slate-400"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500"
                    >
                      حفظ التعديل
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: SUPPORT & ANNOUNCEMENT (Close tickets, reply, public announcement on homepage) */}
      {adminTab === 'support_announcement' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Announcement Manager (Left col 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">إعلان الصفحة الرئيسية للركاب</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                هذا الإعلان يظهر أعلى شاشات الركاب والصفحة الرئيسية مباشرة لإشعارهم بأي مستجدات في شبكة النقل.
              </p>

              <form onSubmit={handleSaveAnnouncement} className="space-y-3.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">نص الإعلان العام</label>
                  <textarea
                    rows={4}
                    required
                    value={announcementText}
                    onChange={e => setAnnouncementText(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="annActive"
                    checked={announcementActive}
                    onChange={e => setAnnouncementActive(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-0"
                  />
                  <label htmlFor="annActive" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    تفعيل ونشر الإعلان للركاب
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30"
                >
                  حفظ وتحديث الإعلان العام
                </button>
              </form>
            </div>
          </div>

          {/* Support Tickets Response (Right col 7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-sky-400" />
                  <h3 className="text-base font-black text-white">تذاكر الدعم الفني للركاب ({tickets.length})</h3>
                </div>
              </div>

              <div className="space-y-3">
                {tickets.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{t.subject}</div>
                        <div className="text-[11px] text-slate-400">
                          المرسل: {t.userName} ({t.userPhone})
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'open' ? 'bg-amber-950 text-amber-400' : 'bg-emerald-950 text-emerald-400'
                        }`}
                      >
                        {t.status === 'open' ? 'تذكرة مفتوحة' : 'مغلقة'}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      {t.message}
                    </p>

                    {t.adminReply && (
                      <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-200">
                        <span className="font-bold text-[10px] block mb-0.5">رد الإدارة:</span>
                        <span>{t.adminReply}</span>
                      </div>
                    )}

                    {t.status === 'open' && (
                      <div className="pt-2">
                        {ticketReply?.id === t.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={ticketReply.reply}
                              onChange={e => setTicketReply({ id: t.id, reply: e.target.value })}
                              placeholder="اكتب رد الإدارة على الراكب..."
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setTicketReply(null)}
                                className="px-3 py-1 text-slate-400"
                              >
                                إلغاء
                              </button>
                              <button
                                onClick={() => handleReplyTicket(t.id, ticketReply.reply)}
                                className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                              >
                                إرسال الرد وإغلاق التذكرة
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTicketReply({ id: t.id, reply: '' })}
                            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px]"
                          >
                            الرد على التذكرة وإغلاقها
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal */}
      <ConfirmModal dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
};
