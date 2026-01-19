'use client';

import { cn, getStatusColor } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  status?: string;
  className?: string;
}

export default function Badge({ children, variant, status, className: additionalClassName }: BadgeProps) {
  const variantClasses = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    gray: 'badge-gray',
  };

  const baseClassName = status ? getStatusColor(status) : variant ? variantClasses[variant] : 'badge-gray';

  return <span className={cn(baseClassName, additionalClassName)}>{children}</span>;
}
