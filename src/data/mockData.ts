import {
  User,
  TransitStation,
  TransitRoute,
  Trip,
  Booking,
  SupportTicket,
  Announcement
} from '../types/transit';

// Geographic reference for Al-Ahsa center: lat ~25.38, lng ~49.58
export const INITIAL_STATIONS: TransitStation[] = [
  { id: 'st-1', nameAr: 'جامعة الملك فيصل (البوابة الرئيسية)', area: 'الهفوف', lat: 25.3402, lng: 49.5921 },
  { id: 'st-2', nameAr: 'سوق القيصرية التاريخي', area: 'الهفوف', lat: 25.3789, lng: 49.5872 },
  { id: 'st-3', nameAr: 'محطة قطار سار الأحساء', area: 'الهفوف', lat: 25.3956, lng: 49.5634 },
  { id: 'st-4', nameAr: 'مستشفى الملك فهد بالهفوف', area: 'الهفوف', lat: 25.3612, lng: 49.5741 },
  { id: 'st-5', nameAr: 'العثيم مول والظهران سنتر', area: 'المبرز', lat: 25.4190, lng: 49.5710 },
  { id: 'st-6', nameAr: 'حي محاسن (بوابة أرامكو)', area: 'المبرز', lat: 25.4352, lng: 49.5489 },
  { id: 'st-7', nameAr: 'قصر إبراهيم الأثري', area: 'الكوت', lat: 25.3755, lng: 49.5835 },
  { id: 'st-8', nameAr: 'معلم جبل القارة ومغارات الشبعان', area: 'القارة', lat: 25.4140, lng: 49.6910 },
  { id: 'st-9', nameAr: 'مدينة العمران - المركز الحضاري', area: 'العمران', lat: 25.4280, lng: 49.7220 },
  { id: 'st-10', nameAr: 'مدينة الطرف - دوار البلدية', area: 'الطرف', lat: 25.3610, lng: 49.7150 },
  { id: 'st-11', nameAr: 'مدينة العيون - المدخل الشمالي', area: 'العيون', lat: 25.6020, lng: 49.5620 },
  { id: 'st-12', nameAr: 'مدينة الجفر - السوق المركزي', area: 'الجفر', lat: 25.3820, lng: 49.7200 },
  { id: 'st-13', nameAr: 'مطار الأحساء الإقليمي (صالة المغادرة)', area: 'الهفوف الغربية', lat: 25.2854, lng: 49.4862 },
  { id: 'st-college', nameAr: 'الكلية التقنية ومجمع الكليات بالأحساء', area: 'الهفوف', lat: 25.3520, lng: 49.5680 }
];

export const INITIAL_ROUTES: TransitRoute[] = [
  {
    id: 'rt-1',
    code: '101',
    nameAr: 'مسار الجامعة والكلية والقطار (الخط الأزرق)',
    color: '#0284c7',
    price: 5,
    stations: [INITIAL_STATIONS[0], INITIAL_STATIONS[13], INITIAL_STATIONS[1], INITIAL_STATIONS[2], INITIAL_STATIONS[3]],
    description: 'يربط جامعة الملك فيصل ومجمع الكلية التقنية بمحطة القطار وسوق القيصرية ومستشفى الملك فهد'
  },
  {
    id: 'rt-2',
    code: '202',
    nameAr: 'شريان المبرز والهفوف والكلية (الخط الأخضر)',
    color: '#059669',
    price: 4,
    stations: [INITIAL_STATIONS[4], INITIAL_STATIONS[5], INITIAL_STATIONS[6], INITIAL_STATIONS[1], INITIAL_STATIONS[13]],
    description: 'خط سريع يربط العثيم مول ومحاسن بقصر إبراهيم والقيصرية ومجمع الكلية التقنية'
  },
  {
    id: 'rt-3',
    code: '303',
    nameAr: 'واحة الشرق وجبل القارة (الخط الكهرماني)',
    color: '#d97706',
    price: 7,
    stations: [INITIAL_STATIONS[1], INITIAL_STATIONS[7], INITIAL_STATIONS[8], INITIAL_STATIONS[9], INITIAL_STATIONS[11]],
    description: 'يجوب قرى الأحساء الشرقية من القيصرية عبر جبل القارة والعمران والطرف والجفر'
  },
  {
    id: 'rt-4',
    code: '404',
    nameAr: 'خط الشمال ومطار الأحساء (الخط الأحمر)',
    color: '#e11d48',
    price: 8,
    stations: [INITIAL_STATIONS[4], INITIAL_STATIONS[10], INITIAL_STATIONS[12]],
    description: 'يربط المبرز بمدينة العيون ومطار الأحساء الإقليمي مباشرة'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin',
    name: 'مسؤول إدارة العمليات',
    phone: '0501112233',
    email: 'admin@hasa-bus.sa',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-10T08:00:00Z'
  }
];

export const INITIAL_TRIPS: Trip[] = [];

export const INITIAL_BOOKINGS: Booking[] = [];

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [];

export const INITIAL_ANNOUNCEMENT: Announcement = {
  id: 'ann-1',
  text: '📢 مرحباً بكم في شبكة حافلات الأحساء. بإمكان السائقين المعتمدين تحديد المسارات والانطلاق، وبإمكان الركاب حجز مقاعدهم مباشرة.',
  active: true,
  publishedAt: new Date().toISOString()
};
