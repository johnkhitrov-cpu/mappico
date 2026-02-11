'use client';

import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'onboarding_seen';

/**
 * Custom hook for managing first-time user onboarding.
 * Uses localStorage to track if user has completed onboarding.
 *
 * Onboarding is considered complete when user:
 * - Creates first trip OR
 * - Creates first point
 */
export function useOnboarding() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(true); // Default true to avoid flash
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage on mount
    const seen = localStorage.getItem(ONBOARDING_KEY);
    setIsOnboardingComplete(seen === 'true');
    setIsLoading(false);
  }, []);

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOnboardingComplete(true);
  };

  const shouldShowOnboarding = !isOnboardingComplete && !isLoading;

  return {
    shouldShowOnboarding,
    markOnboardingComplete,
    isLoading,
  };
}
