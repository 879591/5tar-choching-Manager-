/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LoginAndOnboardingView } from './pages/LoginAndOnboarding';
import { AppShell } from './components/AppShell';
import { AdminDashboardView } from './pages/AdminDashboard';
import { StudentsPage } from './pages/StudentsPage';
import { BatchesPage, TeachersPage } from './pages/BatchesAndTeachersPage';
import { AttendancePage } from './pages/AttendancePage';
import { FeesPage } from './pages/FeesPage';
import { TestsAndResultsPage } from './pages/TestsAndResultsPage';
import { NoticesAndIdCardsPage, ReportsAndSettingsPage } from './pages/NoticesAndReportsPage';
import { TeacherPortalView, StudentPortalView } from './pages/TeacherAndStudentPortals';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { UserRole } from './types';

const MainRouter: React.FC = () => {
  const { user, profile, institute, activeRole, authLoading, dataLoading } = useApp();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [preselectedFeeStudentId, setPreselectedFeeStudentId] = useState<string>('');

  if (authLoading || (user && profile && dataLoading && !institute)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center font-bold mx-auto animate-pulse">
            5★
          </div>
          <p className="text-sm font-semibold text-slate-900">Loading 5tar Coaching Manager...</p>
          <p className="text-xs text-slate-500">Verifying authentication &amp; tenant isolation</p>
        </div>
      </div>
    );
  }

  // Not signed in or has not created their coaching institute yet
  if (!user || !profile || !institute) {
    return <LoginAndOnboardingView />;
  }

  // Suspended institute guard for non-SuperAdmins
  if (institute.status === 'Suspended' && activeRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-rose-700">Institute Account Suspended</h1>
          <p className="text-xs text-slate-600">
            Access to <strong>{institute.name}</strong> has been temporarily suspended by the platform administrator.
          </p>
        </div>
      </div>
    );
  }

  const handleNavigateToFeeForStudent = (studentId: string) => {
    setPreselectedFeeStudentId(studentId);
    setActiveTab('fees');
  };

  return (
    <AppShell activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* Role-Protected Route Rendering */}
      {activeRole === UserRole.SUPER_ADMIN && activeTab === 'super_admin' && <SuperAdminPage />}

      {activeRole === UserRole.STUDENT ? (
        <StudentPortalView activeSubTab={activeTab} />
      ) : activeRole === UserRole.TEACHER ? (
        <>
          {activeTab === 'attendance' && <AttendancePage />}
          {activeTab === 'tests' && <TestsAndResultsPage />}
          {activeTab === 'notices' && <NoticesAndIdCardsPage />}
          {activeTab !== 'attendance' && activeTab !== 'tests' && activeTab !== 'notices' && (
            <TeacherPortalView onQuickAction={(tab) => setActiveTab(tab)} />
          )}
        </>
      ) : (
        /* INSTITUTE_ADMIN or SUPER_ADMIN viewing tenant pages */
        <>
          {activeTab === 'dashboard' && <AdminDashboardView onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'students' && (
            <StudentsPage onNavigateToFeeForStudent={handleNavigateToFeeForStudent} />
          )}
          {activeTab === 'batches' && <BatchesPage />}
          {activeTab === 'teachers' && <TeachersPage />}
          {activeTab === 'attendance' && <AttendancePage />}
          {activeTab === 'fees' && <FeesPage preselectedStudentId={preselectedFeeStudentId} />}
          {activeTab === 'tests' && <TestsAndResultsPage />}
          {activeTab === 'notices' && <NoticesAndIdCardsPage />}
          {activeTab === 'reports' && <ReportsAndSettingsPage />}
        </>
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
