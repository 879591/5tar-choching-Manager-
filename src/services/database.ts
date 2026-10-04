import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import {
  Attendance,
  AuditLog,
  Batch,
  Fee,
  FeePlan,
  Institute,
  Mark,
  Notice,
  OperationType,
  Profile,
  Student,
  Subscription,
  Teacher,
  Test,
  UserRole,
} from '../types';

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${rand}`;
}

export async function logAuditAction(
  instituteId: string,
  action: string,
  recordType: string,
  recordId: string,
  userName?: string
): Promise<void> {
  if (!auth.currentUser) return;
  const logId = makeId('log');
  const logData: Omit<AuditLog, 'id'> = {
    institute_id: instituteId.slice(0, 128),
    user_id: auth.currentUser.uid,
    user_name: (userName || auth.currentUser.displayName || auth.currentUser.email || 'User').slice(0, 100),
    action: action.slice(0, 150),
    record_type: recordType.slice(0, 50),
    record_id: recordId.slice(0, 128),
    created_at: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'audit_logs', logId), logData);
  } catch (error) {
    console.warn('Non-fatal audit log error:', error);
  }
}

export function generateCoachingCode(name: string): string {
  const letters = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4)
    .padEnd(3, 'X');
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${letters}-${digits}`;
}

export async function createFirstInstituteForAdmin(params: {
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  primaryColor: string;
  instituteCode?: string;
  plan?: 'FREE' | 'BASIC' | 'PRO' | 'PREMIUM';
}): Promise<{ institute: Institute; profile: Profile }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to create an institute.');

  const instituteId = makeId('inst');
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const code = (params.instituteCode?.trim().toUpperCase() || generateCoachingCode(params.name)).slice(0, 30);

  const instituteData: Omit<Institute, 'id'> = {
    institute_code: code,
    name: params.name.trim().slice(0, 120),
    logo_url: '',
    address: params.address.trim().slice(0, 300),
    phone: params.phone.trim().slice(0, 30),
    email: (user.email || '').slice(0, 120),
    website: '',
    owner_name: params.ownerName.trim().slice(0, 100),
    owner_uid: user.uid,
    primary_color: (params.primaryColor || '#0f172a').slice(0, 20),
    status: 'Active',
    created_at: now,
  };

  const profileData: Omit<Profile, 'id'> = {
    auth_user_id: user.uid,
    institute_id: instituteId,
    full_name: params.ownerName.trim().slice(0, 100),
    phone: params.phone.trim().slice(0, 30),
    email: (user.email || '').slice(0, 120),
    role: UserRole.INSTITUTE_ADMIN,
    avatar_url: (user.photoURL || '').slice(0, 480000),
    status: 'Active',
    created_at: now,
  };

  const subId = makeId('sub');
  const subscriptionData: Omit<Subscription, 'id'> = {
    institute_id: instituteId,
    plan: params.plan || 'PRO',
    status: 'Active',
    start_date: today,
    expiry_date: nextYear,
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'institutes', instituteId), instituteData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `institutes/${instituteId}`);
  }

  try {
    await setDoc(doc(db, 'profiles', user.uid), profileData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `profiles/${user.uid}`);
  }

  try {
    await setDoc(doc(db, 'subscriptions', subId), subscriptionData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `subscriptions/${subId}`);
  }

  await logAuditAction(instituteId, `Created coaching institute: ${instituteData.name} (Code: ${code})`, 'institute', instituteId, profileData.full_name);

  return {
    institute: { id: instituteId, ...instituteData },
    profile: { id: user.uid, ...profileData },
  };
}

export async function linkStudentToInstituteByCode(params: {
  coachingCode: string;
  studentPhoneOrAdmission: string;
  photoDataUrl?: string;
}): Promise<{ institute: Institute; student: Student; profile: Profile }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in to link student profile.');

  const cleanCode = params.coachingCode.trim().toUpperCase();
  const cleanIdent = params.studentPhoneOrAdmission.trim().toLowerCase();

  // 1. Find active institute matching coachingCode (or id prefix)
  const instSnap = await getDocs(
    query(collection(db, 'institutes'), where('status', '==', 'Active'))
  );

  const matchedInstDoc = instSnap.docs.find((d) => {
    const data = d.data() as Omit<Institute, 'id'>;
    return (
      (data.institute_code || '').toUpperCase() === cleanCode ||
      d.id.toUpperCase() === cleanCode
    );
  });

  if (!matchedInstDoc) {
    throw new Error(`कोचिंग कोड "${cleanCode}" नहीं मिला। कृपया अपने कोचिंग सर से सही Coaching Code पूछें।`);
  }

  const institute: Institute = {
    id: matchedInstDoc.id,
    ...(matchedInstDoc.data() as Omit<Institute, 'id'>),
  };

  // 2. Find student in this institute by phone or admission_number
  const studSnap = await getDocs(
    query(
      collection(db, 'students'),
      where('institute_id', '==', institute.id),
      where('status', '==', 'Active')
    )
  );

  const matchedStudentDoc = studSnap.docs.find((d) => {
    const s = d.data() as Omit<Student, 'id'>;
    const normPhone = s.phone.replace(/\D/g, '').slice(-10);
    const inputDigits = cleanIdent.replace(/\D/g, '').slice(-10);
    return (
      (normPhone && inputDigits && normPhone === inputDigits) ||
      s.admission_number.toLowerCase() === cleanIdent ||
      (s.email && s.email.toLowerCase() === cleanIdent)
    );
  });

  if (!matchedStudentDoc) {
    throw new Error(
      `कोचिंग "${institute.name}" में मोबाइल/एडमिशन नंबर "${params.studentPhoneOrAdmission}" से कोई छात्र नहीं मिला। पहले कोचिंग एडमिन से अपना नाम और मोबाइल नंबर जुड़वाएं।`
    );
  }

  const studentData = matchedStudentDoc.data() as Omit<Student, 'id'>;
  const student: Student = { id: matchedStudentDoc.id, ...studentData };

  const now = new Date().toISOString();
  const finalPhoto = params.photoDataUrl ? params.photoDataUrl.slice(0, 480000) : (student.photo_url || '');

  const profileData: Omit<Profile, 'id'> = {
    auth_user_id: user.uid,
    institute_id: institute.id,
    full_name: student.full_name,
    phone: student.phone,
    email: (user.email || student.email || `${student.phone}@student.5tar.app`).slice(0, 120),
    role: UserRole.STUDENT,
    avatar_url: finalPhoto,
    status: 'Active',
    linked_student_id: student.id,
    created_at: now,
  };

  await setDoc(doc(db, 'profiles', user.uid), profileData);

  if (params.photoDataUrl) {
    await updateDoc(doc(db, 'students', student.id), {
      photo_url: finalPhoto,
    });
  }

  return {
    institute,
    student: { ...student, photo_url: finalPhoto },
    profile: { id: user.uid, ...profileData },
  };
}

export async function updateInstituteSettings(
  instituteId: string,
  updates: Partial<Pick<Institute, 'institute_code' | 'name' | 'logo_url' | 'address' | 'phone' | 'email' | 'website' | 'owner_name' | 'primary_color'>>
): Promise<void> {
  const cleanUpdates: Record<string, unknown> = {};
  if (updates.institute_code !== undefined) cleanUpdates.institute_code = updates.institute_code.trim().toUpperCase().slice(0, 30);
  if (updates.name !== undefined) cleanUpdates.name = updates.name.trim().slice(0, 120);
  if (updates.logo_url !== undefined) cleanUpdates.logo_url = updates.logo_url.trim().slice(0, 480000);
  if (updates.address !== undefined) cleanUpdates.address = updates.address.trim().slice(0, 300);
  if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim().slice(0, 30);
  if (updates.email !== undefined) cleanUpdates.email = updates.email.trim().slice(0, 120);
  if (updates.website !== undefined) cleanUpdates.website = updates.website.trim().slice(0, 200);
  if (updates.owner_name !== undefined) cleanUpdates.owner_name = updates.owner_name.trim().slice(0, 100);
  if (updates.primary_color !== undefined) cleanUpdates.primary_color = updates.primary_color.trim().slice(0, 20);

  try {
    await updateDoc(doc(db, 'institutes', instituteId), cleanUpdates);
    await logAuditAction(instituteId, 'Updated institute branding & settings', 'institute', instituteId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `institutes/${instituteId}`);
  }
}

export async function createTeacherRecord(
  instituteId: string,
  data: Omit<Teacher, 'id' | 'institute_id' | 'created_at'>
): Promise<Teacher> {
  const id = makeId('tch');
  const now = new Date().toISOString();
  const payload: Omit<Teacher, 'id'> = {
    institute_id: instituteId,
    name: data.name.trim().slice(0, 100),
    phone: data.phone.trim().slice(0, 30),
    email: data.email.trim().slice(0, 120),
    qualification: (data.qualification || '').trim().slice(0, 120),
    subject: data.subject.trim().slice(0, 100),
    photo_url: (data.photo_url || '').trim().slice(0, 500),
    status: data.status || 'Active',
    created_at: now,
  };
  try {
    await setDoc(doc(db, 'teachers', id), payload);
    await logAuditAction(instituteId, `Added teacher: ${payload.name} (${payload.subject})`, 'teacher', id);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teachers/${id}`);
  }
}

export async function updateTeacherRecord(
  instituteId: string,
  teacherId: string,
  updates: Partial<Omit<Teacher, 'id' | 'institute_id' | 'created_at'>>
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (updates.name !== undefined) clean.name = updates.name.trim().slice(0, 100);
  if (updates.phone !== undefined) clean.phone = updates.phone.trim().slice(0, 30);
  if (updates.email !== undefined) clean.email = updates.email.trim().slice(0, 120);
  if (updates.qualification !== undefined) clean.qualification = updates.qualification.trim().slice(0, 120);
  if (updates.subject !== undefined) clean.subject = updates.subject.trim().slice(0, 100);
  if (updates.photo_url !== undefined) clean.photo_url = updates.photo_url.trim().slice(0, 500);
  if (updates.status !== undefined) clean.status = updates.status;

  try {
    await updateDoc(doc(db, 'teachers', teacherId), clean);
    await logAuditAction(instituteId, `Updated teacher record: ${updates.name || teacherId}`, 'teacher', teacherId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `teachers/${teacherId}`);
  }
}

export async function createBatchRecord(
  instituteId: string,
  data: Omit<Batch, 'id' | 'institute_id' | 'created_at'>,
  feePlanData?: { total_fee: number; installment_amount: number; due_date?: string }
): Promise<Batch> {
  const id = makeId('bch');
  const now = new Date().toISOString();
  const payload: Omit<Batch, 'id'> = {
    institute_id: instituteId,
    name: data.name.trim().slice(0, 100),
    course: data.course.trim().slice(0, 100),
    subject: data.subject.trim().slice(0, 100),
    teacher_id: (data.teacher_id || '').slice(0, 128),
    start_date: (data.start_date || now.split('T')[0]).slice(0, 20),
    timing: data.timing.trim().slice(0, 80),
    room: (data.room || '').trim().slice(0, 50),
    status: data.status || 'Active',
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'batches', id), payload);
    if (feePlanData && feePlanData.total_fee >= 0) {
      const fpId = `fp_${id}`;
      const fpPayload: Omit<FeePlan, 'id'> = {
        institute_id: instituteId,
        batch_id: id,
        total_fee: Number(feePlanData.total_fee),
        installment_amount: Number(feePlanData.installment_amount || feePlanData.total_fee),
        due_date: (feePlanData.due_date || '').slice(0, 20),
        created_at: now,
      };
      await setDoc(doc(db, 'fee_plans', fpId), fpPayload);
    }
    await logAuditAction(instituteId, `Created batch: ${payload.name}`, 'batch', id);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `batches/${id}`);
  }
}

export async function updateBatchRecord(
  instituteId: string,
  batchId: string,
  updates: Partial<Omit<Batch, 'id' | 'institute_id' | 'created_at'>>
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (updates.name !== undefined) clean.name = updates.name.trim().slice(0, 100);
  if (updates.course !== undefined) clean.course = updates.course.trim().slice(0, 100);
  if (updates.subject !== undefined) clean.subject = updates.subject.trim().slice(0, 100);
  if (updates.teacher_id !== undefined) clean.teacher_id = updates.teacher_id.slice(0, 128);
  if (updates.start_date !== undefined) clean.start_date = updates.start_date.slice(0, 20);
  if (updates.timing !== undefined) clean.timing = updates.timing.trim().slice(0, 80);
  if (updates.room !== undefined) clean.room = updates.room.trim().slice(0, 50);
  if (updates.status !== undefined) clean.status = updates.status;

  try {
    await updateDoc(doc(db, 'batches', batchId), clean);
    await logAuditAction(instituteId, `Updated batch: ${updates.name || batchId}`, 'batch', batchId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `batches/${batchId}`);
  }
}

export async function createStudentRecord(
  instituteId: string,
  data: Omit<Student, 'id' | 'institute_id' | 'created_at'>
): Promise<Student> {
  const id = makeId('std');
  const now = new Date().toISOString();
  const payload: Omit<Student, 'id'> = {
    institute_id: instituteId,
    admission_number: data.admission_number.trim().slice(0, 50),
    full_name: data.full_name.trim().slice(0, 100),
    father_name: (data.father_name || '').trim().slice(0, 100),
    mother_name: (data.mother_name || '').trim().slice(0, 100),
    phone: data.phone.trim().slice(0, 30),
    email: (data.email || '').trim().slice(0, 120),
    date_of_birth: (data.date_of_birth || '').slice(0, 20),
    gender: data.gender || 'Male',
    address: (data.address || '').trim().slice(0, 300),
    photo_url: (data.photo_url || '').trim().slice(0, 480000),
    admission_date: (data.admission_date || now.split('T')[0]).slice(0, 20),
    batch_id: data.batch_id.slice(0, 128),
    status: data.status || 'Active',
    created_at: now,
  };
  try {
    await setDoc(doc(db, 'students', id), payload);
    await logAuditAction(instituteId, `Enrolled student: ${payload.full_name} (${payload.admission_number})`, 'student', id);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `students/${id}`);
  }
}

export async function updateStudentRecord(
  instituteId: string,
  studentId: string,
  updates: Partial<Omit<Student, 'id' | 'institute_id' | 'created_at'>>
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (updates.admission_number !== undefined) clean.admission_number = updates.admission_number.trim().slice(0, 50);
  if (updates.full_name !== undefined) clean.full_name = updates.full_name.trim().slice(0, 100);
  if (updates.father_name !== undefined) clean.father_name = updates.father_name.trim().slice(0, 100);
  if (updates.mother_name !== undefined) clean.mother_name = updates.mother_name.trim().slice(0, 100);
  if (updates.phone !== undefined) clean.phone = updates.phone.trim().slice(0, 30);
  if (updates.email !== undefined) clean.email = updates.email.trim().slice(0, 120);
  if (updates.date_of_birth !== undefined) clean.date_of_birth = updates.date_of_birth.slice(0, 20);
  if (updates.gender !== undefined) clean.gender = updates.gender;
  if (updates.address !== undefined) clean.address = updates.address.trim().slice(0, 300);
  if (updates.photo_url !== undefined) clean.photo_url = updates.photo_url.trim().slice(0, 480000);
  if (updates.admission_date !== undefined) clean.admission_date = updates.admission_date.slice(0, 20);
  if (updates.batch_id !== undefined) clean.batch_id = updates.batch_id.slice(0, 128);
  if (updates.status !== undefined) clean.status = updates.status;

  try {
    await updateDoc(doc(db, 'students', studentId), clean);
    await logAuditAction(instituteId, `Updated student: ${updates.full_name || studentId}`, 'student', studentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
  }
}

export async function deleteStudentRecord(instituteId: string, studentId: string, studentName: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', studentId));
    await logAuditAction(instituteId, `Deleted student: ${studentName}`, 'student', studentId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
  }
}

export async function saveBatchAttendance(
  instituteId: string,
  batchId: string,
  attendanceDate: string,
  records: { student_id: string; status: Attendance['status']; existingRecord?: Attendance }[],
  markedByName: string
): Promise<void> {
  const now = new Date().toISOString();
  const safeDate = attendanceDate.replace(/[^a-zA-Z0-9_-]/g, '-');

  for (const item of records) {
    // Deterministic ID prevents duplicate attendance records for the same student, batch, and date
    const docId = `att_${batchId}_${item.student_id}_${safeDate}`.slice(0, 120);
    const ref = doc(db, 'attendance', docId);
    try {
      if (item.existingRecord) {
        await updateDoc(ref, {
          status: item.status,
          marked_by: markedByName.slice(0, 128),
        });
      } else {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, {
            status: item.status,
            marked_by: markedByName.slice(0, 128),
          });
        } else {
          const payload: Omit<Attendance, 'id'> = {
            institute_id: instituteId,
            student_id: item.student_id,
            batch_id: batchId,
            attendance_date: attendanceDate.slice(0, 20),
            status: item.status,
            marked_by: markedByName.slice(0, 128),
            created_at: now,
          };
          await setDoc(ref, payload);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `attendance/${docId}`);
    }
  }

  await logAuditAction(
    instituteId,
    `Submitted attendance for batch ${batchId} on ${attendanceDate} (${records.length} students)`,
    'attendance',
    `${batchId}_${safeDate}`,
    markedByName
  );
}

export async function createFeePayment(
  instituteId: string,
  data: Omit<Fee, 'id' | 'institute_id' | 'created_at'>
): Promise<Fee> {
  const id = makeId('fee');
  const now = new Date().toISOString();
  const payload: Omit<Fee, 'id'> = {
    institute_id: instituteId,
    student_id: data.student_id.slice(0, 128),
    amount: Number(data.amount),
    payment_date: data.payment_date.slice(0, 20),
    payment_method: data.payment_method,
    receipt_number: data.receipt_number.trim().slice(0, 50),
    month: data.month.trim().slice(0, 50),
    remarks: (data.remarks || '').trim().slice(0, 250),
    collected_by: data.collected_by.trim().slice(0, 128),
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'fees', id), payload);
    await logAuditAction(
      instituteId,
      `Recorded fee payment ${payload.receipt_number} of ₹${payload.amount}`,
      'fee',
      id,
      payload.collected_by
    );
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `fees/${id}`);
  }
}

export async function upsertFeePlan(
  instituteId: string,
  batchId: string,
  totalFee: number,
  installmentAmount: number,
  dueDate: string
): Promise<void> {
  const docId = `fp_${batchId}`.slice(0, 120);
  const ref = doc(db, 'fee_plans', docId);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        total_fee: Number(totalFee),
        installment_amount: Number(installmentAmount),
        due_date: dueDate.slice(0, 20),
      });
    } else {
      const payload: Omit<FeePlan, 'id'> = {
        institute_id: instituteId,
        batch_id: batchId,
        total_fee: Number(totalFee),
        installment_amount: Number(installmentAmount),
        due_date: dueDate.slice(0, 20),
        created_at: now,
      };
      await setDoc(ref, payload);
    }
    await logAuditAction(instituteId, `Updated fee plan for batch ${batchId}: ₹${totalFee}`, 'fee_plan', docId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `fee_plans/${docId}`);
  }
}

export async function createTestRecord(
  instituteId: string,
  data: Omit<Test, 'id' | 'institute_id' | 'created_at'>
): Promise<Test> {
  const id = makeId('tst');
  const now = new Date().toISOString();
  const payload: Omit<Test, 'id'> = {
    institute_id: instituteId,
    batch_id: data.batch_id.slice(0, 128),
    title: data.title.trim().slice(0, 120),
    subject: data.subject.trim().slice(0, 100),
    test_date: data.test_date.slice(0, 20),
    total_marks: Number(data.total_marks),
    passing_marks: Number(data.passing_marks),
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'tests', id), payload);
    await logAuditAction(instituteId, `Created test: ${payload.title} (${payload.subject})`, 'test', id);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tests/${id}`);
  }
}

export async function saveTestMarks(
  instituteId: string,
  testId: string,
  entries: { student_id: string; marks: number; remarks: string }[]
): Promise<void> {
  const now = new Date().toISOString();
  for (const entry of entries) {
    const docId = `mrk_${testId}_${entry.student_id}`.slice(0, 120);
    const ref = doc(db, 'marks', docId);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, {
          marks: Number(entry.marks),
          remarks: (entry.remarks || '').trim().slice(0, 250),
        });
      } else {
        const payload: Omit<Mark, 'id'> = {
          institute_id: instituteId,
          test_id: testId,
          student_id: entry.student_id,
          marks: Number(entry.marks),
          remarks: (entry.remarks || '').trim().slice(0, 250),
          created_at: now,
        };
        await setDoc(ref, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `marks/${docId}`);
    }
  }
  await logAuditAction(instituteId, `Updated marks for test ${testId} (${entries.length} students)`, 'marks', testId);
}

export async function createNoticeRecord(
  instituteId: string,
  data: Omit<Notice, 'id' | 'institute_id' | 'created_at'>
): Promise<Notice> {
  const id = makeId('ntc');
  const now = new Date().toISOString();
  const payload: Omit<Notice, 'id'> = {
    institute_id: instituteId,
    title: data.title.trim().slice(0, 150),
    message: data.message.trim().slice(0, 1500),
    target_role: data.target_role,
    publish_date: data.publish_date.slice(0, 20),
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'notices', id), payload);
    await logAuditAction(instituteId, `Published notice: ${payload.title} (${payload.target_role})`, 'notice', id);
    return { id, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notices/${id}`);
  }
}

export async function deleteNoticeRecord(instituteId: string, noticeId: string, title: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'notices', noticeId));
    await logAuditAction(instituteId, `Deleted notice: ${title}`, 'notice', noticeId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notices/${noticeId}`);
  }
}

export async function seedSampleCoachingData(instituteId: string, adminName: string): Promise<void> {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Create 2 Sample Teachers
  const t1 = await createTeacherRecord(instituteId, {
    name: 'Dr. राजेश शर्मा (Rajesh Sharma)',
    phone: '9876543210',
    email: 'rajesh.physics@5tar.in',
    qualification: 'M.Sc, Ph.D (Physics)',
    subject: 'Physics',
    photo_url: '',
    status: 'Active',
  });

  const t2 = await createTeacherRecord(instituteId, {
    name: 'Prof. नेहा वर्मा (Neha Verma)',
    phone: '9876543211',
    email: 'neha.maths@5tar.in',
    qualification: 'M.Tech (IIT Delhi)',
    subject: 'Mathematics',
    photo_url: '',
    status: 'Active',
  });

  // Create 2 Sample Batches with Fee Plans
  const b1 = await createBatchRecord(
    instituteId,
    {
      name: 'Sankalp JEE Target 2027',
      course: 'IIT-JEE Mains & Advanced',
      subject: 'Physics & Mathematics',
      teacher_id: t1.id,
      start_date: today,
      timing: '08:00 AM - 11:00 AM',
      room: 'Hall A-101',
      status: 'Active',
    },
    { total_fee: 45000, installment_amount: 15000, due_date: '10th of Month' }
  );

  const b2 = await createBatchRecord(
    instituteId,
    {
      name: 'Lakshya Class 12 Board',
      course: 'CBSE Class 12 Science',
      subject: 'Mathematics',
      teacher_id: t2.id,
      start_date: today,
      timing: '04:00 PM - 06:00 PM',
      room: 'Room B-204',
      status: 'Active',
    },
    { total_fee: 24000, installment_amount: 8000, due_date: '5th of Month' }
  );

  // Create 4 Sample Students
  const s1 = await createStudentRecord(instituteId, {
    admission_number: 'ADM-2026-001',
    full_name: 'Aarav Gupta',
    father_name: 'Suresh Gupta',
    mother_name: 'Sunita Gupta',
    phone: '9811122233',
    email: 'aarav.gupta@student.in',
    date_of_birth: '2009-05-14',
    gender: 'Male',
    address: 'Sector 14, Civil Lines, Kanpur',
    photo_url: '',
    admission_date: today,
    batch_id: b1.id,
    status: 'Active',
  });

  const s2 = await createStudentRecord(instituteId, {
    admission_number: 'ADM-2026-002',
    full_name: 'Priya Patel',
    father_name: 'Mahesh Patel',
    mother_name: 'Kavita Patel',
    phone: '9822233344',
    email: 'priya.patel@student.in',
    date_of_birth: '2009-08-22',
    gender: 'Female',
    address: 'Model Town, Near Metro Station, Jaipur',
    photo_url: '',
    admission_date: today,
    batch_id: b1.id,
    status: 'Active',
  });

  const s3 = await createStudentRecord(instituteId, {
    admission_number: 'ADM-2026-003',
    full_name: 'Rohan Yadav',
    father_name: 'Dinesh Yadav',
    mother_name: 'Meena Yadav',
    phone: '9833344455',
    email: 'rohan.yadav@student.in',
    date_of_birth: '2009-11-03',
    gender: 'Male',
    address: 'Gomti Nagar, Phase 2, Lucknow',
    photo_url: '',
    admission_date: today,
    batch_id: b2.id,
    status: 'Active',
  });

  // Mark Today's Attendance for Batch 1
  await saveBatchAttendance(
    instituteId,
    b1.id,
    today,
    [
      { student_id: s1.id, status: 'Present' },
      { student_id: s2.id, status: 'Present' },
    ],
    adminName
  );

  // Record Sample Fee Receipts
  await createFeePayment(instituteId, {
    student_id: s1.id,
    amount: 15000,
    payment_date: today,
    payment_method: 'UPI',
    receipt_number: 'REC-2026-00001',
    month: 'Installment 1 (Oct 2026)',
    remarks: 'First installment paid via UPI',
    collected_by: adminName,
  });

  await createFeePayment(instituteId, {
    student_id: s3.id,
    amount: 8000,
    payment_date: today,
    payment_method: 'Cash',
    receipt_number: 'REC-2026-00002',
    month: 'Installment 1 (Oct 2026)',
    remarks: 'Paid at counter',
    collected_by: adminName,
  });

  // Create Sample Test & Marks
  const test1 = await createTestRecord(instituteId, {
    batch_id: b1.id,
    title: 'Unit Test 1 — Kinematics & Vectors',
    subject: 'Physics',
    test_date: today,
    total_marks: 100,
    passing_marks: 35,
  });

  await saveTestMarks(instituteId, test1.id, [
    { student_id: s1.id, marks: 88, remarks: 'Excellent conceptual clarity' },
    { student_id: s2.id, marks: 92, remarks: 'Batch Topper — Keep it up!' },
  ]);

  // Create Sample Notice
  await createNoticeRecord(instituteId, {
    title: 'Sunday Special Doubt Clearing Session',
    message: 'All students of Sankalp JEE Target 2027 batch are informed that a special Physics & Calculus doubt-solving session will be held this Sunday from 09:00 AM to 12:00 PM in Hall A-101.',
    target_role: 'Everyone',
    publish_date: today,
  });
}
