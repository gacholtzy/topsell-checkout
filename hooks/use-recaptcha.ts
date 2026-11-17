"use client";

import { useEffect, useState, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export const useReCaptcha = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || !RECAPTCHA_SITE_KEY.trim()) {
      setError('reCAPTCHA site key not configured');
      return;
    }

    // Check if already loaded
    if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
      setIsLoaded(true);
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="recaptcha/api.js"]`);
    if (existingScript) {
      if (window.grecaptcha) {
        setIsLoaded(true);
      }
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.id = 'recaptcha-script';
    scriptRef.current = script;

    script.onload = () => {
      let attempts = 0;
      const checkReady = setInterval(() => {
        if (window.grecaptcha && typeof window.grecaptcha.execute === 'function') {
          clearInterval(checkReady);
          setIsLoaded(true);
        }
        attempts++;
        if (attempts > 100) {
          clearInterval(checkReady);
          if (window.grecaptcha) {
            setIsLoaded(true);
          }
        }
      }, 50);
    };

    script.onerror = () => {
      setError('Failed to load reCAPTCHA script');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup
    };
  }, []);

  const executeRecaptcha = async (action: string): Promise<string | null> => {
    if (!RECAPTCHA_SITE_KEY) {
      throw new Error('reCAPTCHA not configured');
    }

    if (!isLoaded) {
      throw new Error('reCAPTCHA not loaded yet');
    }

    if (!window.grecaptcha || typeof window.grecaptcha.execute !== 'function') {
      throw new Error('grecaptcha not available');
    }

    try {
      const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
      if (!token) {
        throw new Error('reCAPTCHA returned empty token');
      }
      return token;
    } catch (err) {
      throw err;
    }
  };

  return {
    isLoaded,
    error,
    executeRecaptcha,
  };
};

