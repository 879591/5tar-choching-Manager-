import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, Printer, Save, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createTestRecord, saveTestMarks } from '../services/database';
import { Student, Test } from '../types';
import { ResultCardModal } from '../components/ResultCardModal';

export const TestsAndResultsPage: React.FC = () => {
  const { institute, batches, students, tests, marks } = useApp();

  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reportStudent, setReportStudent] = useState<Student | null>(null);

  // Create Test Form
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [batchId, setBatchId] = useState('');
  const [testDate, setTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('35');

  // Marks Entry Local State: studentId -> { marks: string, remarks: string }
  const [marksDraft, setMarksDraft] = useState<Record<string, { marks: string; remarks: string }>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!selectedTestId && tests.length > 0) {
      setSelectedTestId(tests[0].id);
    }
  }, [tests, selectedTestId]);

  const activeTest: Test | undefined = useMemo(
    () => tests.find((t) => t.id === selectedTestId),
    [tests, selectedTestId]
  );

  const testBatchStudents = useMemo(() => {
    if (!activeTest) return [];
    return students.filter((s) => s.batch_id === activeTest.batch_id && s.status === 'Active');
  }, [students, activeTest]);

  // Populate draft marks when activeTest changes
  useEffect(() => {
    if (!activeTest) return;
    const draft: Record<string, { marks: string; remarks: string }> = {};
    testBatchStudents.forEach((st) => {
      const existing = marks.find((m) => m.test_id === activeTest.id && m.student_id === st.id);
      draft[st.id] = {
        marks: existing !== undefined ? String(existing.marks) : '',
        remarks: existing?.remarks || '',
      };
    });
    setMarksDraft(draft);
  }, [activeTest, testBatchStudents, marks]);

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute) return;
    const tot = Number(totalMarks);
    const pass = Number(passingMarks);
    if (!title.trim() || !subject.trim() || !batchId || tot <= 0 || pass < 0 || pass > tot) {
      setFeedback({
        type: 'error',
        message: 'कृपया सही परीक्षा विवरण भरें। (Passing marks must be <= Total marks)',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const created = await createTestRecord(institute.id, {
        batch_id: batchId,
        title,
        subject,
        test_date: testDate,
        total_marks: tot,
        passing_marks: pass,
      });
      setSelectedTestId(created.id);
      setShowCreateModal(false);
      setTitle('');
      setSubject('');
      setFeedback({ type: 'success', message: `Test "${created.title}" created. You can now enter marks below.` });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Test create नहीं हो सका। कृपया दोबारा कोशिश करें।' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMarks = async () => {
    if (!institute || !activeTest) return;

    // Validate all entered marks <= activeTest.total_marks and >= 0
    const entriesToSave: { student_id: string; marks: number; remarks: string }[] = [];
    for (const st of testBatchStudents) {
      const d = marksDraft[st.id];
      if (!d || d.marks.trim() === '') continue;
      const val = Number(d.marks);
      if (isNaN(val) || val < 0 || val > activeTest.total_marks) {
        setFeedback({
          type: 'error',
          message: `Invalid marks for ${st.full_name}: Marks (${d.marks}) must be between 0 and ${activeTest.total_marks}.`,
        });
        return;
      }
      entriesToSave.push({
        student_id: st.id,
        marks: val,
        remarks: d.remarks || '',
      });
    }

    setSaving(true);
    setFeedback(null);
    try {
      await saveTestMarks(institute.id, activeTest.id, entriesToSave);
      setFeedback({
        type: 'success',
        message: `Marks & results saved for ${entriesToSave.length} students. Percentages and Pass/Fail calculated automatically.`,
      });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Marks save नहीं हो सके। कृपया दोबारा कोशिश करें।' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tests, Marks &amp; Result System</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create batch tests, enter validated marks (marks &le; total_marks), and print report cards
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setBatchId(batches[0]?.id || '');
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Test</span>
        </button>
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

      {tests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No Tests Created Yet</p>
          <p className="text-xs text-slate-500">Click &quot;Create New Test&quot; to schedule an exam and enter student marks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Test Selector List */}
          <div className="lg:col-span-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1">
              Select Test ({tests.length})
            </h2>
            {tests.map((t) => {
              const b = batches.find((batch) => batch.id === t.batch_id);
              const isSelected = t.id === selectedTestId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTestId(t.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs opacity-80">
                    <span>{t.subject}</span>
                    <span className="font-mono">{t.test_date}</span>
                  </div>
                  <h3 className="text-sm font-bold mt-1">{t.title}</h3>
                  <div className="flex items-center justify-between text-xs mt-2 opacity-80">
                    <span>Batch: {b?.name || '—'}</span>
                    <span className="font-mono">Max: {t.total_marks} (Pass: {t.passing_marks})</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Marks Entry & Live Result Calculation */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            {activeTest && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-semibold text-amber-700">{activeTest.subject}</span>
                    <h2 className="text-lg font-bold text-slate-900">{activeTest.title}</h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Date: {activeTest.test_date} · Total Marks: {activeTest.total_marks} · Passing Marks:{' '}
                      {activeTest.passing_marks}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveMarks}
                    disabled={saving || testBatchStudents.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer min-h-[40px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving Marks...' : 'Save Marks & Publish Results'}</span>
                  </button>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {testBatchStudents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      No active students enrolled in this test&apos;s batch.
                    </p>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                          <th className="py-2.5 pr-3">Student</th>
                          <th className="py-2.5 px-3">Marks (/{activeTest.total_marks})</th>
                          <th className="py-2.5 px-3">Percentage</th>
                          <th className="py-2.5 px-3">Result</th>
                          <th className="py-2.5 px-3">Remarks</th>
                          <th className="py-2.5 pl-3 text-right">Card</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {testBatchStudents.map((st) => {
                          const entry = marksDraft[st.id] || { marks: '', remarks: '' };
                          const numMarks = entry.marks !== '' ? Number(entry.marks) : null;
                          const pct =
                            numMarks !== null && activeTest.total_marks > 0
                              ? (numMarks / activeTest.total_marks) * 100
                              : null;
                          const passed =
                            numMarks !== null ? numMarks >= activeTest.passing_marks : null;

                          return (
                            <tr key={st.id}>
                              <td className="py-3 pr-3">
                                <p className="font-semibold text-slate-900">{st.full_name}</p>
                                <p className="font-mono text-[11px] text-slate-500">{st.admission_number}</p>
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  max={activeTest.total_marks}
                                  step="0.5"
                                  placeholder={`0 - ${activeTest.total_marks}`}
                                  value={entry.marks}
                                  onChange={(e) =>
                                    setMarksDraft((prev) => ({
                                      ...prev,
                                      [st.id]: { ...entry, marks: e.target.value },
                                    }))
                                  }
                                  className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-900 focus:border-slate-900 focus:outline-none"
                                />
                              </td>
                              <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                                {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                              </td>
                              <td className="py-3 px-3 font-semibold text-xs">
                                {passed === null ? (
                                  <span className="text-slate-400">Pending</span>
                                ) : passed ? (
                                  <span className="text-emerald-700">PASS</span>
                                ) : (
                                  <span className="text-rose-600">FAIL</span>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <input
                                  type="text"
                                  placeholder="Optional remark..."
                                  value={entry.remarks}
                                  onChange={(e) =>
                                    setMarksDraft((prev) => ({
                                      ...prev,
                                      [st.id]: { ...entry, remarks: e.target.value },
                                    }))
                                  }
                                  className="w-full min-w-[130px] rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800"
                                />
                              </td>
                              <td className="py-3 pl-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setReportStudent(st)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>Report</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Test Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Create Batch Test</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTest} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Test Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Weekly Test 2 — Electrostatics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="Physics"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Batch *</label>
                  <select
                    required
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Date *</label>
                  <input
                    type="date"
                    required
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Marks *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Pass Marks *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white"
                >
                  {saving ? 'Creating...' : 'Create Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reportStudent && institute && (
        <ResultCardModal
          student={reportStudent}
          batch={batches.find((b) => b.id === reportStudent.batch_id)}
          institute={institute}
          tests={tests}
          marks={marks}
          onClose={() => setReportStudent(null)}
        />
      )}
    </div>
  );
};
