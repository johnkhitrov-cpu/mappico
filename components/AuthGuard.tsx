'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      router.replace('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Don't render children until we've verified authentication
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
