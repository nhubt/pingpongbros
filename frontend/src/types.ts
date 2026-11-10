export type Role = 'GUEST' | 'MEMBER' | 'TEACHER' | 'STAFF' | 'MANAGER';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  memberId?: number | null;
}

export interface Member {
  id: number;
  name: string;
  phone: string;
  email: string;
  packageType: string;
  startDate: string;
  endDate: string;
  totalTurns: number;
  usedTurns: number;
  status: string;
}

export interface TableInfo {
  id: number;
  tableNumber: number;
  zone: 'teaching' | 'customer';
  capacity: number;
  status: 'available' | 'busy' | 'reserved';
}

export interface Booking {
  id: number;
  tableId: number;
  customerName: string;
  phone: string;
  email: string;
  type: 'WALK_IN' | 'MEMBER' | 'TEACHER';
  startTime: string;
  duration: number;
  people: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  amount: number;
  memberId?: number | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
}

export interface ClassSession {
  id: number;
  teacherId: number;
  teacherName: string;
  date: string;
  startHour: number;
  endHour: number;
  tables: number[];
  status: 'approved' | 'pending' | 'rejected';
  rejectReason?: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
}

export interface Payment {
  id: number;
  type: 'tien_choi' | 'goi';
  amount: number;
  reference: string;
  who: string;
  createdAt: string;
}

export interface DashboardResponse {
  config: {
    courtPrice: number;
    teacherPrice?: number;
    holdLimitMinutes?: number;
    defaultHours: number;
    maxPeoplePerTable: number;
    openingHour: number;
    closingHour: number;
    classCutoffHour: number;
    alertMinutes: number;
  };
  users: User[];
  members: Member[];
  tables: TableInfo[];
  bookings: Booking[];
  classes: ClassSession[];
  payments: Payment[];
  stats: {
    totalRevenue: number;
    todayBookings: number;
    activeMembers: number;
    classesPending: number;
  };
}
