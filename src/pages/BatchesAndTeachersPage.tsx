import React, { useState } from 'react';
import { BookOpen, Edit2, Plus, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createBatchRecord,
  createTeacherRecord,
  updateBatchRecord,
  updateTeacherRecord,
  upsertFeePlan,
} from '../services/database';
import { Batch, Teacher } from '../types';

export const BatchesPage: React.FC = () => {
  const { institute, batches, teachers, students, feePlans } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [viewStudentsBatch, setViewStudentsBatch] = useState<Batch | null>(null);

  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [timing, setTiming] = useState('');
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [totalFee, setTotalFee] = useState('30000');
  const [installmentAmount, setInstallmentAmount] = useState('10000');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openNew = () => {
    setEditingBatch(null);
    setName('');
    setCourse('');
    setSubject('');
    setTeacherId(teachers[0]?.id || '');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTiming('08:00 AM - 10:00 AM');
    setRoom('Room 101');
    setStatus('Active');
    setTotalFee('30000');
    setInstallmentAmount('10000');
    setShowModal(true);
  };

  const openEdit = (b: Batch) => {
    const plan = feePlans.find((fp) => fp.batch_id === b.id);
    setEditingBatch(b);
    setName(b.name);
    setCourse(b.course);
    setSubject(b.subject);
    setTeacherId(b.teacher_id || '');
    setStartDate(b.start_date || '');
    setTiming(b.timing);
    setRoom(b.room || '');
    setStatus(b.status);
    setTotalFee(plan ? String(plan.total_fee) : '30000');
    setInstallmentAmount(plan ? String(plan.installment_amount) : '10000');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute) return;
    if (!name.trim() || !course.trim() || !subject.trim() || !timing.trim()) {
      setErrorMsg('कृपया बैच का नाम, कोर्स, विषय और समय भरें।');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      if (editingBatch) {
        await updateBatchRecord(institute.id, editingBatch.id, {
          name,
          course,
          subject,
          teacher_id: teacherId,
          start_date: startDate,
          timing,
          room,
          status,
        });
        await upsertFeePlan(institute.id, editingBatch.id, Number(totalFee) || 0, Number(installmentAmount) || 0, '10th of Month');
      } else {
        await createBatchRecord(
          institute.id,
          {
            name,
            course,
            subject,
            teacher_id: teacherId,
            start_date: startDate,
            timing,
            room,
            status,
          },
          {
            total_fee: Number(totalFee) || 0,
            installment_amount: Number(installmentAmount) || 0,
            due_date: '10th of Month',
          }
        );
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Batch save नहीं हो सका। कृपया दोबारा कोशिश करें।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Batch Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create batches, assign faculty, set timings, classrooms, and course fee plans
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Batch</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No Batches Created Yet</p>
            <p className="text-xs text-slate-500 mt-1">Click &quot;Create New Batch&quot; to organize your classes.</p>
          </div>
        ) : (
          batches.map((b) => {
            const teacher = teachers.find((t) => t.id === b.teacher_id);
            const batchStudents = students.filter((s) => s.batch_id === b.id);
            const feePlan = feePlans.find((fp) => fp.batch_id === b.id);

            return (
              <div
                key={b.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{b.course}</span>
                    <span className={b.status === 'Active' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {b.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{b.name}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Subject: {b.subject}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Teacher:</span>
                      <span className="font-medium text-slate-900">{teacher?.name || 'Not Assigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Timing:</span>
                      <span className="font-mono text-slate-800">{b.timing}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Room:</span>
                      <span className="font-medium text-slate-800">{b.room || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Course Fee:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {feePlan ? `₹${Number(feePlan.total_fee).toLocaleString('en-IN')}` : 'Not set'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewStudentsBatch(b)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:underline cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono">{batchStudents.length}</span>
                    <span>Students</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(b)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Batch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingBatch ? 'Edit Batch' : 'Create Academic Batch'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sankalp JEE Target 2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Course *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., IIT-JEE / NEET / Class 12"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subjects *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Physics, Chemistry, Maths"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Teacher</label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subject})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class Timing *</label>
                  <input
                    type="text"
                    required
                    placeholder="08:00 AM - 10:30 AM"
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Hall</label>
                  <input
                    type="text"
                    placeholder="Hall A-101"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Batch Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={totalFee}
                    onChange={(e) => setTotalFee(e.target.value)}
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
              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white"
                >
                  {saving ? 'Saving...' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Students in Batch Modal */}
      {viewStudentsBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">{viewStudentsBatch.name} — Enrolled Students</h3>
                <p className="text-xs text-slate-500">{viewStudentsBatch.timing} · {viewStudentsBatch.room}</p>
              </div>
              <button type="button" onClick={() => setViewStudentsBatch(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {students
                .filter((s) => s.batch_id === viewStudentsBatch.id)
                .map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{s.full_name}</p>
                      <p className="font-mono text-slate-500">{s.admission_number}</p>
                    </div>
                    <span className="font-mono text-slate-700">{s.phone}</span>
                  </div>
                ))}
              {students.filter((s) => s.batch_id === viewStudentsBatch.id).length === 0 && (
                <p className="text-xs text-slate-500 py-6 text-center">No students assigned to this batch yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TeachersPage: React.FC = () => {
  const { institute, teachers, batches } = useApp();

  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [qualification, setQualification] = useState('');
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingTeacher(null);
    setName('');
    setPhone('');
    setEmail('');
    setQualification('');
    setSubject('');
    setStatus('Active');
    setShowModal(true);
  };

  const openEdit = (t: Teacher) => {
    setEditingTeacher(t);
    setName(t.name);
    setPhone(t.phone);
    setEmail(t.email);
    setQualification(t.qualification || '');
    setSubject(t.subject);
    setStatus(t.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institute || !name.trim() || !phone.trim() || !subject.trim()) return;
    setSaving(true);
    try {
      if (editingTeacher) {
        await updateTeacherRecord(institute.id, editingTeacher.id, {
          name,
          phone,
          email,
          qualification,
          subject,
          status,
        });
      } else {
        await createTeacherRecord(institute.id, {
          name,
          phone,
          email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@coaching.in`,
          qualification,
          subject,
          photo_url: '',
          status,
        });
      }
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Teacher &amp; Faculty Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add teachers, assign subjects and batches, and manage active status
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add Teacher</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teachers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
            No teachers added yet. Click &quot;Add Teacher&quot; to register faculty members.
          </div>
        ) : (
          teachers.map((t) => {
            const assignedBatches = batches.filter((b) => b.teacher_id === t.id);
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-700">{t.subject}</span>
                    <span className={t.status === 'Active' ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {t.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">{t.name}</h3>
                  <p className="text-xs text-slate-500">{t.qualification || 'Faculty Member'}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Phone:</span>
                      <span className="font-mono text-slate-800">{t.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-slate-800 truncate max-w-[180px]">{t.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Assigned Batches:</span>
                      <span className="font-mono font-semibold text-slate-900">{assignedBatches.length}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit / Status</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                {editingTeacher ? 'Edit Teacher' : 'Add Faculty Member'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Rajesh Sharma"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Physics"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="M.Sc, B.Ed"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@coaching.in"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white"
                >
                  {saving ? 'Saving...' : 'Save Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
