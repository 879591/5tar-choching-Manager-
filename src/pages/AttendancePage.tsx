import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, CheckCircle2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveBatchAttendance } from '../services/database';
import { AttendanceStatus } from '../types';

export const AttendancePage: React.FC = () => {
  const { institute, profile, batches, students, attendance } = useApp();

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const batchStudents = useMemo(() => {
    return students.filter((s) => s.batch_id === selectedBatchId && s.status === 'Active');
  }, [students, selectedBatchId]);

  // Synchronize existing attendance records for selected batch + date
  useEffect(() => {
    const nextMap: Record<string, AttendanceStatus> = {};
    batchStudents.forEach((st) => {
      const existing = attendance.find(
        (a) =>
          a.batch_id === selectedBatchId &&
          a.student_id === st.id &&
          a.attendance_date === selectedDate
      );
      nextMap[st.id] = existing ? existing.status : 'Present';
    });
    setStatusMap(nextMap);
  }, [batchStudents, attendance, selectedBatchId, selectedDate]);

  const markAllPresent = () => {
    const nextMap: Record<string, AttendanceStatus> = {};
    batchStudents.forEach((st) => {
      nextMap[st.id] = 'Present';
    });
    setStatusMap(nextMap);
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setStatusMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSaveAttendance = async () => {
    if (!institute || !selectedBatchId || batchStudents.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const records = batchStudents.map((st) => {
        const existingRecord = attendance.find(
          (a) =>
            a.batch_id === selectedBatchId &&
            a.student_id === st.id &&
            a.attendance_date === selectedDate
        );
        return {
          student_id: st.id,
          status: statusMap[st.id] || 'Present',
          existingRecord,
        };
      });

      await saveBatchAttendance(
        institute.id,
        selectedBatchId,
        selectedDate,
        records,
        profile?.full_name || institute.owner_name
      );
      setFeedback({
        type: 'success',
        message: `Attendance saved for ${batchStudents.length} students on ${selectedDate}. Duplicate entries automatically prevented.`,
      });
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Attendance save नहीं हो सका। कृपया दोबारा कोशिश करें।',
      });
    } finally {
      setSaving(false);
    }
  };

  // Current selection summary
  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    batchStudents.forEach((st) => {
      const s = statusMap[st.id] || 'Present';
      if (s === 'Present') present++;
      else if (s === 'Absent') absent++;
      else if (s === 'Late') late++;
      else if (s === 'Leave') leave++;
    });
    const pct = batchStudents.length > 0 ? Math.round(((present + late) / batchStudents.length) * 100) : 0;
    return { present, absent, late, leave, pct };
  }, [batchStudents, statusMap]);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Daily Attendance Register</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select batch &amp; date · Mark individual status or Mark All Present · Prevents duplicate records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-900 bg-white min-h-[42px]"
          >
            {batches.length === 0 && <option value="">No Batches Available</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.timing})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs sm:text-sm font-mono text-slate-900 bg-white min-h-[42px]"
          />

          <button
            type="button"
            onClick={markAllPresent}
            disabled={batchStudents.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-40 cursor-pointer min-h-[42px]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Mark All Present</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={saving || batchStudents.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[42px]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-xs text-slate-500 block">Batch Attendance %</span>
          <span className="text-lg font-bold font-mono text-slate-900">{summary.pct}%</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-xs text-slate-500 block">Present</span>
          <span className="text-lg font-bold font-mono text-emerald-700">{summary.present}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-xs text-slate-500 block">Absent</span>
          <span className="text-lg font-bold font-mono text-rose-600">{summary.absent}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-xs text-slate-500 block">Late</span>
          <span className="text-lg font-bold font-mono text-amber-600">{summary.late}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5">
          <span className="text-xs text-slate-500 block">On Leave</span>
          <span className="text-lg font-bold font-mono text-slate-700">{summary.leave}</span>
        </div>
      </div>

      {/* Mobile-First Touch-Friendly Student Attendance List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {batchStudents.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">No Active Students in This Batch</p>
            <p className="text-xs text-slate-500">Enroll students in this batch to mark daily attendance.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {batchStudents.map((st, idx) => {
              const currentStatus = statusMap[st.id] || 'Present';
              const allStudentRecords = attendance.filter((a) => a.student_id === st.id);
              const studentPresent = allStudentRecords.filter(
                (a) => a.status === 'Present' || a.status === 'Late'
              ).length;
              const overallPct =
                allStudentRecords.length > 0
                  ? Math.round((studentPresent / allStudentRecords.length) * 100)
                  : 100;

              const statuses: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Leave'];

              return (
                <div
                  key={st.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{st.full_name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                        <span>{st.admission_number}</span>
                        <span>·</span>
                        <span>Overall Attendance: {overallPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 4 Touch-Friendly Segmented Status Buttons */}
                  <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center p-1 bg-slate-100 rounded-xl">
                    {statuses.map((statusOption) => {
                      const active = currentStatus === statusOption;
                      let activeStyles = 'bg-slate-900 text-white shadow-xs';
                      if (active && statusOption === 'Present') activeStyles = 'bg-emerald-700 text-white shadow-xs';
                      if (active && statusOption === 'Absent') activeStyles = 'bg-rose-600 text-white shadow-xs';
                      if (active && statusOption === 'Late') activeStyles = 'bg-amber-600 text-white shadow-xs';
                      if (active && statusOption === 'Leave') activeStyles = 'bg-slate-700 text-white shadow-xs';

                      return (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() => handleStatusChange(st.id, statusOption)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[40px] ${
                            active ? activeStyles : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {statusOption}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
