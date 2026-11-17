"use client";

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const HomeGuard = ({ children }: { children: React.ReactNode }) => {
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Mengecek apakah ada parameter 'cart' di URL (misal: ?cart=123)
    const hasCart = searchParams.has('cart');

    if (!hasCart) {
      // Jika tidak ada ?cart=, lempar ke promo-tsb
      window.location.href = 'https://links.topsellbelanja.com/promo-tsb';
    } else {
      // Jika ada, izinkan render konten home
      setIsChecking(false);
    }
  }, [searchParams]);

  // Tampilkan screen putih/loading selama pengecekan agar konten home tidak "ngintip"
  if (isChecking) {
    return <div style={{ background: '#fff', height: '100vh' }} />;
  }

  return <>{children}</>;
};

export default HomeGuard;