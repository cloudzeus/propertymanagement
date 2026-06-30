'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { pickLocale } from '@/lib/i18n/translatable';
import type { ConsentConfig } from '@/lib/cms/site-settings-defaults';
import type { Locale } from '@/i18n';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

const granted = (b: boolean) => (b ? 'granted' : 'denied');

function applyConsent(analytics: boolean, marketing: boolean) {
  (window as any).gtag?.('consent', 'update', {
    analytics_storage: granted(analytics),
    ad_storage: granted(marketing),
    ad_user_data: granted(marketing),
    ad_personalization: granted(marketing),
  });
  (window as any).fbq?.('consent', marketing ? 'grant' : 'revoke');
}

export function CookieConsent({ config, enabled }: { config: ConsentConfig; enabled: boolean }) {
  const locale = useLocale() as Locale;
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const hasConsented = localStorage.getItem(`cookie-consent-${sessionId}`);
    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  if (!enabled) return null;

  const getOrCreateSessionId = (): string => {
    let sessionId = localStorage.getItem('session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('session-id', sessionId);
    }
    return sessionId;
  };

  const persist = async (prefs: CookiePreferences) => {
    const sessionId = getOrCreateSessionId();
    await saveCookiePreferences(sessionId, prefs);
    setIsVisible(false);
    applyConsent(prefs.analytics, prefs.marketing);
  };

  const handleAcceptAll = async () => {
    await persist({ essential: true, analytics: true, marketing: true, functional: true });
  };

  const handleRejectAll = async () => {
    await persist({ essential: true, analytics: false, marketing: false, functional: false });
  };

  const handleSavePreferences = async () => {
    await persist(preferences);
  };

  const saveCookiePreferences = async (sessionId: string, prefs: CookiePreferences) => {
    try {
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...prefs }),
      });
      localStorage.setItem(`cookie-consent-${sessionId}`, 'true');
      localStorage.setItem('cookie-preferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Error saving cookie preferences:', error);
    }
  };

  if (!isVisible) return null;

  // Categories whose toggle maps to a known preference field.
  const toggleable = config.categories.filter((c) => !c.required);
  const prefKey = (key: string): keyof CookiePreferences | null => {
    if (key === 'analytics') return 'analytics';
    if (key === 'marketing') return 'marketing';
    if (key === 'functional') return 'functional';
    return null;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-6">
          {!showDetails ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {pickLocale(config.title, locale)}
                </h3>
                <p className="text-sm text-gray-600">{pickLocale(config.body, locale)}</p>
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
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {pickLocale(config.title, locale)}
              </h3>

              <div className="space-y-4 mb-6">
                {config.categories.map((cat) => {
                  const key = prefKey(cat.key);
                  const checked = cat.required ? true : key ? preferences[key] : false;
                  return (
                    <div
                      key={cat.key}
                      className={`border rounded-lg p-4 ${cat.required ? 'bg-gray-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          disabled={cat.required}
                          checked={checked}
                          onChange={(e) => {
                            if (cat.required || !key) return;
                            setPreferences({ ...preferences, [key]: e.target.checked });
                          }}
                          className="mt-1.5 rounded"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {pickLocale(cat.label, locale)}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {pickLocale(cat.description, locale)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
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

              <div className="mt-4 pt-4 border-t text-xs text-gray-500 flex gap-4">
                <Link href={config.policyLink} className="hover:text-gray-700">
                  {locale === 'el' ? 'Πολιτική Cookies' : 'Cookie Policy'}
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
