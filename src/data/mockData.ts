import {
  User,
  TransitStation,
  TransitRoute,
  Trip,
  Booking,
  SupportTicket,
  Announcement
} from '../types/transit';

// Authentic Real Geographic Coordinates for Al-Ahsa Landmarks, Colleges & Stations
export const INITIAL_STATIONS: TransitStation[] = [
  {
    id: 'st-college-boys',
    nameAr: 'الكلية التقنية بالأحساء (بنين - طريق الظهران)',
    area: 'المبرز',
    lat: 25.479023,
    lng: 49.542415
  },
  {
    id: 'st-college-girls',
    nameAr: 'الكلية التقنية للبنات بالأحساء (المجمع التقني)',
    area: 'المبرز',
    lat: 25.479942,
    lng: 49.547188
  },
  {
    id: 'st-kfu-main',
    nameAr: 'جامعة الملك فيصل (البوابة الرئيسية والحرم الجامعي)',
    area: 'الهفوف',
    lat: 25.339500,
    lng: 49.597500
  },
  {
    id: 'st-applied-college',
    nameAr: 'الكلية التطبيقية ومجمع كليات جامعة الملك فيصل',
    area: 'الهفوف',
    lat: 25.345000,
    lng: 49.593000
  },
  {
    id: 'st-sharia-college',
    nameAr: 'كلية الشريعة والدراسات الإسلامية بالأحساء',
    area: 'الهفوف الشرقية',
    lat: 25.378000,
    lng: 49.709000
  },
  {
    id: 'st-train-sar',
    nameAr: 'محطة قطار سار الأحساء (الهفوف - طريق الملك فهد)',
    area: 'الهفوف',
    lat: 25.385800,
    lng: 49.578900
  },
  {
    id: 'st-qaisariyah',
    nameAr: 'سوق القيصرية التاريخي والتراثي',
    area: 'الهفوف',
    lat: 25.378500,
    lng: 49.587000
  },
  {
    id: 'st-ibrahim-palace',
    nameAr: 'قصر إبراهيم الأثري (حي الكوت)',
    area: 'الكوت',
    lat: 25.378900,
    lng: 49.586800
  },
  {
    id: 'st-fahad-hospital',
    nameAr: 'مستشفى الملك فهد بالهفوف',
    area: 'الهفوف',
    lat: 25.356600,
    lng: 49.563200
  },
  {
    id: 'st-othaim-mall',
    nameAr: 'العثيم مول الأحساء',
    area: 'المبرز',
    lat: 25.399980,
    lng: 49.577950
  },
  {
    id: 'st-mahasen',
    nameAr: 'حي محاسن (بوابة أرامكو ومجمع الدوائر)',
    area: 'المبرز',
    lat: 25.435200,
    lng: 49.548900
  },
  {
    id: 'st-qarah-mountain',
    nameAr: 'معلم جبل القارة (أرض الحضارات ومغارات الشبعان)',
    area: 'القارة',
    lat: 25.411509,
    lng: 49.692755
  },
  {
    id: 'st-omran',
    nameAr: 'مدينة العمران (المركز الحضاري ومجمع الواحة)',
    area: 'العمران',
    lat: 25.428000,
    lng: 49.722000
  },
  {
    id: 'st-taraf',
    nameAr: 'مدينة الطرف (دوار البلدية وميدان الواحة)',
    area: 'الطرف',
    lat: 25.361000,
    lng: 49.715000
  },
  {
    id: 'st-jafr',
    nameAr: 'مدينة الجفر (السوق المركزي)',
    area: 'الجفر',
    lat: 25.382000,
    lng: 49.720000
  },
  {
    id: 'st-oyun',
    nameAr: 'مدينة العيون (المدخل الشمالي للأحساء)',
    area: 'العيون',
    lat: 25.602000,
    lng: 49.562000
  },
  {
    id: 'st-airport',
    nameAr: 'مطار الأحساء الدولي (صالة المغادرة)',
    area: 'الهفوف الغربية',
    lat: 25.285300,
    lng: 49.485200
  }
];

export const INITIAL_ROUTES: TransitRoute[] = [
  {
    id: 'rt-1',
    code: '101',
    nameAr: 'مسار كليات التقنية وجامعة الملك فيصل والقطار (الخط الأزرق)',
    color: '#0284c7',
    price: 5,
    stations: [
      INITIAL_STATIONS[0], // الكلية التقنية بنين
      INITIAL_STATIONS[1], // الكلية التقنية بنات
      INITIAL_STATIONS[9], // العثيم مول
      INITIAL_STATIONS[5], // محطة قطار سار
      INITIAL_STATIONS[6], // سوق القيصرية
      INITIAL_STATIONS[2], // جامعة الملك فيصل
      INITIAL_STATIONS[3]  // الكلية التطبيقية
    ],
    description: 'يربط الكلية التقنية بنين وبنات والعثيم مول ومحطة قطار سار بالقيصرية وحرم جامعة الملك فيصل'
  },
  {
    id: 'rt-2',
    code: '202',
    nameAr: 'شريان المبرز والهفوف والكلية ومستشفى الملك فهد (الخط الأخضر)',
    color: '#059669',
    price: 4,
    stations: [
      INITIAL_STATIONS[0],  // الكلية التقنية بنين
      INITIAL_STATIONS[10], // حي محاسن
      INITIAL_STATIONS[9],  // العثيم مول
      INITIAL_STATIONS[7],  // قصر إبراهيم
      INITIAL_STATIONS[6],  // سوق القيصرية
      INITIAL_STATIONS[8]   // مستشفى الملك فهد
    ],
    description: 'خط سريع يربط الكلية التقنية ومحاسن والعثيم مول بقصر إبراهيم والقيصرية ومستشفى الملك فهد'
  },
  {
    id: 'rt-3',
    code: '303',
    nameAr: 'واحة الشرق وجبل القارة وكلية الشريعة (الخط الكهرماني)',
    color: '#d97706',
    price: 7,
    stations: [
      INITIAL_STATIONS[6],  // سوق القيصرية
      INITIAL_STATIONS[4],  // كلية الشريعة
      INITIAL_STATIONS[11], // جبل القارة
      INITIAL_STATIONS[12], // العمران
      INITIAL_STATIONS[14], // الجفر
      INITIAL_STATIONS[13]  // الطرف
    ],
    description: 'يجوب واحة وقرى الأحساء الشرقية من القيصرية عبر كلية الشريعة وجبل القارة والعمران والجفر والطرف'
  },
  {
    id: 'rt-4',
    code: '404',
    nameAr: 'خط الشمال ومطار الأحساء الدولي (الخط الأحمر)',
    color: '#e11d48',
    price: 8,
    stations: [
      INITIAL_STATIONS[15], // العيون
      INITIAL_STATIONS[0],  // الكلية التقنية بنين
      INITIAL_STATIONS[9],  // العثيم مول
      INITIAL_STATIONS[5],  // محطة قطار سار
      INITIAL_STATIONS[16]  // مطار الأحساء الدولي
    ],
    description: 'يربط مدينة العيون والكلية التقنية والعثيم مول ومحطة قطار سار بمطار الأحساء الدولي مباشرة'
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
  text: '📢 مرحباً بكم في شبكة وصلني في الأحساء المباشرة. تم ضبط مواقع الكلية التقنية والجامعة ومحطات الأحساء الحقيقية بدقة.',
  active: true,
  publishedAt: new Date().toISOString()
};
