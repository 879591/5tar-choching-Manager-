import React, { useMemo } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarCheck,
  FileSpreadsheet,
  GraduationCap,
  IndianRupee,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { seedSampleCoachingData } from '../services/database';

interface AdminDashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigate }) => {
  const {
    institute,
    profile,
    students,
    teachers,
    batches,
    attendance,
    fees,
    feePlans,
    tests,
    notices,
  } = useApp();

  const [seeding, setSeeding] = React.useState(false);

  const today = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = today.slice(0, 7); // YYYY-MM

  const metrics = useMemo(() => {
    const activeStudents = students.filter((s) => s.status === 'Active');
    const activeBatches = batches.filter((b) => b.status === 'Active');
    const activeTeachers = teachers.filter((t) => t.status === 'Active');

    // Today's attendance
    const todayAtt = attendance.filter((a) => a.attendance_date === today);
    const presentToday = todayAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;
    const todayAttPct =
      todayAtt.length > 0 ? Math.round((presentToday / todayAtt.length) * 100) : 0;

    // Overall Attendance %
    const totalPresent = attendance.filter((a) => a.status === 'Present' || a.status === 'Late').length;
    const overallAttPct =
      attendance.length > 0 ? Math.round((totalPresent / attendance.length) * 100) : 0;

    // Fees collected this month
    const feesThisMonth = fees
      .filter((f) => f.payment_date.startsWith(currentMonthPrefix))
      .reduce((sum, f) => sum + Number(f.amount), 0);

    const totalFeesCollected = fees.reduce((sum, f) => sum + Number(f.amount), 0);

    // Pending fees calculation based on batch fee_plans vs student payments
    let totalExpectedFee = 0;
    activeStudents.forEach((st) => {
      const plan = feePlans.find((fp) => fp.batch_id === st.batch_id);
      if (plan) {
        totalExpectedFee += Number(plan.total_fee);
      }
    });
    const pendingFees = Math.max(0, totalExpectedFee - totalFeesCollected);

    return {
      totalStudents: students.length,
      activeStudentsCount: activeStudents.length,
      activeBatchesCount: activeBatches.length,
      activeTeachersCount: activeTeachers.length,
      todayAttPct,
      todayMarkedCount: todayAtt.length,
      overallAttPct,
      feesThisMonth,
      totalFeesCollected,
      pendingFees,
      testsCount: tests.length,
    };
  }, [students, batches, teachers, attendance, fees, feePlans, tests, today, currentMonthPrefix]);

  // Monthly Fee Collection Breakdown (last 4 months or grouped by payment month)
  const monthlyFeeBars = useMemo(() => {
    const map = new Map<string, number>();
    fees.forEach((f) => {
      const key = f.payment_date.slice(0, 7) || '2026-10';
      map.set(key, (map.get(key) || 0) + Number(f.amount));
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-5);
    const maxVal = Math.max(1, ...entries.map((e) => e[1]));
    return entries.map(([monthStr, total]) => ({
      monthStr,
      total,
      heightPct: Math.max(12, Math.round((total / maxVal) * 100)),
    }));
  }, [fees]);

  // Batch-wise Student Distribution
  const batchDistribution = useMemo(() => {
    return batches.slice(0, 5).map((b) => {
      const count = students.filter((s) => s.batch_id === b.id).length;
      const pct = students.length > 0 ? Math.round((count / students.length) * 100) : 0;
      return { batch: b, count, pct };
    });
  }, [batches, students]);

  const handleLoadSample = async () => {
    if (!institute) return;
    setSeeding(true);
    try {
      await seedSampleCoachingData(institute.id, profile?.full_name || institute.owner_name);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Institute Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{institute?.name}</span>
            <span aria-hidden="true">·</span>
            <span>Academic Session 2026–27</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{today}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Institute Operations Overview
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {students.length === 0 && (
            <button
              type="button"
              onClick={handleLoadSample}
              disabled={seeding}
              className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{seeding ? 'Loading Demo Data...' : 'Load Sample Coaching Data'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Student Admission</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('fees')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <IndianRupee className="w-4 h-4" />
            <span>Collect Fee</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (8 Metrics requested in prompt) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Total Students</span>
            <GraduationCap className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {metrics.totalStudents}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.activeStudentsCount} Active enrolled
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('batches')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Active Batches</span>
            <BookOpen className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {metrics.activeBatchesCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.activeTeachersCount} Active faculty members
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Today&apos;s Attendance</span>
            <CalendarCheck className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 mt-2">
            {metrics.todayMarkedCount > 0 ? `${metrics.todayAttPct}%` : `${metrics.overallAttPct}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.todayMarkedCount > 0
              ? `${metrics.todayMarkedCount} marked today`
              : `Overall avg (${attendance.length} logs)`}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('fees')}
          className="text-left bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Fees Collected (Month)</span>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 mt-2">
            ₹{metrics.feesThisMonth.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Pending: ₹{metrics.pendingFees.toLocaleString('en-IN')}
          </p>
        </button>
      </div>

      {/* Secondary KPI Bar: Teachers, Pending Fees, Tests, Notices */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Teachers</span>
            <span className="text-base font-bold font-mono text-slate-900">{teachers.length}</span>
          </div>
          <Users className="w-4 h-4 text-slate-400" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Pending Fees</span>
            <span className="text-base font-bold font-mono text-amber-700">
              ₹{metrics.pendingFees.toLocaleString('en-IN')}
            </span>
          </div>
          <IndianRupee className="w-4 h-4 text-amber-600" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Scheduled Tests</span>
            <span className="text-base font-bold font-mono text-slate-900">{metrics.testsCount}</span>
          </div>
          <FileSpreadsheet className="w-4 h-4 text-slate-400" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Published Notices</span>
            <span className="text-base font-bold font-mono text-slate-900">{notices.length}</span>
          </div>
          <Bell className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Charts & Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Fee Collection & Attendance Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Fee Collection &amp; Batch Growth</h2>
              <p className="text-xs text-slate-500">Real-time database ledger &amp; batch enrollment distribution</p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-700">
              Total: ₹{metrics.totalFeesCollected.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
            {/* Monthly Fee Bar Visual */}
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-3">Monthly Fee Collection</h3>
              {monthlyFeeBars.length === 0 ? (
                <div className="h-36 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-400">
                  No fee receipts recorded yet
                </div>
              ) : (
                <div className="h-36 flex items-end gap-3 pt-4 px-3 rounded-xl bg-slate-50 border border-slate-100">
                  {monthlyFeeBars.map((item) => (
                    <div key={item.monthStr} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-mono font-semibold text-slate-700">
                        ₹{(item.total / 1000).toFixed(1)}k
                      </span>
                      <div
                        className="w-full max-w-[36px] rounded-t-md bg-slate-900 transition-all"
                        style={{ height: `${item.heightPct}%` }}
                      />
                      <span className="text-[10px] font-mono text-slate-500 pb-1">{item.monthStr}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Batch Student Growth / Distribution */}
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-3">Batch Enrollment &amp; Attendance</h3>
              <div className="space-y-3">
                {batchDistribution.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">No batches created yet</p>
                ) : (
                  batchDistribution.map(({ batch, count, pct }) => (
                    <div key={batch.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 truncate">{batch.name}</span>
                        <span className="font-mono text-slate-600">
                          {count} students ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Notices & Quick Actions */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Notices</h2>
                <p className="text-xs text-slate-500">Announcements for students &amp; teachers</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notices')}
                className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {notices.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No notices published yet. Click &quot;Manage&quot; to post an announcement.
                </div>
              ) : (
                notices.slice(0, 3).map((n) => (
                  <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Target: {n.target_role}</span>
                      <span className="font-mono">{n.publish_date}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mt-1">{n.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('attendance')}
              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 text-center transition-colors cursor-pointer"
            >
              Mark Attendance
            </button>
            <button
              type="button"
              onClick={() => onNavigate('tests')}
              className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-800 text-center transition-colors cursor-pointer"
            >
              Create Test / Marks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
