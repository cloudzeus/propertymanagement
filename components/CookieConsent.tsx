'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    // Check if user has already consented
    const sessionId = getOrCreateSessionId();
    const hasConsented = localStorage.getItem(`cookie-consent-${sessionId}`);

    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  const getOrCreateSessionId = (): string => {
    let sessionId = localStorage.getItem('session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('session-id', sessionId);
    }
    return sessionId;
  };

  const handleAcceptAll = async () => {
    const sessionId = getOrCreateSessionId();
    const allPreferences: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
    };

    await saveCookiePreferences(sessionId, allPreferences);
    setIsVisible(false);

    // Enable Google Analytics if it exists
    if (window.gtag) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        marketing_storage: 'granted',
        functionality_storage: 'granted',
      });
    }
  };

  const handleRejectAll = async () => {
    const sessionId = getOrCreateSessionId();
    const minimalPreferences: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      functional: false,
    };

    await saveCookiePreferences(sessionId, minimalPreferences);
    setIsVisible(false);
  };

  const handleSavePreferences = async () => {
    const sessionId = getOrCreateSessionId();
    await saveCookiePreferences(sessionId, preferences);
    setIsVisible(false);
  };

  const saveCookiePreferences = async (sessionId: string, prefs: CookiePreferences) => {
    try {
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          ...prefs,
        }),
      });

      localStorage.setItem(`cookie-consent-${sessionId}`, 'true');
      localStorage.setItem('cookie-preferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving cookie preferences:', error);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {!showDetails ? (
            // Simple view
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Cookie Preferences</h3>
                <p className="text-sm text-gray-600">
                  We use cookies to enhance your experience. Essential cookies are always enabled. You can choose to
                  accept additional cookies for analytics and marketing purposes.
                </p>
                <button
                  onClick={() => setShowDetails(true)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Learn more
                </button>
              </div>

              <div className="flex gap-3 whitespace-nowrap">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reject All
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            // Detailed view
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cookie Settings</h3>

              <div className="space-y-4 mb-6">
                {/* Essential Cookies */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      disabled
                      checked={true}
                      className="mt-1.5 rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Essential Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Required for basic website functionality. These cookies cannot be disabled.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Functional Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.functional}
                      onChange={(e) =>
                        setPreferences({ ...preferences, functional: e.target.checked })
                      }
                      className="mt-1.5 rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Functional Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Enable enhanced functionality and personalization (e.g., saved preferences).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences({ ...preferences, analytics: e.target.checked })
                      }
                      className="mt-1.5 rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Analytics Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Help us understand how you use our website to improve it.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences({ ...preferences, marketing: e.target.checked })
                      }
                      className="mt-1.5 rounded"
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">Marketing Cookies</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Track your behavior to deliver relevant advertisements.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Reject All
                </button>
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Save Preferences
                </button>
              </div>

              {/* Policy Links */}
              <div className="mt-4 pt-4 border-t text-xs text-gray-500 flex gap-4">
                <Link href="/privacy" className="hover:text-gray-700">
                  Privacy Policy
                </Link>
                <Link href="/cookie-policy" className="hover:text-gray-700">
                  Cookie Policy
                </Link>
                <Link href="/terms" className="hover:text-gray-700">
                  Terms of Use
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
