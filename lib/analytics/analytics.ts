import posthog from 'posthog-js';
import type { AnalyticsEvent } from './types';

let isInitialized = false;

export function initAnalytics() {
  if (isInitialized || typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host) {
    console.warn('Analytics disabled: Missing PostHog configuration');
    return;
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: 'always',
    capture_pageviews: false,  // Manual tracking only
    capture_pageleave: false,
    autocapture: false,         // No automatic click tracking
    disable_session_recording: true,
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        posthog.opt_out_capturing(); // Disable in dev
      }
    }
  });

  isInitialized = true;
}

export function trackEvent<T extends AnalyticsEvent>(
  name: T['name'],
  properties: T['properties']
) {
  if (!isInitialized || typeof window === 'undefined') return;

  try {
    posthog.capture(name, properties);
  } catch (error) {
    console.error('Analytics tracking error:', error);
    // Fail silently - never break user experience
  }
}

export function identifyUser(userId: string) {
  if (!isInitialized || typeof window === 'undefined') return;

  try {
    posthog.identify(userId);
  } catch (error) {
    console.error('Analytics identify error:', error);
  }
}
