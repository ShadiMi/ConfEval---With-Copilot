import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, formatStr: string = 'MMM d, yyyy') {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, 'MMM d, yyyy h:mm a');
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    student: 'Student',
    internal_reviewer: 'Internal Reviewer',
    external_reviewer: 'External Reviewer',
    admin: 'Administrator',
  };
  return labels[role] || role;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    upcoming: 'badge-primary',
    active: 'badge-success',
    completed: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}

export function truncate(str: string, length: number = 100): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function extractErrorMessage(error: any, fallback: string = 'An error occurred'): string {
  const detail = error?.response?.data?.detail;
  
  if (typeof detail === 'string') {
    return detail;
  }
  
  if (Array.isArray(detail) && detail.length > 0) {
    return detail[0]?.msg || fallback;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return fallback;
}
