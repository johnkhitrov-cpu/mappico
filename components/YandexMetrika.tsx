'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function YandexMetrika() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track route changes
    if (typeof window !== 'undefined' && (window as any).ym) {
      const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
      (window as any).ym(106790199, 'hit', url);
    }
  }, [pathname, searchParams]);

  return null;
}
