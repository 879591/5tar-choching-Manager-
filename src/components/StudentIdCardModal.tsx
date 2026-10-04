import React from 'react';
import { Printer, User, X } from 'lucide-react';
import { Batch, Institute, Student } from '../types';

interface StudentIdCardModalProps {
  student: Student;
  batch?: Batch;
  institute: Institute;
  onClose: () => void;
}

export const StudentIdCardModal: React.FC<StudentIdCardModalProps> = ({
  student,
  batch,
  institute,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Action Header */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div>
            <h3 className="text-sm font-semibold">Student Identity Card</h3>
            <p className="text-xs text-slate-400">{student.admission_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable ID Card Wrapper */}
        <div className="p-6 flex justify-center bg-slate-50">
          <div className="w-full max-w-[320px] rounded-2xl bg-white border-2 border-slate-300 shadow-md overflow-hidden">
            {/* Branded Top Banner */}
            <div
              className="px-4 py-4 text-white text-center"
              style={{ backgroundColor: institute.primary_color || '#0f172a' }}
            >
              <div className="flex items-center justify-center gap-2.5">
                {institute.logo_url ? (
                  <img
                    src={institute.logo_url}
                    alt={institute.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-lg object-cover bg-white p-0.5"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center font-bold text-sm">
                    {institute.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <h2 className="text-sm font-bold leading-tight">{institute.name}</h2>
                  <p className="text-[10px] text-white/80 truncate max-w-[190px]">
                    {institute.address || 'Coaching Institute'}
                  </p>
                </div>
              </div>
            </div>

            {/* Photo & Identity Core */}
            <div className="p-5 text-center">
              <div className="w-24 h-24 mx-auto rounded-xl border-2 border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                {student.photo_url ? (
                  <img
                    src={student.photo_url}
                    alt={student.full_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>

              <h3 className="mt-3 text-base font-bold text-slate-900">{student.full_name}</h3>
              <p className="text-xs font-mono font-semibold text-amber-700 mt-0.5">
                ID: {student.admission_number}
              </p>

              {/* Details Table */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Batch:</span>
                  <span className="font-semibold text-slate-900 text-right">{batch?.name || 'General Batch'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Course:</span>
                  <span className="font-medium text-slate-800 text-right">{batch?.course || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Father/Guardian:</span>
                  <span className="font-medium text-slate-800 text-right">{student.father_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Emergency Phone:</span>
                  <span className="font-mono font-semibold text-slate-900">{student.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">DOB:</span>
                  <span className="font-mono text-slate-800">{student.date_of_birth || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Validity:</span>
                  <span className="font-mono font-medium text-emerald-700">Academic Session 2026–27</span>
                </div>
              </div>

              {/* Signature & Helpline Footer */}
              <div className="mt-5 pt-3 border-t border-slate-200 flex items-end justify-between text-[10px] text-slate-500">
                <div className="text-left">
                  <p className="font-semibold text-slate-700">Helpline:</p>
                  <p className="font-mono">{institute.phone || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <div className="w-20 border-b border-slate-400 mb-1 ml-auto" />
                  <p className="font-semibold text-slate-700">Director Sign</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
