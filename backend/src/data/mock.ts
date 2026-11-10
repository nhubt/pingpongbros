import type { Booking, ClassSession, DashboardResponse, Member, Payment, TableInfo, User } from '../types.js';

// Dữ liệu người dùng: Duy nhất tài khoản Quản trị viên (Admin)
const users: User[] = [
  {
    id: 1,
    name: 'Quản Trị Viên (Admin)',
    email: 'admin@pingpongbros.vn',
    phone: '0905123456',
    password: 'admin123',
    role: 'MANAGER',
  },
];

// Toàn bộ dữ liệu mẫu (Hội viên, Đặt bàn, Lớp học, Thanh toán) đã được làm sạch
const members: Member[] = [];
const bookings: Booking[] = [];
const classes: ClassSession[] = [];
const payments: Payment[] = [];

// 16 Bàn bóng bàn tại CLB (Tất cả bàn đều ở trạng thái Sẵn sàng - available)
const tables: TableInfo[] = [
  { id: 1, tableNumber: 1, zone: 'teaching', capacity: 4, status: 'available' },
  { id: 2, tableNumber: 2, zone: 'teaching', capacity: 4, status: 'available' },
  { id: 3, tableNumber: 3, zone: 'teaching', capacity: 4, status: 'available' },
  { id: 4, tableNumber: 4, zone: 'teaching', capacity: 4, status: 'available' },
  { id: 5, tableNumber: 5, zone: 'customer', capacity: 4, status: 'available' },
  { id: 6, tableNumber: 6, zone: 'customer', capacity: 4, status: 'available' },
  { id: 7, tableNumber: 7, zone: 'customer', capacity: 4, status: 'available' },
  { id: 8, tableNumber: 8, zone: 'customer', capacity: 4, status: 'available' },
  { id: 9, tableNumber: 9, zone: 'customer', capacity: 4, status: 'available' },
  { id: 10, tableNumber: 10, zone: 'customer', capacity: 4, status: 'available' },
  { id: 11, tableNumber: 11, zone: 'customer', capacity: 4, status: 'available' },
  { id: 12, tableNumber: 12, zone: 'customer', capacity: 4, status: 'available' },
  { id: 13, tableNumber: 13, zone: 'customer', capacity: 4, status: 'available' },
  { id: 14, tableNumber: 14, zone: 'customer', capacity: 4, status: 'available' },
  { id: 15, tableNumber: 15, zone: 'customer', capacity: 4, status: 'available' },
  { id: 16, tableNumber: 16, zone: 'customer', capacity: 4, status: 'available' },
];

export const dashboardData: DashboardResponse = {
  config: {
    courtPrice: 20000,
    teacherPrice: 250000,
    holdLimitMinutes: 15,
    defaultHours: 2,
    maxPeoplePerTable: 4,
    openingHour: 6,
    closingHour: 21,
    classCutoffHour: 19,
    alertMinutes: 30,
  },
  users,
  members,
  tables,
  bookings,
  classes,
  payments,
  stats: {
    totalRevenue: 0,
    todayBookings: 0,
    activeMembers: 0,
    classesPending: 0,
  },
};
