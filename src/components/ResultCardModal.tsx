import React from 'react';
import { Printer, X } from 'lucide-react';
import { Batch, Institute, Mark, Student, Test } from '../types';

interface ResultCardModalProps {
  student: Student;
  batch?: Batch;
  institute: Institute;
  tests: Test[];
  marks: Mark[];
  onClose: () => void;
}

export const ResultCardModal: React.FC<ResultCardModalProps> = ({
  student,
  batch,
  institute,
  tests,
  marks,
  onClose,
}) => {
  const studentMarks = marks.filter((m) => m.student_id === student.id);

  const rows = studentMarks
    .map((m) => {
      const test = tests.find((t) => t.id === m.test_id);
      if (!test) return null;
      const pct = test.total_marks > 0 ? (m.marks / test.total_marks) * 100 : 0;
      const passed = m.marks >= test.passing_marks;
      return {
        test,
        mark: m,
        pct,
        passed,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const totalObtained = rows.reduce((acc, r) => acc + r.mark.marks, 0);
  const totalMax = rows.reduce((acc, r) => acc + r.test.total_marks, 0);
  const overallPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div>
            <h3 className="text-sm font-semibold">Student Performance Report Card</h3>
            <p className="text-xs text-slate-400">{student.full_name} ({student.admission_number})</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Result Card</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 bg-white text-slate-900">
          {/* Header */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b-2"
            style={{ borderColor: institute.primary_color || '#0f172a' }}
          >
            <div>
              <h1 className="text-xl font-bold text-slate-900">{institute.name}</h1>
              <p className="text-xs text-slate-600 mt-0.5">{institute.address || 'Coaching Campus'}</p>
            </div>
            <div className="mt-2 sm:mt-0 sm:text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Official Result Statement
              </span>
              <span className="text-sm font-mono font-bold text-slate-900">
                Overall: {overallPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block">Student Name</span>
              <span className="font-semibold text-slate-900 text-sm">{student.full_name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Admission No.</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">{student.admission_number}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Batch</span>
              <span className="font-medium text-slate-900 text-sm">{batch?.name || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Father&apos;s Name</span>
              <span className="font-medium text-slate-900 text-sm">{student.father_name || '—'}</span>
            </div>
          </div>

          {/* Marks Table */}
          <div className="my-6">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No test results recorded for this student yet.</p>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                    <th className="py-2.5">Test Title</th>
                    <th className="py-2.5">Subject</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5 text-right">Obtained / Total</th>
                    <th className="py-2.5 text-right">Percentage</th>
                    <th className="py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map(({ test, mark, pct, passed }) => (
                    <tr key={mark.id}>
                      <td className="py-3 font-medium text-slate-900">
                        {test.title}
                        {mark.remarks && <span className="block text-xs text-slate-500">Note: {mark.remarks}</span>}
                      </td>
                      <td className="py-3 text-slate-700">{test.subject}</td>
                      <td className="py-3 font-mono text-xs text-slate-600">{test.test_date}</td>
                      <td className="py-3 text-right font-mono font-semibold text-slate-900">
                        {mark.marks} / {test.total_marks}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-800">{pct.toFixed(1)}%</td>
                      <td className="py-3 text-right font-semibold">
                        <span className={passed ? 'text-emerald-700' : 'text-rose-600'}>
                          {passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-900 font-bold">
                    <td colSpan={3} className="py-3">Cumulative Score</td>
                    <td className="py-3 text-right font-mono">{totalObtained} / {totalMax}</td>
                    <td className="py-3 text-right font-mono">{overallPct.toFixed(1)}%</td>
                    <td className="py-3 text-right text-emerald-700">
                      {overallPct >= 35 ? 'QUALIFIED' : 'NEEDS IMPROVEMENT'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
