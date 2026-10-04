import React, { useMemo, useState } from 'react';
import { Bell, Camera, IdCard, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createNoticeRecord,
  deleteNoticeRecord,
  updateInstituteSettings,
} from '../services/database';
import { Student } from '../types';
import { StudentIdCardModal } from '../components/StudentIdCardModal';
import { compressImageFileToDataUrl } from '../utils/image';

export const NoticesAndIdCardsPage: React.FC = () => {
  const { institute, notices, students, batches } = useApp();

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'Everyone' | 'Students' | 'Teachers'>('Everyone');
  const [publishDate, setPublishDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const [selectedIdStudent, setSelectedIdStudent] = useState<Student | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute || !title.trim() || !message.trim()) return;
    setSaving(true);
    try {
      await createNoticeRecord(institute.id, {
        title,
        message,
        target_role: targetRole,
        publish_date: publishDate,
      });
      setTitle('');
      setMessage('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Publish Notice Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Publish Institute Notice</h2>
          </div>

          <form onSubmit={handlePublish} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title *</label>
              <input
                type="text"
                required
                placeholder="e.g., Holiday Notice / Exam Schedule"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience *</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as 'Everyone' | 'Students' | 'Teachers')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                >
                  <option value="Everyone">Everyone</option>
                  <option value="Students">Students Only</option>
                  <option value="Teachers">Teachers Only</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Publish Date *</label>
                <input
                  type="date"
                  required
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Announcement Message *</label>
              <textarea
                rows={4}
                required
                placeholder="Write clear instructions for students or faculty..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-900 py-2.5 px-4 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>{saving ? 'Publishing...' : 'Publish Notice'}</span>
            </button>
          </form>
        </div>

        {/* Right: Active Notice Board */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Published Notices ({notices.length})
          </h2>
          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
            {notices.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No notices published yet.</p>
            ) : (
              notices.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-amber-800">Audience: {n.target_role}</span>
                      <span>·</span>
                      <span className="font-mono">{n.publish_date}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">{n.title}</h3>
                    <p className="text-xs text-slate-700 mt-1 whitespace-pre-line">{n.message}</p>
                  </div>
                  {institute && (
                    <button
                      type="button"
                      onClick={() => deleteNoticeRecord(institute.id, n.id, n.title)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer shrink-0"
                      title="Delete Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Student ID Cards Generator Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Student Identity Cards Generator</h2>
            <p className="text-xs text-slate-500">
              Click any student below to preview, print, or download their branded Institute ID Card
            </p>
          </div>
          <IdCard className="w-5 h-5 text-slate-400" />
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {students.map((st) => {
            const batch = batches.find((b) => b.id === st.batch_id);
            return (
              <div
                key={st.id}
                className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 hover:border-slate-300"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{st.full_name}</p>
                  <p className="text-[11px] font-mono text-slate-500">{st.admission_number}</p>
                  <p className="text-[11px] text-slate-600 truncate">{batch?.name || '—'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIdStudent(st)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shrink-0 cursor-pointer"
                >
                  ID Card
                </button>
              </div>
            );
          })}
          {students.length === 0 && (
            <p className="col-span-full text-xs text-slate-500 py-6 text-center">
              No students registered yet. Add students to generate ID cards.
            </p>
          )}
        </div>
      </div>

      {selectedIdStudent && institute && (
        <StudentIdCardModal
          student={selectedIdStudent}
          batch={batches.find((b) => b.id === selectedIdStudent.batch_id)}
          institute={institute}
          onClose={() => setSelectedIdStudent(null)}
        />
      )}
    </div>
  );
};

export const ReportsAndSettingsPage: React.FC = () => {
  const {
    institute,
    students,
    batches,
    attendance,
    fees,
    feePlans,
    tests,
    marks,
    auditLogs,
    subscription,
  } = useApp();

  const [activeReportTab, setActiveReportTab] = useState<'students' | 'attendance' | 'fees' | 'results' | 'settings'>('students');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  // Settings Form State
  const [instCode, setInstCode] = useState(institute?.institute_code || '');
  const [instName, setInstName] = useState(institute?.name || '');
  const [ownerName, setOwnerName] = useState(institute?.owner_name || '');
  const [phone, setPhone] = useState(institute?.phone || '');
  const [email, setEmail] = useState(institute?.email || '');
  const [website, setWebsite] = useState(institute?.website || '');
  const [address, setAddress] = useState(institute?.address || '');
  const [logoUrl, setLogoUrl] = useState(institute?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(institute?.primary_color || '#0f172a');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (institute) {
      setInstCode(institute.institute_code || institute.id.slice(0, 8).toUpperCase());
      setInstName(institute.name);
      setOwnerName(institute.owner_name);
      setPhone(institute.phone || '');
      setEmail(institute.email || '');
      setWebsite(institute.website || '');
      setAddress(institute.address || '');
      setLogoUrl(institute.logo_url || '');
      setPrimaryColor(institute.primary_color || '#0f172a');
    }
  }, [institute]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute) return;
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      await updateInstituteSettings(institute.id, {
        institute_code: instCode,
        name: instName,
        owner_name: ownerName,
        phone,
        email,
        website,
        address,
        logo_url: logoUrl,
        primary_color: primaryColor,
      });
      setSettingsSavedMsg('Institute branding, Coaching Code & settings updated across all receipts, ID cards, and dashboards.');
    } finally {
      setSavingSettings(false);
    }
  };

  const feeReport = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.slice(0, 7);
    const dailyTotal = fees
      .filter((f) => f.payment_date === today)
      .reduce((s, f) => s + Number(f.amount), 0);
    const monthlyTotal = fees
      .filter((f) => f.payment_date.startsWith(monthPrefix))
      .reduce((s, f) => s + Number(f.amount), 0);

    const byMethod: Record<string, number> = { Cash: 0, UPI: 0, 'Bank Transfer': 0, Other: 0 };
    fees.forEach((f) => {
      byMethod[f.payment_method] = (byMethod[f.payment_method] || 0) + Number(f.amount);
    });

    let expectedTotal = 0;
    students
      .filter((s) => s.status === 'Active')
      .forEach((s) => {
        const plan = feePlans.find((fp) => fp.batch_id === s.batch_id);
        if (plan) expectedTotal += Number(plan.total_fee);
      });
    const allPaid = fees.reduce((s, f) => s + Number(f.amount), 0);
    const pendingTotal = Math.max(0, expectedTotal - allPaid);

    return { dailyTotal, monthlyTotal, byMethod, pendingTotal, allPaid };
  }, [fees, students, feePlans]);

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports, Branding &amp; Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprehensive analytics, printable statements, institute branding, and security audit trail
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {(
            [
              { id: 'students', label: 'Student Report' },
              { id: 'attendance', label: 'Attendance Report' },
              { id: 'fees', label: 'Fee Report' },
              { id: 'results', label: 'Result Report' },
              { id: 'settings', label: 'Institute Settings' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveReportTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeReportTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. STUDENT REPORT */}
      {activeReportTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Student Enrollment Report</h2>
              <p className="text-xs text-slate-500">Total, Active, Inactive, and Batch-wise distribution</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Report</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Total Students</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{students.length}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Active Students</span>
              <span className="text-2xl font-bold font-mono text-emerald-700">
                {students.filter((s) => s.status === 'Active').length}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Inactive Students</span>
              <span className="text-2xl font-bold font-mono text-slate-500">
                {students.filter((s) => s.status === 'Inactive').length}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Batch-Wise Student Count</h3>
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Batch Name</th>
                  <th className="py-2">Course</th>
                  <th className="py-2">Timing</th>
                  <th className="py-2 text-right">Enrolled Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 font-semibold text-slate-900">{b.name}</td>
                    <td className="py-2.5 text-slate-600">{b.course}</td>
                    <td className="py-2.5 font-mono text-xs text-slate-600">{b.timing}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                      {students.filter((s) => s.batch_id === b.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ATTENDANCE REPORT */}
      {activeReportTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Attendance Analytics Report</h2>
              <p className="text-xs text-slate-500">Filter by date range across students and batches</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Student</th>
                <th className="py-2">Admission No.</th>
                <th className="py-2 text-right">Classes Marked</th>
                <th className="py-2 text-right">Present / Late</th>
                <th className="py-2 text-right">Absent</th>
                <th className="py-2 text-right">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {students.map((st) => {
                const logs = attendance.filter(
                  (a) =>
                    a.student_id === st.id &&
                    a.attendance_date >= dateFrom &&
                    a.attendance_date <= dateTo
                );
                const pres = logs.filter((a) => a.status === 'Present' || a.status === 'Late').length;
                const abs = logs.filter((a) => a.status === 'Absent').length;
                const pct = logs.length > 0 ? Math.round((pres / logs.length) * 100) : 0;
                return (
                  <tr key={st.id}>
                    <td className="py-2.5 font-semibold text-slate-900">{st.full_name}</td>
                    <td className="py-2.5 font-mono text-slate-600">{st.admission_number}</td>
                    <td className="py-2.5 text-right font-mono">{logs.length}</td>
                    <td className="py-2.5 text-right font-mono text-emerald-700">{pres}</td>
                    <td className="py-2.5 text-right font-mono text-rose-600">{abs}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-slate-900">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. FEE REPORT */}
      {activeReportTab === 'fees' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Financial &amp; Fee Collection Report</h2>
              <p className="text-xs text-slate-500">Daily, monthly, pending dues, and payment mode breakdown</p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Financial Report</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Today&apos;s Collection</span>
              <span className="text-xl font-bold font-mono text-slate-900">
                ₹{feeReport.dailyTotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Monthly Collection</span>
              <span className="text-xl font-bold font-mono text-emerald-700">
                ₹{feeReport.monthlyTotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Total Collected</span>
              <span className="text-xl font-bold font-mono text-slate-900">
                ₹{feeReport.allPaid.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500 block">Pending Fees</span>
              <span className="text-xl font-bold font-mono text-amber-700">
                ₹{feeReport.pendingTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase text-slate-500 mb-3">Payment Method Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(feeReport.byMethod).map(([method, amt]) => (
                <div key={method} className="p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-700">{method}</span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    ₹{amt.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. RESULT REPORT */}
      {activeReportTab === 'results' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Test-Wise &amp; Batch Performance Report</h2>
            <p className="text-xs text-slate-500">Average score, pass percentage, and highest marks per test</p>
          </div>

          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Test Title</th>
                <th className="py-2">Subject</th>
                <th className="py-2">Batch</th>
                <th className="py-2 text-right">Students Appeared</th>
                <th className="py-2 text-right">Avg Score</th>
                <th className="py-2 text-right">Pass %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tests.map((t) => {
                const b = batches.find((batch) => batch.id === t.batch_id);
                const tMarks = marks.filter((m) => m.test_id === t.id);
                const avg =
                  tMarks.length > 0
                    ? tMarks.reduce((s, m) => s + Number(m.marks), 0) / tMarks.length
                    : 0;
                const passCnt = tMarks.filter((m) => Number(m.marks) >= t.passing_marks).length;
                const passPct = tMarks.length > 0 ? Math.round((passCnt / tMarks.length) * 100) : 0;

                return (
                  <tr key={t.id}>
                    <td className="py-2.5 font-semibold text-slate-900">{t.title}</td>
                    <td className="py-2.5 text-slate-600">{t.subject}</td>
                    <td className="py-2.5 text-slate-600">{b?.name || '—'}</td>
                    <td className="py-2.5 text-right font-mono">{tMarks.length}</td>
                    <td className="py-2.5 text-right font-mono">
                      {avg.toFixed(1)} / {t.total_marks}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-700">{passPct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. INSTITUTE BRANDING, SUBSCRIPTION & AUDIT LOGS */}
      {activeReportTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Institute Branding &amp; Profile Settings
            </h2>
            {settingsSavedMsg && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {settingsSavedMsg}
              </div>
            )}
            <form onSubmit={handleSaveSettings} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Institute Name *</label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Coaching Code *</label>
                  <input
                    type="text"
                    required
                    value={instCode}
                    onChange={(e) => setInstCode(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-amber-400 bg-amber-50/60 px-3 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Owner / Director Name *</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Theme Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-14 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-600">{primaryColor}</span>
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full mt-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                {savingSettings ? 'Saving Branding...' : 'Save Institute Branding'}
              </button>
            </form>
          </div>

          {/* Right: Subscription Plan & Security Audit Log */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-amber-700">Current SaaS Plan</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {subscription?.plan || 'PRO'} PLAN ({subscription?.status || 'Active'})
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Valid from {subscription?.start_date || '2026'} to {subscription?.expiry_date || '2027'}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Tenant ID: {institute?.id.slice(0, 14)}...
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
                Institute Audit Log ({auditLogs.length})
              </h3>
              <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{log.action}</p>
                      <p className="text-[11px] text-slate-500">
                        By {log.user_name || 'User'} · Type: {log.record_type}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {log.created_at.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <p className="text-xs text-slate-400 py-6 text-center">No audit events recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
