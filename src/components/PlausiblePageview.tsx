import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Sends a Plausible pageview on client-side route changes (SPA navigation).
 */
export function PlausiblePageview() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.plausible === 'function') {
      window.plausible('pageview');
    }
  }, [location.pathname, location.search]);

  return null;
}
