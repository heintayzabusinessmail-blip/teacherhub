import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HubProvider, useHub } from './context/HubContext';
import { AuthGate } from './components/AuthGate';
import { OnboardingModal } from './components/OnboardingModal';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { PlanPage } from './pages/PlanPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { TeamPage } from './pages/TeamPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { TrainingPage } from './pages/TrainingPage';
import { MyMonth1Page } from './pages/MyMonth1Page';
import { VoicePage } from './pages/VoicePage';
import { ToolsPage } from './pages/ToolsPage';
import { GoodPracticePage } from './pages/GoodPracticePage';
import { AdminPage } from './pages/AdminPage';
import { BRAND } from './content/planContent';
import { signOutUser } from './firebase';
import type { NavTab } from './types';

function HubRouter() {
  const { user, authLoading, isAllowed, myProfile, profileLoaded, syncError } = useHub();
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  if (syncError) {
    throw syncError;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex flex-col items-center justify-center p-6 gap-4">
        <div className="bg-white p-2.5 rounded-2xl border border-[#E5D9EC] shadow-xs">
          <img
            src={BRAND.logoPath}
            alt="YAO English logo"
            className="h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <p className="text-sm font-medium text-[#5A4A66] dark:text-[#BBAAC9]">
          Loading YAO English Teacher Hub...
        </p>
      </div>
    );
  }

  if (!user || !isAllowed) {
    return <AuthGate />;
  }

  // Wait briefly until teacher profiles load so returning teachers skip onboarding
  if (!profileLoaded) {
    return (
      <div className="min-h-screen bg-[#F4EEF7] dark:bg-[#140D1A] flex flex-col items-center justify-center p-6 gap-4 text-center">
        <div className="bg-white p-2.5 rounded-2xl border border-[#E5D9EC] shadow-xs">
          <img
            src={BRAND.logoPath}
            alt="YAO English logo"
            className="h-12 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <p className="text-sm font-medium text-[#5A4A66] dark:text-[#BBAAC9]">
          Opening your teacher workspace...
        </p>
        <button
          type="button"
          onClick={() => signOutUser()}
          className="mt-2 min-h-[40px] px-4 py-2 rounded-xl border border-[#E5D9EC] dark:border-[#332442] bg-white dark:bg-[#1F1629] text-xs font-semibold text-[#3B1050] dark:text-[#E8D5F5]"
        >
          Sign out & try another account
        </button>
      </div>
    );
  }

  // First-login 2-minute onboarding if the teacher has not created their team card yet
  if (!myProfile || !myProfile.onboardingComplete) {
    return <OnboardingModal />;
  }

  return (
    <AppShell activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === 'home' && <HomePage onNavigate={setActiveTab} />}
      {activeTab === 'plan' && <PlanPage />}
      {activeTab === 'roadmap' && <RoadmapPage />}
      {activeTab === 'team' && <TeamPage />}
      {activeTab === 'resources' && <ResourcesPage />}
      {activeTab === 'training' && <TrainingPage />}
      {activeTab === 'my-month-1' && <MyMonth1Page onNavigate={setActiveTab} />}
      {activeTab === 'voice' && <VoicePage />}
      {activeTab === 'tools' && <ToolsPage />}
      {activeTab === 'good-practice' && <GoodPracticePage />}
      {activeTab === 'admin' && <AdminPage />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HubProvider>
        <HubRouter />
      </HubProvider>
    </ErrorBoundary>
  );
}
