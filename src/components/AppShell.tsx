import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  FileSpreadsheet,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { PWAInstallButton, OfflineIndicator } from '../components/PWAInstallButton';

interface AppShellProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ activeTab, setActiveTab, children }) => {
  const {
    institute,
    profile,
    activeRole,
    setActiveRole,
    logout,
    isSuperAdminUser,
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navItems = React.useMemo(() => {
    if (activeRole === UserRole.SUPER_ADMIN) {
      return [
        { id: 'super_admin', label: 'Institutes & SaaS', icon: Building2 },
        { id: 'dashboard', label: 'Active Tenant View', icon: LayoutDashboard },
        { id: 'reports', label: 'Reports & Audit', icon: BarChart3 },
      ];
    }
    if (activeRole === UserRole.TEACHER) {
      return [
        { id: 'teacher_home', label: 'Teacher Home', icon: LayoutDashboard },
        { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
        { id: 'tests', label: 'Tests & Marks', icon: FileSpreadsheet },
        { id: 'notices', label: 'Notices', icon: Bell },
      ];
    }
    if (activeRole === UserRole.STUDENT) {
      return [
        { id: 'student_home', label: 'My Portal', icon: GraduationCap },
      ];
    }
    // Default: INSTITUTE_ADMIN
    return [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'students', label: 'Students', icon: GraduationCap },
      { id: 'batches', label: 'Batches', icon: BookOpen },
      { id: 'teachers', label: 'Teachers', icon: Users },
      { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { id: 'fees', label: 'Fees & Receipts', icon: IndianRupee },
      { id: 'tests', label: 'Tests & Results', icon: FileSpreadsheet },
      { id: 'notices', label: 'Notices & ID Cards', icon: Bell },
      { id: 'reports', label: 'Reports & Settings', icon: BarChart3 },
    ];
  }, [activeRole]);

  const handleRoleSwitch = (nextRole: UserRole) => {
    setActiveRole(nextRole);
    if (nextRole === UserRole.SUPER_ADMIN) setActiveTab('super_admin');
    else if (nextRole === UserRole.TEACHER) setActiveTab('teacher_home');
    else if (nextRole === UserRole.STUDENT) setActiveTab('student_home');
    else setActiveTab('dashboard');
  };

  const brandColor = institute?.primary_color || '#0f172a';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <OfflineIndicator />

      {/* Desktop Sidebar (260px fixed width) */}
      <aside className="no-print hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900 text-white border-r border-slate-800 z-30">
        {/* Institute Brand Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center gap-3">
          {institute?.logo_url ? (
            <img
              src={institute.logo_url}
              alt={institute.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover bg-white shrink-0"
            />
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white shrink-0 border border-white/20"
              style={{ backgroundColor: brandColor }}
            >
              {(institute?.name || '5T').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{institute?.name || '5tar Coaching'}</p>
            <p className="text-[11px] text-slate-400 truncate">5tar Coaching Manager</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Role Switcher (For testing Admin / Teacher / Student / Super Admin views seamlessly) */}
        <div className="p-3.5 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Active Portal Role View
            </label>
            <select
              value={activeRole}
              onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none"
            >
              <option value={UserRole.INSTITUTE_ADMIN}>Institute Admin (Owner)</option>
              <option value={UserRole.TEACHER}>Teacher Portal</option>
              <option value={UserRole.STUDENT}>Student Portal</option>
              {isSuperAdminUser && <option value={UserRole.SUPER_ADMIN}>Super Admin (SaaS)</option>}
            </select>
          </div>

          <PWAInstallButton variant="full" />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <div className="truncate pr-2">
              <p className="font-semibold text-white truncate">{profile?.full_name}</p>
              <p className="text-[10px] text-slate-400 truncate">{profile?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Bar (Strictly 3 zones: Brand/Context, Role/Nav, Primary Actions) */}
        <header className="no-print sticky top-0 z-20 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between">
          {/* Zone 1: Brand / Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {institute?.name || '5tar Coaching Manager'}
            </span>
          </div>

          {/* Zone 2: Mobile/Tablet Role Switcher */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
            <span>Role:</span>
            <select
              value={activeRole}
              onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-900 bg-white"
            >
              <option value={UserRole.INSTITUTE_ADMIN}>Institute Admin</option>
              <option value={UserRole.TEACHER}>Teacher</option>
              <option value={UserRole.STUDENT}>Student</option>
              {isSuperAdminUser && <option value={UserRole.SUPER_ADMIN}>Super Admin</option>}
            </select>
          </div>

          {/* Zone 3: Install App & Sign Out */}
          <div className="flex items-center gap-2">
            <PWAInstallButton />
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto pb-24 md:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div className="no-print fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-slate-900 text-white h-full flex flex-col justify-between p-4 z-10">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-sm font-bold text-amber-400">{institute?.name}</span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-3 mb-4">
                <label className="block text-[10px] uppercase text-slate-400 mb-1">Switch Role View</label>
                <select
                  value={activeRole}
                  onChange={(e) => {
                    handleRoleSwitch(e.target.value as UserRole);
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs font-semibold text-white"
                >
                  <option value={UserRole.INSTITUTE_ADMIN}>Institute Admin</option>
                  <option value={UserRole.TEACHER}>Teacher</option>
                  <option value={UserRole.STUDENT}>Student</option>
                  {isSuperAdminUser && <option value={UserRole.SUPER_ADMIN}>Super Admin</option>}
                </select>
              </div>

              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                        active ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <PWAInstallButton variant="full" />
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-300"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Fixed Thumb-Zone Ergonomics) */}
      <nav className="no-print md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-15 px-1">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
                active ? 'text-slate-900 font-bold' : 'text-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
              <span className="text-[10px] mt-0.5 truncate max-w-[68px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
