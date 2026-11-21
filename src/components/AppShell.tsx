import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  Compass,
  Eye,
  FolderOpen,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { BRAND } from '../content/planContent';
import { signOutUser } from '../firebase';
import { useHub } from '../context/HubContext';
import type { NavTab } from '../types';
import { getInitials } from '../utils/helpers';
import { NotificationBar } from './NotificationBar';
import { EmailConfirmModal } from './EmailConfirmModal';
import { MeetingReminderToast } from './MeetingReminderToast';

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  children: React.ReactNode;
}

interface NavItemDef {
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'core' | 'team' | 'admin';
}

const ALL_NAV_ITEMS: NavItemDef[] = [
  { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home, group: 'core' },
  { id: 'plan', label: 'About Me & Our Plan', shortLabel: 'About & Plan', icon: Compass, group: 'core' },
  { id: 'roadmap', label: '6-Month Roadmap', shortLabel: 'Roadmap', icon: Calendar, group: 'core' },
  { id: 'my-month-1', label: 'My Month 1', shortLabel: 'My M1', icon: CheckSquare, group: 'core' },
  { id: 'meetings', label: 'Meetings', shortLabel: 'Meetings', icon: CalendarClock, group: 'core' },
  { id: 'team', label: 'Meet the Team', shortLabel: 'Team', icon: Users, group: 'team' },
  { id: 'resources', label: 'Resource Library', shortLabel: 'Library', icon: FolderOpen, group: 'team' },
  { id: 'training', label: 'Training', shortLabel: 'Training', icon: GraduationCap, group: 'team' },
  { id: 'voice', label: 'Teacher Voice & FAQ', shortLabel: 'Voice', icon: MessageSquare, group: 'team' },
  { id: 'tools', label: 'Lesson Plans & Tools', shortLabel: 'Tools', icon: ClipboardList, group: 'team' },
  { id: 'good-practice', label: 'Good Practice', shortLabel: 'Practice', icon: BookOpen, group: 'team' },
  { id: 'admin', label: 'Admin Dashboard', shortLabel: 'Admin', icon: Shield, group: 'admin' },
];

const MOBILE_PRIMARY_TABS: NavTab[] = ['home', 'plan', 'resources', 'my-month-1'];

export function AppShell({ activeTab, onSelectTab, children }: AppShellProps) {
  const {
    myProfile,
    user,
    isPrimaryOwner,
    isAdmin,
    isViewer,
    darkMode,
    toggleDarkMode,
    pendingEmailDraft,
    clearPendingEmailDraft,
  } = useHub();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleItems = ALL_NAV_ITEMS.filter((item) => item.group !== 'admin' || isAdmin);
  const displayName =
    myProfile?.displayName || user?.displayName || (isViewer ? 'Guest Viewer' : 'YAO Teacher');

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] text-[#1F122B] dark:text-[#F5EEF9] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-white dark:bg-[#1B1224] border-r border-[#E5D9EC] dark:border-[#332442] z-30 no-print">
        <div className="p-5 border-b border-[#E5D9EC] dark:border-[#332442] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="bg-white px-2 py-1.5 rounded-xl border border-[#E5D9EC]">
              <img
                src={BRAND.logoPath}
                alt="YAO English logo"
                className="h-9 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="px-2 py-0.5 rounded-md bg-[#F4EEF7] dark:bg-[#2C1E38] text-[#A8567F] dark:text-[#D98EB3] text-[11px] font-semibold whitespace-nowrap">
              {BRAND.draftBadge}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] leading-tight">
              {BRAND.appName}
            </p>
            <p className="text-xs text-[#5A4A66] dark:text-[#BBAAC9] mt-0.5 leading-snug">
              Month 1 & Road to Month 6
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Main navigation">
          {(['core', 'team', 'admin'] as const).map((group) => {
            const items = visibleItems.filter((i) => i.group === group);
            if (items.length === 0) return null;
            const groupLabel =
              group === 'core' ? 'Start Here' : group === 'team' ? 'Team & Teaching' : 'Coordinator Admin';
            return (
              <div key={group} className="space-y-1">
                <p className="px-3 text-[11px] font-semibold text-[#7A6888] dark:text-[#9D8AAD]">
                  {groupLabel}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full min-h-[40px] flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left whitespace-nowrap ${
                        active
                          ? 'bg-[#3B1050] text-white shadow-xs'
                          : 'text-[#3A2847] dark:text-[#DFD0EC] hover:bg-[#F4EEF7] dark:hover:bg-[#281B36]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5D9EC] dark:border-[#332442] space-y-3">
          <div className="flex items-center gap-2.5">
            {myProfile?.photoUrl ? (
              <img
                src={myProfile.photoUrl}
                alt={displayName}
                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[#E5D9EC] dark:border-[#332442]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#3B1050] text-white text-xs font-bold flex items-center justify-center shrink-0">
                {getInitials(displayName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#1F122B] dark:text-[#F5EEF9] truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-[#5A4A66] dark:text-[#BBAAC9]">
                {isPrimaryOwner
                  ? 'Owner · Full Edit'
                  : isAdmin
                    ? 'Editor · Full Edit'
                    : isViewer
                      ? 'View Only'
                      : 'YAO Teacher'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium text-[#3B1050] dark:text-[#E8D5F5] hover:bg-[#F4EEF7] dark:hover:bg-[#281B36] transition-colors"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {darkMode ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] text-xs font-medium text-[#5A4A66] dark:text-[#BBAAC9] hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Compact Header */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#1B1224]/95 backdrop-blur-md border-b border-[#E5D9EC] dark:border-[#332442] px-3 flex items-center justify-between gap-2 no-print">
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 min-w-0"
        >
          <div className="bg-white px-1.5 py-1 rounded-lg border border-[#E5D9EC] shrink-0">
            <img
              src={BRAND.logoPath}
              alt="YAO English logo"
              className="h-6 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-sm font-bold text-[#1F122B] dark:text-[#F5EEF9] truncate">
            Teacher Hub
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#F4EEF7] dark:bg-[#2C1E38] text-[#A8567F] dark:text-[#D98EB3] text-[10px] font-semibold whitespace-nowrap shrink-0">
            {BRAND.draftBadge}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#3B1050] dark:text-[#E8D5F5]"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => signOutUser()}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#5A4A66] dark:text-[#BBAAC9]"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Print-only Brand Header */}
        <div className="hidden print-only mb-6 pb-4 border-b border-gray-300">
          <div className="flex items-center justify-between">
            <img src={BRAND.logoPath} alt="YAO English logo" className="h-10 w-auto" />
            <div className="text-right">
              <p className="font-bold text-base text-[#3B1050]">{BRAND.appName}</p>
              <p className="text-xs text-gray-600">{BRAND.subtitle} · {BRAND.draftBadge}</p>
            </div>
          </div>
        </div>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 lg:pb-12">
          <NotificationBar onSelectTab={handleNavClick} />
          {isViewer && (
            <div className="mb-5 px-4 py-2.5 rounded-xl bg-white dark:bg-[#1F1629] border border-[#E5D9EC] dark:border-[#332442] flex items-center gap-2.5 text-xs text-[#5A4A66] dark:text-[#C5B4D4] no-print">
              <Eye className="w-4 h-4 text-[#A8567F] shrink-0" />
              <span>
                <strong className="text-[#1F122B] dark:text-[#F5EEF9]">View-only access:</strong>{' '}
                You can read all pages and download PDFs, and cannot edit, post, or submit
                anything.
              </span>
            </div>
          )}
          {children}
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-[#E5D9EC] dark:border-[#332442] bg-white/70 dark:bg-[#1B1224]/70 px-4 sm:px-8 py-5 pb-24 lg:pb-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5A4A66] dark:text-[#BBAAC9]">
            <div className="flex items-center gap-3">
              <div className="bg-white px-2 py-1 rounded-lg border border-[#E5D9EC]">
                <img
                  src={BRAND.logoPath}
                  alt="YAO English logo"
                  className="h-6 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span>{BRAND.footerText}</span>
            </div>
            <span className="no-print">Private hub · Zero pay or student personal data stored</span>
          </div>
        </footer>
      </div>

      {/* Mobile Fixed Bottom Tab Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-[#1B1224]/95 backdrop-blur-md border-t border-[#E5D9EC] dark:border-[#332442] grid grid-cols-5 items-center px-1 no-print"
      >
        {MOBILE_PRIMARY_TABS.map((tabId) => {
          const item = ALL_NAV_ITEMS.find((i) => i.id === tabId)!;
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                active
                  ? 'text-[#3B1050] dark:text-[#E2B8D0] font-bold'
                  : 'text-[#6A5A78] dark:text-[#9D8AAD]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-none">{item.shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
            mobileMenuOpen || !MOBILE_PRIMARY_TABS.includes(activeTab)
              ? 'text-[#3B1050] dark:text-[#E2B8D0] font-bold'
              : 'text-[#6A5A78] dark:text-[#9D8AAD]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] leading-none">More</span>
        </button>
      </nav>

      {/* Mobile "More" Bottom Sheet */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end no-print"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full bg-white dark:bg-[#1F1629] rounded-t-3xl border-t border-[#E5D9EC] dark:border-[#332442] p-5 pb-8 max-h-[82vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[#D8C7E3] dark:bg-[#3E2D52] rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1F122B] dark:text-[#F5EEF9]">
                All Hub Sections
              </h2>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-[#5A4A66] dark:text-[#BBAAC9]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`min-h-[48px] flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                      active
                        ? 'bg-[#3B1050] text-white'
                        : 'bg-[#F4EEF7] dark:bg-[#2A1D38] text-[#1F122B] dark:text-[#F5EEF9]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Explicit Confirmation Modal for Gmail Notification Emails */}
      <EmailConfirmModal draft={pendingEmailDraft} onClose={clearPendingEmailDraft} />

      {/* Global 10-Minute Upcoming Meeting Reminder Toast (Myanmar Time · MMT) */}
      <MeetingReminderToast onSelectTab={handleNavClick} />
    </div>
  );
}
