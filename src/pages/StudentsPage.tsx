import React, { useMemo, useState } from 'react';
import {
  Camera,
  CreditCard,
  Edit2,
  FileText,
  IdCard,
  KeyRound,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createStudentRecord,
  deleteStudentRecord,
  updateStudentRecord,
} from '../services/database';
import { Student } from '../types';
import { StudentIdCardModal } from '../components/StudentIdCardModal';
import { ResultCardModal } from '../components/ResultCardModal';
import { compressImageFileToDataUrl, identifierToAuthEmail } from '../utils/image';
import { sendUniversalOtp, verifyUniversalOtpAndCreateAccount } from '../services/otpAuth';

interface StudentsPageProps {
  onNavigateToFeeForStudent?: (studentId: string) => void;
}

export const StudentsPage: React.FC<StudentsPageProps> = ({ onNavigateToFeeForStudent }) => {
  const { institute, students, batches, fees, attendance, tests, marks } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [idCardStudent, setIdCardStudent] = useState<Student | null>(null);
  const [resultStudent, setResultStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [confirmDeleteStudent, setConfirmDeleteStudent] = useState<Student | null>(null);

  // Form fields
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [batchId, setBatchId] = useState('');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  // Optional Student OTP & Password setup inside Admin Modal
  const [studentInitialPassword, setStudentInitialPassword] = useState('');
  const [studentOtpCode, setStudentOtpCode] = useState('');
  const [studentOtpPreview, setStudentOtpPreview] = useState<string | null>(null);
  const [studentWhatsappUrl, setStudentWhatsappUrl] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleGalleryPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 360, 360, 0.8);
      setPhotoUrl(dataUrl);
    } catch {
      setFeedback({ type: 'error', message: 'फोटो लोड नहीं हो सकी। कृपया दूसरी फोटो चुनें।' });
    }
  };

  const handleSendStudentOtpFromAdmin = async () => {
    if (!phone.trim()) {
      setFeedback({ type: 'error', message: 'OTP भेजने के लिए पहले छात्र का मोबाइल नंबर भरें।' });
      return;
    }
    setSendingOtp(true);
    try {
      const data = await sendUniversalOtp({
        identifier: phone.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        purpose: 'Student Admission Verification',
      });
      setStudentOtpPreview(data.otp);
      setStudentOtpCode(data.otp);
      setStudentWhatsappUrl(data.whatsappOtpUrl || null);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'OTP जनरेट करने में समस्या आई।',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const generateAdmissionNumber = () => {
    const year = new Date().getFullYear();
    const seq = String(students.length + 1).padStart(3, '0');
    const rand = Math.floor(10 + Math.random() * 89);
    return `ADM-${year}-${seq}${rand}`;
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setAdmissionNumber(generateAdmissionNumber());
    setFullName('');
    setFatherName('');
    setMotherName('');
    setPhone('');
    setEmail('');
    setDob('');
    setGender('Male');
    setAddress('');
    setPhotoUrl('');
    setBatchId(batches[0]?.id || '');
    setAdmissionDate(new Date().toISOString().split('T')[0]);
    setStatus('Active');
    setStudentInitialPassword('');
    setStudentOtpCode('');
    setStudentOtpPreview(null);
    setShowFormModal(true);
  };

  const openEditModal = (st: Student) => {
    setEditingStudent(st);
    setAdmissionNumber(st.admission_number);
    setFullName(st.full_name);
    setFatherName(st.father_name || '');
    setMotherName(st.mother_name || '');
    setPhone(st.phone);
    setEmail(st.email || '');
    setDob(st.date_of_birth || '');
    setGender(st.gender || 'Male');
    setAddress(st.address || '');
    setPhotoUrl(st.photo_url || '');
    setBatchId(st.batch_id);
    setAdmissionDate(st.admission_date || new Date().toISOString().split('T')[0]);
    setStatus(st.status);
    setStudentInitialPassword('');
    setStudentOtpCode('');
    setStudentOtpPreview(null);
    setShowFormModal(true);
  };

  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const batchName = batches.find((b) => b.id === st.batch_id)?.name || '';
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        st.full_name.toLowerCase().includes(q) ||
        st.admission_number.toLowerCase().includes(q) ||
        st.phone.toLowerCase().includes(q) ||
        (st.father_name || '').toLowerCase().includes(q) ||
        batchName.toLowerCase().includes(q);

      const matchesBatch = batchFilter === 'ALL' || st.batch_id === batchFilter;
      const matchesStatus = statusFilter === 'ALL' || st.status === statusFilter;

      return matchesSearch && matchesBatch && matchesStatus;
    });
  }, [students, batches, searchQuery, batchFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute) return;
    if (!fullName.trim() || !phone.trim() || !batchId) {
      setFeedback({
        type: 'error',
        message: 'कृपया छात्र का नाम, फ़ोन नंबर और बैच चुनें। (Please fill Name, Phone, and Batch)',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const coachingCode = institute.institute_code || institute.id.slice(0, 8).toUpperCase();

      if (studentInitialPassword.trim().length >= 6 && studentOtpCode.trim()) {
        const studentAuthEmail = identifierToAuthEmail(phone, coachingCode);
        await verifyUniversalOtpAndCreateAccount({
          identifier: phone.trim(),
          otp: studentOtpCode.trim(),
          authEmail: studentAuthEmail,
          password: studentInitialPassword.trim(),
          displayName: fullName.trim(),
          expectedOtp: studentOtpPreview,
        });
      }

      if (editingStudent) {
        await updateStudentRecord(institute.id, editingStudent.id, {
          admission_number: admissionNumber,
          full_name: fullName,
          father_name: fatherName,
          mother_name: motherName,
          phone,
          email,
          date_of_birth: dob,
          gender,
          address,
          photo_url: photoUrl,
          admission_date: admissionDate,
          batch_id: batchId,
          status,
        });
        setFeedback({ type: 'success', message: 'Student profile updated successfully.' });
      } else {
        const finalAdm = admissionNumber || generateAdmissionNumber();
        await createStudentRecord(institute.id, {
          admission_number: finalAdm,
          full_name: fullName,
          father_name: fatherName,
          mother_name: motherName,
          phone,
          email,
          date_of_birth: dob,
          gender,
          address,
          photo_url: photoUrl,
          admission_date: admissionDate,
          batch_id: batchId,
          status,
        });
        setFeedback({
          type: 'success',
          message: `छात्र "${fullName}" को सफलतापूर्वक जोड़ दिया गया है! छात्र अपने मोबाइल (${phone}) और Coaching Code (${coachingCode}) से OTP या पासवर्ड द्वारा लॉगिन कर सकता है।`,
        });
      }
      setShowFormModal(false);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Student save नहीं हो सका। कृपया दोबारा कोशिश करें।',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!institute || !confirmDeleteStudent) return;
    setSaving(true);
    try {
      await deleteStudentRecord(institute.id, confirmDeleteStudent.id, confirmDeleteStudent.full_name);
      setConfirmDeleteStudent(null);
      setFeedback({ type: 'success', message: 'Student record deleted.' });
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Delete नहीं हो सका। कृपया दोबारा कोशिश करें।' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Student Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search, admit, edit, generate ID cards, fee receipts, attendance &amp; results
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Student</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-500 hover:text-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Name, Admission No, Phone, Father Name or Batch..."
            className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2 text-xs sm:text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={batchFilter}
            onChange={(e) => {
              setBatchFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">All Batches ({batches.length})</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 bg-white focus:border-slate-900 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Student List Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {filteredStudents.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-800">No students match your current filter</p>
            <p className="text-xs text-slate-500">
              {batches.length === 0
                ? 'First create a Batch in the Batches tab, then enroll your students.'
                : 'Click "Add New Student" to register a student with a unique admission number.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase text-slate-500">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Admission No.</th>
                    <th className="py-3 px-4">Father Name</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                  {paginatedStudents.map((st) => {
                    const batch = batches.find((b) => b.id === st.batch_id);
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {st.photo_url ? (
                              <img
                                src={st.photo_url}
                                alt={st.full_name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                                {st.full_name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <button
                                type="button"
                                onClick={() => setDetailStudent(st)}
                                className="font-semibold text-slate-900 hover:underline text-left cursor-pointer"
                              >
                                {st.full_name}
                              </button>
                              <p className="text-[11px] text-slate-500">
                                {st.gender || 'Student'} · Joined {st.admission_date || '2026'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {st.admission_number}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{st.father_name || '—'}</td>
                        <td className="py-3 px-4 font-mono text-slate-800">{st.phone}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium">{batch?.name || 'Unassigned'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold text-xs ${
                              st.status === 'Active' ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setDetailStudent(st)}
                              title="View Attendance, Fees & Profile"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setIdCardStudent(st)}
                              title="Generate Student ID Card"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <IdCard className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResultStudent(st)}
                              title="View / Print Result Card"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            {onNavigateToFeeForStudent && (
                              <button
                                type="button"
                                onClick={() => onNavigateToFeeForStudent(st.id)}
                                title="Collect Fee / Receipt"
                                className="p-1.5 rounded-lg border border-slate-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              >
                                <CreditCard className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(st)}
                              title="Edit Student"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStudent(st)}
                              title="Delete Student"
                              className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono font-semibold">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingStudent ? 'Edit Student Record' : 'New Student Admission Form'}
                </h2>
                <p className="text-xs text-slate-500">All fields are stored securely in your institute database</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admission No. *</label>
                  <input
                    type="text"
                    required
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 bg-slate-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Aarav Gupta"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Father&apos;s Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Suresh Gupta"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mother&apos;s Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Sunita Gupta"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Batch *</label>
                  <select
                    required
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="">Select Batch</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.course})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Date</label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="student@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Photo from Gallery (गैलरी से फोटो लगाएं)
                  </label>
                  <div className="flex items-center gap-3">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt="Student Preview"
                        className="w-10 h-10 rounded-lg object-cover border border-amber-500 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <Camera className="w-4 h-4" />
                      </div>
                    )}
                    <label className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{photoUrl ? 'Change Gallery Photo' : 'Upload from Gallery'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGalleryPhotoSelect}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Student Mobile OTP & Password Setup Box */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                      <span>Student OTP &amp; Login Access (कोचिंग कोड: {institute?.institute_code || institute?.id.slice(0, 8).toUpperCase()})</span>
                    </p>
                    <p className="text-[11px] text-slate-600">
                      छात्र बाद में खुद भी अपने मोबाइल पर OTP मंगाकर पासवर्ड बना सकता है, या आप अभी OTP जनरेट कर सकते हैं:
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={sendingOtp}
                    onClick={handleSendStudentOtpFromAdmin}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-400 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    {sendingOtp ? 'Generating...' : 'Send OTP to Student'}
                  </button>
                </div>

                {studentOtpPreview && (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                          Generated Student OTP: <span className="font-mono font-bold underline">{studentOtpPreview}</span>
                        </label>
                        <input
                          type="text"
                          value={studentOtpCode}
                          onChange={(e) => setStudentOtpCode(e.target.value)}
                          placeholder="6-digit OTP"
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                          Set Student Password (Optional, min 6 chars)
                        </label>
                        <input
                          type="text"
                          value={studentInitialPassword}
                          onChange={(e) => setStudentInitialPassword(e.target.value)}
                          placeholder="e.g., student123"
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900"
                        />
                      </div>
                    </div>
                    {studentWhatsappUrl && (
                      <div className="flex items-center justify-end">
                        <a
                          href={studentWhatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                        >
                          <span>Send OTP to Student on WhatsApp ({phone})</span>
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  placeholder="House No, Locality, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingStudent ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student 360 Detail Drawer/Modal (View Fees, Attendance, Results) */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{detailStudent.full_name}</h2>
                <p className="text-xs font-mono text-slate-500">
                  {detailStudent.admission_number} · Phone: {detailStudent.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailStudent(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const stAtt = attendance.filter((a) => a.student_id === detailStudent.id);
              const presentCnt = stAtt.filter((a) => a.status === 'Present' || a.status === 'Late').length;
              const attPct = stAtt.length > 0 ? Math.round((presentCnt / stAtt.length) * 100) : 0;
              const stFees = fees.filter((f) => f.student_id === detailStudent.id);
              const totalPaid = stFees.reduce((s, f) => s + Number(f.amount), 0);
              const stMarks = marks.filter((m) => m.student_id === detailStudent.id);

              return (
                <div className="mt-4 space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500 block">Attendance</span>
                      <span className="text-lg font-bold font-mono text-slate-900">{attPct}%</span>
                      <span className="text-[11px] text-slate-500 block">
                        {presentCnt}/{stAtt.length} days present
                      </span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500 block">Total Fee Paid</span>
                      <span className="text-lg font-bold font-mono text-emerald-700">
                        ₹{totalPaid.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[11px] text-slate-500 block">{stFees.length} receipts</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs text-slate-500 block">Tests Taken</span>
                      <span className="text-lg font-bold font-mono text-slate-900">{stMarks.length}</span>
                      <span className="text-[11px] text-slate-500 block">Recorded results</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p><strong>Father&apos;s Name:</strong> {detailStudent.father_name || '—'}</p>
                    <p><strong>Mother&apos;s Name:</strong> {detailStudent.mother_name || '—'}</p>
                    <p><strong>DOB / Gender:</strong> {detailStudent.date_of_birth || '—'} · {detailStudent.gender || '—'}</p>
                    <p><strong>Address:</strong> {detailStudent.address || '—'}</p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const s = detailStudent;
                        setDetailStudent(null);
                        setIdCardStudent(s);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Generate ID Card
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const s = detailStudent;
                        setDetailStudent(null);
                        setResultStudent(s);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      View Result Card
                    </button>
                    {onNavigateToFeeForStudent && (
                      <button
                        type="button"
                        onClick={() => {
                          const sId = detailStudent.id;
                          setDetailStudent(null);
                          onNavigateToFeeForStudent(sId);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                      >
                        Collect Fee / View Receipts
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Delete Student Record?</h3>
            <p className="text-xs text-slate-600 mt-2">
              Are you sure you want to permanently remove <strong>{confirmDeleteStudent.full_name}</strong> ({confirmDeleteStudent.admission_number})?
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteStudent(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700"
              >
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ID Card Modal */}
      {idCardStudent && institute && (
        <StudentIdCardModal
          student={idCardStudent}
          batch={batches.find((b) => b.id === idCardStudent.batch_id)}
          institute={institute}
          onClose={() => setIdCardStudent(null)}
        />
      )}

      {/* Result Card Modal */}
      {resultStudent && institute && (
        <ResultCardModal
          student={resultStudent}
          batch={batches.find((b) => b.id === resultStudent.batch_id)}
          institute={institute}
          tests={tests}
          marks={marks}
          onClose={() => setResultStudent(null)}
        />
      )}
    </div>
  );
};
