import type {
  AdminLoginInput,
  CurrentUser,
  UpdateProfileInput,
} from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useMemo } from 'react';

import { apiClient, ApiError } from '../../lib/api-client';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryFn: async () => {
      try {
        return await apiClient.get<CurrentUser>('/v1/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    queryKey: ['current-user'],
    retry: false,
    staleTime: 60_000,
  });
  const { mutateAsync: logout } = useMutation({
    mutationFn: () => apiClient.post<void>('/v1/auth/logout'),
    onSuccess: () => queryClient.setQueryData(['current-user'], null),
  });
  const { mutateAsync: logoutEverywhere } = useMutation({
    mutationFn: () => apiClient.post<void>('/v1/auth/logout-all'),
    onSuccess: () => queryClient.setQueryData(['current-user'], null),
  });
  const { mutateAsync: deleteAccount } = useMutation({
    mutationFn: () => apiClient.delete('/v1/auth/me'),
    onSuccess: () => queryClient.setQueryData(['current-user'], null),
  });
  const { mutateAsync: signInAdmin } = useMutation({
    mutationFn: (input: AdminLoginInput) =>
      apiClient.post<CurrentUser>('/v1/auth/login', input),
    onSuccess: (user) => queryClient.setQueryData(['current-user'], user),
  });
  const { mutateAsync: signInAsDeveloper } = useMutation({
    mutationFn: () => apiClient.post<CurrentUser>('/v1/auth/dev-login'),
    onSuccess: (user) => queryClient.setQueryData(['current-user'], user),
  });
  const { mutateAsync: updateProfile } = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiClient.patch<CurrentUser>('/v1/auth/me', input),
    onSuccess: (user) => queryClient.setQueryData(['current-user'], user),
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      deleteAccount: async () => {
        await deleteAccount();
      },
      isLoading: userQuery.isLoading,
      logout: async () => logout(),
      logoutEverywhere: async () => logoutEverywhere(),
      signInAdmin,
      signInAsDeveloper,
      updateProfile,
      user: userQuery.data ?? null,
    }),
    [
      deleteAccount,
      logout,
      logoutEverywhere,
      signInAdmin,
      signInAsDeveloper,
      updateProfile,
      userQuery.data,
      userQuery.isLoading,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
