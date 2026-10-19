'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/components/providers/ThemeProvider';
import { logoutUser, deleteAccount } from '@/app/actions/auth';
import { saveNotificationSettings } from '@/app/actions/profile';
import { toast } from 'sonner';

export type NotificationSettingsData = Record<string, any>;

interface SettingsClientProps {
  lang: string;
  initialNotificationSettings?: NotificationSettingsData | null;
  userProfile?: any;
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

/**
 * Format snake_case key to clean Title Case
 * e.g. "event_notifications" -> "Event Notifications"
 *      "news_notifications" -> "News Notifications"
 */
export function formatNotificationTitle(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getNotificationIcon(key: string): string {
  switch (key) {
    case 'news_notifications':
      return 'fa-solid fa-newspaper';
    case 'event_notifications':
      return 'fa-solid fa-calendar';
    case 'alerts_notifications':
      return 'fa-solid fa-bell';
    case 'promotional_notifications':
      return 'fa-solid fa-award';
    default:
      return 'fa-solid fa-sliders';
  }
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
        checked ? 'bg-primary' : 'bg-muted-foreground/25'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Section({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border/70 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <i className={`${icon} text-sm text-muted-foreground`} />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export function SettingsClient({
  lang,
  initialNotificationSettings,
  userProfile,
}: SettingsClientProps) {
  const router = useRouter();
  const pathname = usePathname() || `/${lang}/my-settings`;
  const [, startLangTransition] = useTransition();

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [settings, setSettings] = useState<Record<string, any>>(() => {
    const raw = initialNotificationSettings || {};
    return {
      all_notifications: raw.all_notifications ?? true,
      news_notifications: raw.news_notifications ?? true,
      event_notifications: raw.event_notifications ?? true,
      alerts_notifications: raw.alerts_notifications ?? true,
      promotional_notifications: raw.promotional_notifications ?? true,
      ...raw,
    };
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictErrorMessage, setConflictErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Standard notification keys matching backend response order
  const standardKeys = [
    'news_notifications',
    'event_notifications',
    'alerts_notifications',
    'promotional_notifications',
  ];

  // Also collect any extra keys coming from backend
  const allKeys = Object.keys(settings).filter(
    (k) =>
      k !== 'user_id' &&
      k !== 'all_notifications' &&
      k !== 'id' &&
      k !== 'created_at' &&
      k !== 'updated_at' &&
      k !== 'response_time' &&
      (typeof settings[k] === 'boolean' || settings[k] === 1 || settings[k] === 0)
  );

  const notificationListKeys = Array.from(new Set([...standardKeys, ...allKeys]));

  const handleToggleNotification = async (key: string) => {
    const previousState = { ...settings };
    const nextVal = !Boolean(settings[key]);
    let newSettings: Record<string, any>;

    if (key === 'all_notifications') {
      newSettings = { ...settings, all_notifications: nextVal };
      notificationListKeys.forEach((k) => {
        newSettings[k] = nextVal;
      });
    } else {
      newSettings = { ...settings, [key]: nextVal };
      const areAllActive = notificationListKeys.every((k) => Boolean(newSettings[k]) === true);
      newSettings.all_notifications = areAllActive;
    }

    // Instant local state update (no manual loaders)
    setSettings(newSettings);

    const title = formatNotificationTitle(key);

    // Build payload strictly with notification preference flags matching API contract
    const payload: Record<string, boolean> = {
      all_notifications: Boolean(newSettings.all_notifications),
      news_notifications: Boolean(newSettings.news_notifications),
      event_notifications: Boolean(newSettings.event_notifications),
      alerts_notifications: Boolean(newSettings.alerts_notifications),
      promotional_notifications: Boolean(newSettings.promotional_notifications),
    };
    notificationListKeys.forEach((k) => {
      payload[k] = Boolean(newSettings[k]);
    });

    try {
      const res = await saveNotificationSettings(payload, lang);
      if (res.success) {
        toast.success(`${title} ${nextVal ? 'enabled' : 'disabled'}`);
      } else {
        setSettings(previousState);
        toast.error(res.error || `Failed to update ${title}`);
      }
    } catch {
      setSettings(previousState);
      toast.error('Network error updating settings');
    }
  };

  const handleLanguageChange = (targetLang: string) => {
    if (targetLang === lang) return;
    const segments = pathname.split('/').filter(Boolean);
    if (['en', 'ar', 'zh', 'fr'].includes(segments[0])) {
      segments[0] = targetLang;
    } else {
      segments.unshift(targetLang);
    }
    const newPath = '/' + segments.join('/');
    startLangTransition(() => {
      router.replace(newPath, { scroll: false });
    });
  };

  const targetEmail = (userProfile?.email || '').trim().toLowerCase();
  const isEmailMatched = Boolean(targetEmail && deleteInput.trim().toLowerCase() === targetEmail);

  const handleDeleteAccount = async () => {
    if (!isEmailMatched || isDeleting) return;
    setIsDeleting(true);
    try {
      const userId = userProfile?.id || userProfile?._id || userProfile?.customer_id;
      const res = await deleteAccount(userId, lang);

      if (!res.success) {
        setIsDeleting(false);
        if (res.status === 409) {
          // 409 Conflict: active subscription auto-pay
          setShowDeleteModal(false);
          setDeleteInput('');
          setConflictErrorMessage(res.message || 'Can not delete account as subscription auto-pay is active');
        } else {
          toast.error(res.message || 'Failed to delete account. Please try again.');
        }
        return;
      }

      // Success: dismiss delete confirmation modal
      setShowDeleteModal(false);
      setDeleteInput('');

      // Clear client storage, tokens, and trigger auth changes
      try {
        const savedTheme = localStorage.getItem('theme');
        localStorage.clear();
        if (savedTheme) localStorage.setItem('theme', savedTheme);
        sessionStorage.clear();
        sessionStorage.setItem(
          'flash_toast',
          JSON.stringify({
            type: 'success',
            message: res.message || 'Your account has been deleted successfully',
          })
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth-state-change'));
        }
      } catch (storageErr) {
        console.error('Storage clear error:', storageErr);
      }

      toast.success(res.message || 'Your account has been deleted successfully');

      // Navigate home
      setTimeout(() => {
        window.location.href = `/${lang}`;
      }, 300);
    } catch (err: any) {
      setIsDeleting(false);
      setShowDeleteModal(false);
      toast.error(err?.message || 'Failed to submit. Please contact support.');
    }
  };

  const currentTheme = mounted ? theme : 'system';

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: 'fa-solid fa-sun' },
    { value: 'system' as const, label: 'System', icon: 'fa-solid fa-desktop' },
    { value: 'dark' as const, label: 'Dark', icon: 'fa-solid fa-moon' },
  ];

  const legalLinks = [
    { title: 'Terms & Conditions', icon: 'fa-solid fa-file-contract', href: `/${lang}/terms-conditions` },
    { title: 'Privacy Policy', icon: 'fa-solid fa-shield-halved', href: `/${lang}/privacy-policy` },
    { title: 'Refund & Cancellation', icon: 'fa-solid fa-receipt', href: `/${lang}/refund-cancellation-policy` },
    { title: 'Disclaimer', icon: 'fa-solid fa-triangle-exclamation', href: `/${lang}/disclaimer` },
  ];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* User Summary Strip */}
          {userProfile && (
            <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border/70 rounded-2xl">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                {userProfile.first_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {userProfile.first_name} {userProfile.last_name || ''}
                </p>
                <p className="text-xs text-muted-foreground truncate">{userProfile.email}</p>
              </div>
              <Link
                href={`/${lang}/profile`}
                className="ml-auto shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Edit Profile
              </Link>
            </div>
          )}

          {/* Appearance */}
          <Section title="Appearance" icon="fa-solid fa-palette">
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map(({ value, label, icon }) => {
                const isActive = currentTheme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`relative flex flex-col items-center justify-center gap-2 py-4 rounded-xl border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'border-primary/60 bg-primary/10 text-primary shadow-xs'
                        : 'border-border/60 bg-background hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <i className={`${icon} text-base`} />
                    <span className="text-xs font-semibold">{label}</span>
                    {isActive && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Notifications */}
          <Section
            title="Notifications"
            icon="fa-solid fa-bell"
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">All</span>
                <Toggle
                  checked={Boolean(settings.all_notifications)}
                  onChange={() => handleToggleNotification('all_notifications')}
                />
              </div>
            }
          >
            <div className="divide-y divide-border/40">
              {notificationListKeys.map((key) => {
                const isEnabled = Boolean(settings[key]);
                const label = formatNotificationTitle(key);
                const icon = getNotificationIcon(key);

                return (
                  <div key={key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <i className={`${icon} text-xs text-muted-foreground w-4 text-center shrink-0`} />
                      <span className="text-sm text-foreground truncate">
                        {label}
                      </span>
                    </div>
                    <Toggle
                      checked={isEnabled}
                      onChange={() => handleToggleNotification(key)}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Language */}
          <Section title="Language" icon="fa-solid fa-globe">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LANGUAGES.map((item) => {
                const isSelected = lang === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleLanguageChange(item.code)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary/60 bg-primary/10 text-primary shadow-xs'
                        : 'border-border/60 bg-background hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <span className="text-xl leading-none">{item.flag}</span>
                    <span className="text-xs font-semibold leading-tight">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Support */}
          <div className="bg-card border border-border/70 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <i className="fa-brands fa-whatsapp text-sm text-emerald-500" />
              <span className="text-sm font-semibold text-foreground">Support</span>
              <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                24/7
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Chat with an AgriGuru specialist for help with contracts, freight updates, or account issues.
            </p>
            <a
              href="https://wa.me/918980131000?text=Hello%20AgriGuru%20Support%2C%20I%20need%20assistance%20with%20my%20account"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-semibold text-xs transition-all cursor-pointer"
            >
              <i className="fa-brands fa-whatsapp text-sm" />
              Connect on WhatsApp
            </a>
          </div>

          {/* Legal Links */}
          <div className="bg-card border border-border/70 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/50 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Policies</span>
              <Link href={`/${lang}/contact-us`} className="text-xs text-primary hover:underline font-medium">
                Contact Us
              </Link>
            </div>
            <div>
              {legalLinks.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/60 border-b border-border/40 last:border-b-0 transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <i className={`${item.icon} text-[11px] text-muted-foreground w-4 text-center shrink-0`} />
                    <span className="text-xs text-foreground truncate">{item.title}</span>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[9px] text-muted-foreground/50 group-hover:text-primary shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-card border border-rose-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-trash-can text-xs text-rose-500" />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                Delete Account
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              All of your data, including membership plan details, profile
              information, inquiries, offers &amp; complete communication
              history, will be permanently deleted.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteInput('');
                setShowDeleteModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-all cursor-pointer"
            >
              <i className="fa-solid fa-trash-can text-[11px]" />
              Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card text-foreground border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-xl border border-rose-500/20">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-foreground">Delete Account?</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All of your data, including membership plan details, profile
                information, inquiries, offers &amp; complete communication
                history, will be permanently deleted.
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/80 text-center">
                <span className="text-[11px] text-muted-foreground block mb-1">
                  To confirm deletion, type your registered email address:
                </span>
                <span className="text-xs font-semibold text-foreground select-none pointer-events-none break-all">
                  {userProfile?.email || 'your registered email'}
                </span>
              </div>

              <div className="space-y-1">
                <input
                  type="email"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault();
                    toast.error('Copy-paste is disabled. Please type your email manually.');
                  }}
                  onDrop={(e) => e.preventDefault()}
                  placeholder={userProfile?.email || 'Enter your email'}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-foreground placeholder:text-muted-foreground/40 transition-all"
                />
                {deleteInput.length > 0 && !isEmailMatched && (
                  <p className="text-[11px] text-rose-500 flex items-center gap-1 pt-0.5">
                    <i className="fa-solid fa-circle-exclamation text-[10px]" />
                    <span>Email does not match your profile email</span>
                  </p>
                )}
                {isEmailMatched && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5 font-medium">
                    <i className="fa-solid fa-circle-check text-[10px]" />
                    <span>Email verified. You can now delete your account.</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteInput('');
                }}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!isEmailMatched || isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can text-xs" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 409 Conflict / Subscription Active Popup */}
      {conflictErrorMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-card text-foreground border border-border/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-xl border border-amber-500/20">
              <i className="fa-solid fa-triangle-exclamation" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-foreground">Account Deletion Restricted</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your request to delete the account could not be processed due to an active subscription.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center">
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block mb-0.5">
                Notice
              </span>
              <p className="text-xs font-medium text-foreground leading-relaxed">
                {conflictErrorMessage}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Link
                href={`/${lang}/membership-plans`}
                onClick={() => setConflictErrorMessage(null)}
                className="flex-1 py-2.5 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-xs text-center transition-colors flex items-center justify-center cursor-pointer"
              >
                Manage Plan
              </Link>
              <button
                type="button"
                onClick={() => setConflictErrorMessage(null)}
                className="flex-1 py-2.5 rounded-xl bg-foreground text-background font-semibold text-xs transition-opacity hover:opacity-90 flex items-center justify-center cursor-pointer"
              >
                Okay, Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
