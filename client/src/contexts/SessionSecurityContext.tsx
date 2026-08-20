import { createContext, useContext, useEffect, useCallback, type ReactNode } from 'react';
import { clearAllStoredData } from '@/lib/security';

interface SessionSecurityContextType {
  clearSession: () => void;
}

const SessionSecurityContext = createContext<SessionSecurityContextType | null>(null);

export function useSessionSecurity() {
  const context = useContext(SessionSecurityContext);
  if (!context) {
    throw new Error('useSessionSecurity must be used within SessionSecurityProvider');
  }
  return context;
}

interface SessionSecurityProviderProps {
  children: ReactNode;
  onSessionClear?: () => void;
}

export function SessionSecurityProvider({ children, onSessionClear }: SessionSecurityProviderProps) {
  const clearSession = useCallback(() => {
    clearAllStoredData();
    onSessionClear?.();
  }, [onSessionClear]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <SessionSecurityContext.Provider value={{ clearSession }}>
      {children}
    </SessionSecurityContext.Provider>
  );
}
