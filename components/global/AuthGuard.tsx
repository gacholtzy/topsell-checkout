"use client";

import { useAuthStore } from '@/lib/useAuthStore';
import { useEffect, useState } from 'react';

const AuthGuard = ({ children }: any) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  // Gunakan state sederhana untuk memastikan kita sudah di browser (client)
  const [isReady, setIsReady] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Pastikan Zustand sudah selesai baca dari LocalStorage (Hydrated)
    const checkAuth = () => {
      const hydrated = useAuthStore.persist?.hasHydrated();
      if (hydrated) {
        if (isAuthenticated) {
          setShouldRedirect(true);
          // Gunakan replace untuk menghindari bug tombol back di browser
          window.location.replace('https://links.topsellbelanja.com/promo-tsb');
        } else {
          setIsReady(true);
        }
      }
    };

    // Jalankan pengecekan
    checkAuth();

    // Listener jika hydration butuh waktu (fallback)
    const unsub = useAuthStore.persist?.onFinishHydration(() => {
      checkAuth();
    });

    return () => unsub?.();
  }, [isAuthenticated]);

  // Jika sedang redirect atau belum siap, tampilkan layar putih (mencegah flicker)
  if (!isReady || shouldRedirect) {
    return (
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: '#fff', 
        zIndex: 9999 
      }} />
    );
  }

  return children;
};

export default AuthGuard;