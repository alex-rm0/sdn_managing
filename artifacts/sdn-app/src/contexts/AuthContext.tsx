import React, { createContext, useContext, useState, useEffect } from 'react';
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [, setLocation] = useLocation();

  const { data, isLoading, isFetching, refetch, isError } = useGetMe({
    query: {
      retry: false,
    }
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    }
    if (isError) {
      setUser(null);
    }
  }, [data, isError]);

  const { mutate: performLogout } = useLogout({
    mutation: {
      onSuccess: () => {
        setUser(null);
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
