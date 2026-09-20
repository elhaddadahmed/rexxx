/**
 * useAuth Hook – Zentrale Auth-State-Verwaltung für Web-App
 * 
 * Nutzt React Context + Supabase Auth.
 * - Verwaltet Session (User, Role, Permissions)
 * - Auto-Refresh bei Login/Logout
 * - Stellt Funktionen bereit: login(), logout(), resetPassword()
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: (Database['public']['Tables']['profiles']['Row'] & {
    company_id: string | null;
    role: string;
  }) | null;
  error: AuthError | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetPasswordConfirm: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType['profile']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  const client = createClient();

  // Initial session check
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();

        if (authError) {
          setError(authError);
          setLoading(false);
          return;
        }

        if (user) {
          setUser(user);
          await fetchProfile(user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen für Auth-State-Änderungen
    const { data } = client.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error: fetchError } = await client
        .from('profiles')
        .select('id, company_id, role, email, first_name, last_name, status')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Profile fetch error:', fetchError);
        return;
      }

      setProfile(data as any);
    } catch (err) {
      console.error('Profile fetch exception:', err);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError);
        throw signInError;
      }

      // onAuthStateChange wird Profile laden
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    const { error: signOutError } = await client.auth.signOut();

    if (signOutError) {
      setError(signOutError);
    }

    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    setError(null);

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error);
    }
  };

  const resetPasswordConfirm = async (password: string) => {
    setError(null);

    const { error } = await client.auth.updateUser({
      password,
    });

    if (error) {
      setError(error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profile,
        error,
        login,
        logout,
        resetPassword,
        resetPasswordConfirm,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
