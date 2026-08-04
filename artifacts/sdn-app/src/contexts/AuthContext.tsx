import React, { createContext, useContext } from 'react';
import { useGetMe, useLogout } from '@workspace/api-client-react';
import type { AuthUser } from '@workspace/api-client-react/src/generated/api.schemas';
import { useLocation } from 'wouter';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isFetching: boolean;
  logout: () => void;
  refetchUser: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  const { data, isLoading, isFetching, refetch, isError } = useGetMe({
    query: {
      retry: false,
    }
  });

  // Derive `user` directly from the query result (not a useState+useEffect
  // mirror) so it updates in the same render as isLoading/isFetching — a
  // one-tick lag here previously let ProtectedRoute see isLoading=false with
  // a stale null user and bounce straight back to /login after a valid login.
  const user = isError ? null : (data ?? null);

  const { mutate: performLogout } = useLogout({
    mutation: {
      onSuccess: async () => {
        await refetch();
        setLocation('/login');
      }
    }
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading,
      isFetching,
      logout: performLogout,
      refetchUser: refetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
