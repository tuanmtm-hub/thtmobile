'use client';

import { useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook that provides an AbortController for cancelling fetch requests
 * when the component unmounts (e.g., user navigates away quickly).
 *
 * Usage:
 *   const getSignal = useAbortController();
 *
 *   const fetchData = async () => {
 *     const signal = getSignal(); // creates a new AbortController, aborts the previous one
 *     const res = await fetch('/api/proxy', { signal, ... });
 *     ...
 *   };
 *
 * - Calling getSignal() aborts any previous in-flight request automatically.
 * - On unmount, any in-flight request is also aborted.
 */
export function useAbortController() {
  const controllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount: abort any in-flight request
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  /**
   * Returns a fresh AbortSignal. If a previous controller exists, it is aborted first.
   * This ensures only the latest fetch is active at any time.
   */
  const getSignal = useCallback((): AbortSignal => {
    // Abort previous request if still running
    controllerRef.current?.abort();
    // Create a new controller
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);

  return getSignal;
}
