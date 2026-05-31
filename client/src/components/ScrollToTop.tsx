import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Instant scroll to top on route change - prevents animation conflicts
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
