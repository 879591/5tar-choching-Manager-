import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, IndianRupee, Plus, Printer, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { createFeePayment } from '../services/database';
import { Fee, PaymentMethod } from '../types';
import { FeeReceiptModal } from '../components/FeeReceiptModal';

interface FeesPageProps {
  preselectedStudentId?: string;
}

export const FeesPage: React.FC<FeesPageProps> = ({ preselectedStudentId }) => {
  const { institute, profile, students, batches, fees, feePlans } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(preselectedStudentId || '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [month, setMonth] = useState('Installment 1 (Oct 2026)');
  const [remarks, setRemarks] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastCreatedReceipt, setLastCreatedReceipt] = useState<Fee | null>(null);
  const [activeReceiptModal, setActiveReceiptModal] = useState<Fee | null>(null);

  useEffect(() => {
    if (preselectedStudentId) {
      setSelectedStudentId(preselectedStudentId);
    } else if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }
  }, [preselectedStudentId, students, selectedStudentId]);

  // Auto-suggest installment amount when student changes
  useEffect(() => {
    if (!selectedStudentId) return;
    const st = students.find((s) => s.id === selectedStudentId);
    if (!st) return;
    const plan = feePlans.find((fp) => fp.batch_id === st.batch_id);
    if (plan && !amount) {
      setAmount(String(plan.installment_amount || plan.total_fee));
    }
  }, [selectedStudentId, students, feePlans]);

  const generateReceiptNumber = () => {
    const year = new Date().getFullYear();
    const seq = String(fees.length + 1).padStart(5, '0');
    return `REC-${year}-${seq}`;
  };

  const handleRecordFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute) return;
    const numericAmount = Number(amount);
    if (!selectedStudentId || !numericAmount || numericAmount <= 0 || !month.trim()) {
      setErrorMsg('कृपया छात्र चुनें और वैध शुल्क राशि (Amount > 0) दर्ज करें।');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const receiptNo = generateReceiptNumber();
      const created = await createFeePayment(institute.id, {
        student_id: selectedStudentId,
        amount: numericAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        receipt_number: receiptNo,
        month,
        remarks,
        collected_by: profile?.full_name || institute.owner_name,
      });
      setLastCreatedReceipt(created);
      setRemarks('');
    } catch (err) {
      console.error(err);
      setErrorMsg('Fee payment save नहीं हो सका। कृपया दोबारा कोशिश करें।');
    } finally {
      setSaving(false);
    }
  };

  // Pending Fees per student calculation
  const studentFeeSummaries = useMemo(() => {
    return students.map((st) => {
      const batch = batches.find((b) => b.id === st.batch_id);
      const plan = feePlans.find((fp) => fp.batch_id === st.batch_id);
      const totalCourseFee = plan ? Number(plan.total_fee) : 0;
      const paid = fees
        .filter((f) => f.student_id === st.id)
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const pending = Math.max(0, totalCourseFee - paid);
      return {
        student: st,
        batch,
        totalCourseFee,
        paid,
        pending,
      };
    });
  }, [students, batches, feePlans, fees]);

  const filteredFees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return fees;
    return fees.filter((f) => {
      const st = students.find((s) => s.id === f.student_id);
      return (
        f.receipt_number.toLowerCase().includes(q) ||
        f.month.toLowerCase().includes(q) ||
        f.payment_method.toLowerCase().includes(q) ||
        (st?.full_name || '').toLowerCase().includes(q) ||
        (st?.admission_number || '').toLowerCase().includes(q)
      );
    });
  }, [fees, students, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fee Collection &amp; Receipt Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record fee payments, generate numbered receipts (REC-2026-XXXXX), and track pending dues
          </p>
        </div>
        <div className="text-right font-mono">
          <span className="text-xs text-slate-500 block">Total Collected</span>
          <span className="text-lg font-bold text-emerald-700">
            ₹{fees.reduce((s, f) => s + Number(f.amount), 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Payment Success Banner with Instant Receipt Actions */}
      {lastCreatedReceipt && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Payment Successful — Receipt {lastCreatedReceipt.receipt_number} Generated
              </h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Amount ₹{Number(lastCreatedReceipt.amount).toLocaleString('en-IN')} recorded via{' '}
                {lastCreatedReceipt.payment_method} for {lastCreatedReceipt.month}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveReceiptModal(lastCreatedReceipt)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>View / Print / Download Receipt PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setLastCreatedReceipt(null)}
              className="px-3 py-2 text-xs font-medium text-emerald-900 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Fee Collection Form */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
            Collect Student Fee
          </h2>

          {errorMsg && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleRecordFee} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Student *</label>
              <select
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white"
              >
                <option value="">-- Choose Student --</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.admission_number})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="15000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Month / Installment *</label>
                <input
                  type="text"
                  required
                  placeholder="Installment 1 / Oct 2026"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Transaction Ref</label>
              <input
                type="text"
                placeholder="e.g., UPI Ref 428910221 or Cash Counter"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={saving || students.length === 0}
              className="w-full rounded-xl bg-slate-900 py-3 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
            >
              <IndianRupee className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Recording Payment...' : 'Record Payment & Generate Receipt'}</span>
            </button>
          </form>
        </div>

        {/* Right: Payment History & Pending Dues */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Receipts Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Payment History &amp; Receipts</h2>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search receipt or student..."
                  className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              {filteredFees.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No fee receipts found.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase">
                      <th className="py-2.5 pr-3">Receipt No.</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Installment</th>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 pl-3 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredFees.map((f) => {
                      const st = students.find((s) => s.id === f.student_id);
                      return (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="py-3 pr-3 font-mono font-semibold text-slate-900">
                            {f.receipt_number}
                            <span className="block text-[10px] font-normal text-slate-500">{f.payment_date}</span>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {st?.full_name || 'Student'}
                            <span className="block font-mono text-[10px] text-slate-500">
                              {st?.admission_number}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{f.month}</td>
                          <td className="py-3 px-3 text-slate-700">{f.payment_method}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                            ₹{Number(f.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveReceiptModal(f)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Student Pending Fee Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100">
              Student Fee Dues Status (Based on Batch Fee Plan)
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 px-3">Batch</th>
                    <th className="py-2 px-3 text-right">Total Fee</th>
                    <th className="py-2 px-3 text-right">Paid</th>
                    <th className="py-2 pl-3 text-right">Pending Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {studentFeeSummaries.map(({ student, batch, totalCourseFee, paid, pending }) => (
                    <tr key={student.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {student.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{batch?.name || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        ₹{totalCourseFee.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                        ₹{paid.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono font-bold text-amber-700">
                        ₹{pending.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {activeReceiptModal && institute && (
        <FeeReceiptModal
          fee={activeReceiptModal}
          student={students.find((s) => s.id === activeReceiptModal.student_id)}
          batch={batches.find(
            (b) => b.id === students.find((s) => s.id === activeReceiptModal.student_id)?.batch_id
          )}
          institute={institute}
          onClose={() => setActiveReceiptModal(null)}
        />
      )}
    </div>
  );
};
