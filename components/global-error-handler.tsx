'use client';

import { useEffect } from 'react';
import { setupGlobalErrorHandlers } from './error-boundary';

export default function GlobalErrorHandler() {
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);
  
  return null;
}
