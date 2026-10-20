'use client';
import { createContext, useContext } from 'react';
import type { StaffRole } from '@/lib/admin/permissions';
export const RoleContext = createContext<StaffRole>('content_manager');
export const useRole = () => useContext(RoleContext);
