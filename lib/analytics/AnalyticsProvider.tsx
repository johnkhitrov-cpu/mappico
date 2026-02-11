'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { initAnalytics, trackEvent } from './analytics';
import type { AnalyticsEvent } from './types';

interface AnalyticsContextType {
  trackEvent: <T extends AnalyticsEvent>(
    name: T['name'],
    properties: T['properties']
  ) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  }
  return context;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Lazy-load analytics after page hydration (don't block render)
    if (typeof window !== 'undefined') {
      setTimeout(() => initAnalytics(), 100);
    }
  }, []);

  return (
    <AnalyticsContext.Provider value={{ trackEvent }}>
      {children}
    </AnalyticsContext.Provider>
  );
}
