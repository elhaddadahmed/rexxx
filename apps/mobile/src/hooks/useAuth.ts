/**
 * useAuth Hook für Mobile (React Native / Expo)
 * 
 * Nutzt AsyncStorage für Persistierung (Supabase-konforme Session-Speicherung).
 * Verwaltet Login/Logout/Password-Reset.
 */

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Database } from '@novaro/shared-types';

interface AuthContextState {
  user: User | null;
  loading: boolean;
  profile: (Database['public']['Tables']['profiles']['Row'] & {
    company_id: string | null;
    role: string;
  }) | null;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthContextState>({
    user: null,
    loading: true,
    profile: null,
    error: null,
  });

  // Initial session restore
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          setState((prev) => ({ ...prev, error: authError.message, loading: false }));
          return;
        }

        if (user) {
          setState((prev) => ({ ...prev, user }));
          await fetchProfile(user.id);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.error('Auth init error:', err);
        setState((prev) => ({ ...prev, error: String(err), loading: false }));
      }
    };

    initAuth();

    // Listen für Session-Änderungen
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setState((prev) => ({ ...prev, user: session.user }));
        await fetchProfile(session.user.id);
      } else {
        setState((prev) => ({ ...prev, user: null, profile: null, loading: false }));
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, company_id, role, email, first_name, last_name, status')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        setState((prev) => ({ ...prev, profile: null, loading: false }));
        return;
      }

      setState((prev) => ({
        ...prev,
        profile: data as any,
        loading: false,
      }));
    } catch (err) {
      console.error('Profile fetch exception:', err);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, error: null, loading: true }));

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState((prev) => ({
          ...prev,
          error: error.message,
          loading: false,
        }));
        throw error;
      }

      // onAuthStateChange wird Profile laden
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: String(err),
        loading: false,
      }));
      throw err;
    }
  };

  const logout = async () => {
    setState((prev) => ({ ...prev, error: null, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setState((prev) => ({
        ...prev,
        error: error.message,
        loading: false,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      user: null,
      profile: null,
      loading: false,
    }));
  };

  const resetPassword = async (email: string) => {
    setState((prev) => ({ ...prev, error: null }));

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'novaro-hr://auth/reset-password',
    });

    if (error) {
      setState((prev) => ({
        ...prev,
        error: error.message,
      }));
      throw error;
    }
  };

  return {
    ...state,
    login,
    logout,
    resetPassword,
  };
}
