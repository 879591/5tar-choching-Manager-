import React from 'react';
import { Printer, X } from 'lucide-react';
import { Batch, Fee, Institute, Student } from '../types';

interface FeeReceiptModalProps {
  fee: Fee;
  student?: Student;
  batch?: Batch;
  institute: Institute;
  onClose: () => void;
}

export const FeeReceiptModal: React.FC<FeeReceiptModalProps> = ({
  fee,
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
      <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Top Action Bar (Hidden on Print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div>
            <h3 className="text-sm font-semibold">Official Fee Receipt — {fee.receipt_number}</h3>
            <p className="text-xs text-slate-400">Ready for A4 or thermal receipt printer / Save as PDF</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download PDF</span>
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

        {/* Printable Receipt Surface */}
        <div className="p-8 bg-white text-slate-900" id="printable-fee-receipt">
          {/* Header with Institute Branding */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2"
            style={{ borderColor: institute.primary_color || '#0f172a' }}
          >
            <div className="flex items-center gap-4">
              {institute.logo_url ? (
                <img
                  src={institute.logo_url}
                  alt={institute.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                  style={{ backgroundColor: institute.primary_color || '#0f172a' }}
                >
                  {institute.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{institute.name}</h1>
                <p className="text-xs text-slate-600 mt-0.5">{institute.address || 'Coaching Campus, India'}</p>
                <p className="text-xs text-slate-600 font-mono mt-0.5">
                  Phone: {institute.phone || 'N/A'} {institute.email ? `· ${institute.email}` : ''}
                </p>
              </div>
            </div>
            <div className="mt-4 sm:mt-0 sm:text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Fee Payment Receipt
              </span>
              <span className="text-base font-mono font-bold text-slate-900 mt-1 block">
                {fee.receipt_number}
              </span>
              <span className="text-xs text-slate-500 font-mono block mt-0.5">
                Date: {fee.payment_date}
              </span>
            </div>
          </div>

          {/* Student & Batch Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 border-b border-slate-200 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Student Name:</span>
                <span className="font-semibold text-slate-900">{student?.full_name || 'Student'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Admission No:</span>
                <span className="font-mono font-medium text-slate-900">{student?.admission_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Father&apos;s Name:</span>
                <span className="text-slate-800">{student?.father_name || '—'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Batch:</span>
                <span className="font-medium text-slate-900">{batch?.name || 'Assigned Batch'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Course:</span>
                <span className="text-slate-800">{batch?.course || '—'}</span>
              </div>
              <div className="flex justify-between sm:justify-start sm:gap-2">
                <span className="text-slate-500">Phone:</span>
                <span className="font-mono text-slate-800">{student?.phone || '—'}</span>
              </div>
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="my-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-2.5">Description / Installment</th>
                  <th className="py-2.5">Payment Method</th>
                  <th className="py-2.5 text-right">Amount Paid (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                <tr>
                  <td className="py-4">
                    <p className="font-semibold text-slate-900">Tuition / Coaching Fee — {fee.month}</p>
                    {fee.remarks && <p className="text-xs text-slate-500 mt-0.5">Remarks: {fee.remarks}</p>}
                  </td>
                  <td className="py-4 font-medium text-slate-700">{fee.payment_method}</td>
                  <td className="py-4 text-right font-mono text-base font-bold text-slate-900">
                    ₹{Number(fee.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900">
                  <td colSpan={2} className="py-3 text-sm font-bold text-slate-900">
                    Total Amount Received
                  </td>
                  <td className="py-3 text-right font-mono text-lg font-bold text-emerald-700">
                    ₹{Number(fee.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer & Signature */}
          <div className="pt-8 mt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 text-xs text-slate-500">
            <div className="space-y-1">
              <p>Received By: <span className="font-semibold text-slate-800">{fee.collected_by}</span></p>
              <p>Note: Fees once paid are non-refundable and non-transferable.</p>
              <p className="font-mono text-[11px] text-slate-400">Generated via 5tar Coaching Manager</p>
            </div>
            <div className="text-center sm:text-right min-w-[160px]">
              <div className="h-10 border-b border-slate-400 mb-1.5" />
              <p className="font-semibold text-slate-800">Authorized Signatory</p>
              <p className="text-[11px] text-slate-500">{institute.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
