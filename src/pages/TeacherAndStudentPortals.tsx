import React, { useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarCheck,
  Camera,
  FileSpreadsheet,
  GraduationCap,
  IdCard,
  IndianRupee,
  Printer,
  Upload,
  Users,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { Fee, OperationType } from '../types';
import { FeeReceiptModal } from '../components/FeeReceiptModal';
import { StudentIdCardModal } from '../components/StudentIdCardModal';
import { ResultCardModal } from '../components/ResultCardModal';
import { compressImageFileToDataUrl } from '../utils/image';

export const TeacherPortalView: React.FC<{ onQuickAction: (tab: string) => void }> = ({
  onQuickAction,
}) => {
  const {
    teachers,
    selectedTeacherId,
    setSelectedTeacherId,
    batches,
    students,
    attendance,
    tests,
    notices,
  } = useApp();

  const activeTeacher = useMemo(
    () => teachers.find((t) => t.id === selectedTeacherId) || teachers[0],
    [teachers, selectedTeacherId]
  );

  const assignedBatches = useMemo(() => {
    if (!activeTeacher) return batches;
    const matched = batches.filter((b) => b.teacher_id === activeTeacher.id);
    return matched.length > 0 ? matched : batches;
  }, [batches, activeTeacher]);

  const assignedBatchIds = useMemo(
    () => new Set(assignedBatches.map((b) => b.id)),
    [assignedBatches]
  );

  const assignedStudents = useMemo(
    () => students.filter((s) => assignedBatchIds.has(s.batch_id)),
    [students, assignedBatchIds]
  );

  const today = new Date().toISOString().split('T')[0];
  const todayAtt = attendance.filter(
    (a) => a.attendance_date === today && assignedBatchIds.has(a.batch_id)
  );
  const todayPresent = todayAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;
  const todayPct = todayAtt.length > 0 ? Math.round((todayPresent / todayAtt.length) * 100) : 0;

  const teacherNotices = notices.filter(
    (n) => n.target_role === 'Everyone' || n.target_role === 'Teachers'
  );

  return (
    <div className="space-y-6">
      {/* Teacher Profile & Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-amber-700">
            Teacher Workspace · Financial Settings Restricted
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            {activeTeacher ? `${activeTeacher.name} (${activeTeacher.subject})` : 'Faculty Portal'}
          </h1>
          <p className="text-xs text-slate-500">
            View assigned batches, mark attendance, schedule tests, and enter student marks
          </p>
        </div>

        {teachers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Faculty Profile:</span>
            <select
              value={activeTeacher?.id || ''}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subject})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Quick Actions & KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Assigned Batches</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {assignedBatches.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Total Students</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {assignedStudents.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Today&apos;s Attendance</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
            {todayAtt.length > 0 ? `${todayPct}%` : 'Not Marked'}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Upcoming / Active Tests</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {tests.filter((t) => assignedBatchIds.has(t.batch_id)).length}
          </span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onQuickAction('attendance')}
          className="p-4 rounded-2xl bg-slate-900 text-white text-left hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold">Mark Attendance</p>
            <p className="text-xs text-slate-300 mt-0.5">Daily batch attendance sheet</p>
          </div>
          <CalendarCheck className="w-5 h-5 text-amber-400" />
        </button>

        <button
          type="button"
          onClick={() => onQuickAction('tests')}
          className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-left hover:border-slate-300 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold">Create Test</p>
            <p className="text-xs text-slate-500 mt-0.5">Schedule new batch test</p>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-slate-600" />
        </button>

        <button
          type="button"
          onClick={() => onQuickAction('tests')}
          className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-900 text-left hover:border-slate-300 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold">Enter Marks</p>
            <p className="text-xs text-slate-500 mt-0.5">Update scores &amp; remarks</p>
          </div>
          <GraduationCap className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Assigned Batches & Students + Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Assigned Batches &amp; Student Roster
          </h2>
          <div className="mt-3 space-y-3">
            {assignedBatches.map((b) => {
              const bStudents = students.filter((s) => s.batch_id === b.id);
              return (
                <div key={b.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">{b.name}</h3>
                    <span className="text-xs font-mono text-slate-600">{b.timing}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {b.course} · {b.subject} · Room: {b.room || '—'} · {bStudents.length} Students
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Faculty Notices ({teacherNotices.length})
          </h2>
          <div className="mt-3 space-y-3">
            {teacherNotices.map((n) => (
              <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{n.target_role}</span>
                  <span className="font-mono">{n.publish_date}</span>
                </div>
                <h3 className="text-xs font-bold text-slate-900 mt-1">{n.title}</h3>
                <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const StudentPortalView: React.FC<{ activeSubTab: string }> = ({ activeSubTab }) => {
  const {
    institute,
    students,
    selectedStudentId,
    setSelectedStudentId,
    batches,
    attendance,
    fees,
    feePlans,
    tests,
    marks,
    notices,
  } = useApp();

  const [receiptToView, setReceiptToView] = useState<Fee | null>(null);
  const [showIdCard, setShowIdCard] = useState(false);
  const [showResultCard, setShowResultCard] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSavedMsg, setPhotoSavedMsg] = useState<string | null>(null);

  const currentStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || students[0],
    [students, selectedStudentId]
  );

  const handleStudentPortalGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentStudent) return;
    setUploadingPhoto(true);
    setPhotoSavedMsg(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 360, 360, 0.8);
      await updateDoc(doc(db, 'students', currentStudent.id), {
        photo_url: dataUrl.slice(0, 480000),
      });
      setPhotoSavedMsg('आपकी गैलरी फोटो सफलतापूर्वक आपके प्रोफाइल और ID Card पर अपडेट हो गई है!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${currentStudent.id}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const studentBatch = useMemo(
    () => batches.find((b) => b.id === currentStudent?.batch_id),
    [batches, currentStudent]
  );

  const studentAtt = useMemo(
    () => attendance.filter((a) => a.student_id === currentStudent?.id),
    [attendance, currentStudent]
  );

  const presentCount = studentAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;
  const attPct = studentAtt.length > 0 ? Math.round((presentCount / studentAtt.length) * 100) : 100;

  const studentFees = useMemo(
    () => fees.filter((f) => f.student_id === currentStudent?.id),
    [fees, currentStudent]
  );

  const totalPaid = studentFees.reduce((s, f) => s + Number(f.amount), 0);
  const batchPlan = feePlans.find((fp) => fp.batch_id === currentStudent?.batch_id);
  const pendingFee = Math.max(0, (batchPlan ? Number(batchPlan.total_fee) : 0) - totalPaid);

  const studentMarks = useMemo(
    () => marks.filter((m) => m.student_id === currentStudent?.id),
    [marks, currentStudent]
  );

  const studentNotices = notices.filter(
    (n) => n.target_role === 'Everyone' || n.target_role === 'Students'
  );

  if (!currentStudent) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <p className="text-sm font-semibold text-slate-800">No Student Profile Found</p>
        <p className="text-xs text-slate-500 mt-1">
          Please switch to Admin Role and enroll at least one student first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Header & Selector */}
      <div
        className="rounded-2xl p-5 sm:p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ backgroundColor: institute?.primary_color || '#0f172a' }}
      >
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            {currentStudent.photo_url ? (
              <img
                src={currentStudent.photo_url}
                alt={currentStudent.full_name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-400 bg-white"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 border-2 border-white/30 flex items-center justify-center font-bold text-xl text-amber-400">
                {currentStudent.full_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <label
              title="गैलरी से अपनी फोटो बदलें"
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-md cursor-pointer hover:bg-amber-400"
            >
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleStudentPortalGalleryPhoto}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/85 font-mono">
              <span>Student Portal · {currentStudent.admission_number}</span>
              <span className="px-2 py-0.5 rounded-md bg-white/15 text-amber-300 font-bold">
                Coaching Code: {institute?.institute_code || institute?.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mt-1">{currentStudent.full_name}</h1>
            <p className="text-xs text-white/80 mt-0.5">
              {institute?.name} · Batch: {studentBatch?.name || 'Assigned Batch'} ({studentBatch?.timing || ''})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-amber-300" />
            <span>{uploadingPhoto ? 'Uploading...' : 'गैलरी से फोटो लगाएं'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleStudentPortalGalleryPhoto}
              className="hidden"
            />
          </label>
          {students.length > 1 && (
            <select
              value={currentStudent.id}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-xl bg-white/15 border border-white/25 px-3 py-2 text-xs font-semibold text-white"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id} className="text-slate-900">
                  {s.full_name} ({s.admission_number})
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowIdCard(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
          >
            <IdCard className="w-4 h-4" />
            <span>Download ID Card</span>
          </button>
        </div>
      </div>

      {photoSavedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          {photoSavedMsg}
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Attendance %</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{attPct}%</span>
          <span className="text-[11px] text-slate-500">
            {presentCount}/{studentAtt.length} days present
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Fee Paid</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
            ₹{totalPaid.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500">{studentFees.length} receipts</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Pending Fee</span>
          <span className="text-2xl font-bold font-mono text-amber-700 mt-1 block">
            ₹{pendingFee.toLocaleString('en-IN')}
          </span>
          <span className="text-[11px] text-slate-500">Current batch plan</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Tests &amp; Results</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {studentMarks.length}
          </span>
          <button
            type="button"
            onClick={() => setShowResultCard(true)}
            className="text-[11px] font-semibold text-slate-900 underline cursor-pointer"
          >
            Print Result Card
          </button>
        </div>
      </div>

      {/* Detailed Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Test Results & Attendance Log */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">My Test Results</h2>
              <button
                type="button"
                onClick={() => setShowResultCard(true)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-800 hover:underline cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Printable Report Card</span>
              </button>
            </div>
            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {studentMarks.map((m) => {
                const t = tests.find((test) => test.id === m.test_id);
                if (!t) return null;
                const pct = t.total_marks > 0 ? (m.marks / t.total_marks) * 100 : 0;
                const passed = m.marks >= t.passing_marks;
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{t.title}</p>
                      <p className="text-slate-500">
                        {t.subject} · {t.test_date} {m.remarks ? `· "${m.remarks}"` : ''}
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="font-bold text-slate-900">
                        {m.marks} / {t.total_marks} ({pct.toFixed(1)}%)
                      </p>
                      <span className={passed ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                        {passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {studentMarks.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">No test results published yet.</p>
              )}
            </div>
          </div>

          {/* Fee Receipts */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              My Fee Receipts
            </h2>
            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {studentFees.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono font-semibold text-slate-900">{f.receipt_number}</p>
                    <p className="text-slate-500">
                      {f.month} · {f.payment_date} ({f.payment_method})
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-700">
                      ₹{Number(f.amount).toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptToView(f)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Receipt
                    </button>
                  </div>
                </div>
              ))}
              {studentFees.length === 0 && (
                <p className="text-xs text-slate-400 py-6 text-center">No fee receipts found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Student Profile Details & Notices */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Student Profile
            </h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-semibold text-slate-900">{currentStudent.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admission No:</span>
                <span className="font-mono font-semibold text-slate-900">{currentStudent.admission_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Father&apos;s Name:</span>
                <span className="text-slate-800">{currentStudent.father_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mother&apos;s Name:</span>
                <span className="text-slate-800">{currentStudent.mother_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-800">{currentStudent.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date of Birth:</span>
                <span className="font-mono text-slate-800">{currentStudent.date_of_birth || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Address:</span>
                <span className="text-slate-800 text-right max-w-[200px]">{currentStudent.address || '—'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Institute Notices ({studentNotices.length})
            </h2>
            <div className="mt-3 space-y-3">
              {studentNotices.map((n) => (
                <div key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-500">{n.publish_date}</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-0.5">{n.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {receiptToView && institute && (
        <FeeReceiptModal
          fee={receiptToView}
          student={currentStudent}
          batch={studentBatch}
          institute={institute}
          onClose={() => setReceiptToView(null)}
        />
      )}

      {showIdCard && institute && (
        <StudentIdCardModal
          student={currentStudent}
          batch={studentBatch}
          institute={institute}
          onClose={() => setShowIdCard(false)}
        />
      )}

      {showResultCard && institute && (
        <ResultCardModal
          student={currentStudent}
          batch={studentBatch}
          institute={institute}
          tests={tests}
          marks={marks}
          onClose={() => setShowResultCard(false)}
        />
      )}
    </div>
  );
};
