import axios from 'axios';
import type { DashboardResponse, User } from '../types';

const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
});

// Đính kèm token xác thực vào mọi request nếu có trong localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pingpongbros_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/dashboard');
  return data;
}

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const { data } = await api.post<{ user: User; token: string }>('/auth/login', { email, password });
  if (data.token) {
    localStorage.setItem('pingpongbros_token', data.token);
  }
  return data;
}

export async function createBooking(input: {
  tableId: number;
  customerName: string;
  phone: string;
  email: string;
  type: 'WALK_IN' | 'MEMBER' | 'TEACHER';
  startTime: string;
  duration: number;
  people: number;
  amount: number;
  memberId: number | null;
  checkInImmediately?: boolean;
  status?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN';
}): Promise<any> {
  const { data } = await api.post('/bookings', input);
  return data;
}

export async function checkInBooking(bookingId: number): Promise<void> {
  await api.post(`/bookings/${bookingId}/checkin`);
}

export async function checkOutBooking(bookingId: number): Promise<{ amount: number; message: string }> {
  const { data } = await api.post<{ amount: number; message: string }>(`/bookings/${bookingId}/checkout`);
  return data;
}

export async function createClassSession(input: {
  teacherId: number;
  teacherName: string;
  date: string;
  startHour: number;
}): Promise<void> {
  await api.post('/classes', input);
}

export async function approveClass(classId: number): Promise<void> {
  await api.post(`/classes/${classId}/approve`);
}

export async function rejectClass(classId: number, reason?: string): Promise<void> {
  await api.post(`/classes/${classId}/reject`, { reason });
}

export async function checkInClass(classId: number): Promise<any> {
  const res = await api.post(`/classes/${classId}/checkin`);
  return res.data;
}

export async function checkOutClass(classId: number): Promise<any> {
  const res = await api.post(`/classes/${classId}/checkout`);
  return res.data;
}

export async function renewMember(memberId: number, packageId: string): Promise<any> {
  const { data } = await api.post(`/members/${memberId}/renew`, { packageId });
  return data;
}

export async function createWaitlist(input: {
  customerName: string;
  phone: string;
  email?: string;
  people: number;
  startTime: string;
  duration: number;
  type: 'WALK_IN' | 'MEMBER' | 'TEACHER';
}): Promise<void> {
  await api.post('/waitlist', input);
}

export async function updateConfig(config: Partial<DashboardResponse['config']>): Promise<void> {
  await api.post('/config', config);
}


export async function sendRegisterOtp(email: string, ho_ten: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post('/auth/send-otp', { email, ho_ten });
  return data;
}

export async function registerUser(input: {
  ho_ten: string;
  sdt: string;
  email: string;
  mat_khau: string;
  otp?: string;
  vai_tro?: string;
}): Promise<{ ok: boolean; message: string; user?: any }> {
  const { data } = await api.post('/dang-ky', input);
  return data;
}

export async function activateMember(input: {
  customerName: string;
  phone: string;
  email?: string;
  packageId: string;
  staffName?: string;
}): Promise<any> {
  const { data } = await api.post('/members/activate', input);
  return data;
}

export async function createStaffAccount(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<any> {
  const { data } = await api.post('/staff', input);
  return data;
}

export async function fetchStaffList(): Promise<User[]> {
  const { data } = await api.get<User[]>('/staff');
  return data;
}
