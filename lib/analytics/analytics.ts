import type { AnalyticsEvent } from './types';

// Yandex Metrika global type
declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: any[]) => void;
  }
}

let isInitialized = false;
const METRIKA_ID = 106790199;

export function initAnalytics() {
  if (isInitialized || typeof window === 'undefined') return;

  // Wait for ym to be available (loaded by Script in layout)
  const checkYm = () => {
    if (window.ym) {
      isInitialized = true;
    } else {
      setTimeout(checkYm, 100);
    }
  };

  checkYm();
}

export function trackEvent<T extends AnalyticsEvent>(
  name: T['name'],
  properties: T['properties']
) {
  if (!isInitialized || typeof window === 'undefined' || !window.ym) return;

  try {
    // Yandex Metrika custom event: reachGoal
    window.ym(METRIKA_ID, 'reachGoal', name, properties);
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Fail silently - never break user experience
  }
}

export function identifyUser(userId: string) {
  if (!isInitialized || typeof window === 'undefined' || !window.ym) return;

  try {
    // Yandex Metrika user parameters
    window.ym(METRIKA_ID, 'userParams', { UserID: userId });
  } catch (error) {
    console.error('Analytics identify error:', error);
  }
}
