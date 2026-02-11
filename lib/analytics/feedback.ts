export function getFeedbackUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL || 'https://forms.gle/PLACEHOLDER';

  if (typeof window === 'undefined') return baseUrl;

  // Pass context via URL params
  const params = new URLSearchParams({
    page: window.location.pathname,
    logged_in: 'true',
    timestamp: new Date().toISOString(),
  });

  return `${baseUrl}?${params.toString()}`;
}
