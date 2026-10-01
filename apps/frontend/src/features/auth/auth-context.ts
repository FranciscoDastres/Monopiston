import type {
  AdminLoginInput,
  CurrentUser,
  UpdateProfileInput,
} from '@monopiston/contracts';
import { createContext, useContext } from 'react';

export interface AuthContextValue {
  deleteAccount: () => Promise<void>;
  isLoading: boolean;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  signInAdmin: (input: AdminLoginInput) => Promise<CurrentUser>;
  signInAsDeveloper: () => Promise<CurrentUser>;
  updateProfile: (input: UpdateProfileInput) => Promise<CurrentUser>;
  user: CurrentUser | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
