export type UserRole = 'passenger' | 'driver' | 'admin';

export type UserStatus = 'active' | 'pending' | 'rejected';

export interface BusDetails {
  plateNumber: string;
  model: string;
  seatsCount: number;
  busType: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  busDetails?: BusDetails;
  createdAt: string;
}

export interface TransitStation {
  id: string;
  nameAr: string;
  area: string;
  lat: number;
  lng: number;
}

export interface TransitRoute {
  id: string;
  code: string;
  nameAr: string;
  color: string;
  price: number; // max 8 SAR
  stations: TransitStation[];
  description: string;
}

export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface TripLocation {
  lat: number;
  lng: number;
  lastUpdated: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export interface Trip {
  id: string;
  routeId: string;
  routeName: string;
  routeColor: string;
  price: number;
  driverId: string;
  driverName: string;
  driverPhone: string;
  busPlate: string;
  busModel: string;
  totalSeats: number;
  availableSeats: number;
  departureTime: string; // ISO date-time or time
  status: TripStatus;
  currentLocation?: TripLocation;
}

export type BookingStatus = 'confirmed' | 'boarded' | 'no_show' | 'cancelled';

export interface Booking {
  id: string;
  tripId: string;
  passengerId: string;
  passengerName: string;
  passengerPhone: string;
  seatNumber: number;
  dropoffStation: string;
  dropoffCoordinates?: {
    lat: number;
    lng: number;
  };
  price: number;
  status: BookingStatus;
  bookedAt: string;
  boardedAt?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: string;
  adminReply?: string;
}

export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  publishedAt: string;
}

export interface AdminStats {
  totalTrips: number;
  totalBookings: number;
  occupancyRate: number;
  realRevenue: number; // Only from boarded passengers!
  pendingDrivers: number;
  activeTripsCount: number;
}

export interface ActivePresence {
  sessionId: string;
  userId?: string;
  userName: string;
  role: 'driver' | 'passenger' | 'admin' | 'visitor';
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceName: string;
  ip?: string;
  city?: string;
  lastSeen: string;
  isOnline: boolean;
  statusText?: string;
  coords?: {
    lat: number;
    lng: number;
  };
  activeTripId?: string;
}
