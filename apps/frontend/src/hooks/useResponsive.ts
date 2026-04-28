import { useEffect, useState } from 'react';

export interface BreakpointValues {
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

const defaultBreakpoints: BreakpointValues = {
  sm: 560,
  md: 900,
  lg: 1200,
  xl: 1600,
};

export function useResponsive(breakpoints = defaultBreakpoints) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoints.sm;
  });

  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth;
    return w > breakpoints.sm && w <= breakpoints.md;
  });

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > breakpoints.md;
  });

  const [width, setWidth] = useState(() => {
    return typeof window === 'undefined' ? 0 : window.innerWidth;
  });

  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWidth(newWidth);
      setIsMobile(newWidth <= breakpoints.sm);
      setIsTablet(newWidth > breakpoints.sm && newWidth <= breakpoints.md);
      setIsDesktop(newWidth > breakpoints.md);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoints]);

  return {
    isMobile,
    isTablet,
    isDesktop,
    width,
    breakpoints,
  };
}
