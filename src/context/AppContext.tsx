import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  CustomAuthSessionUser,
  db,
  getStoredCustomAuthUser,
  googleAuthProvider,
  handleFirestoreError,
  setStoredCustomAuthUser,
} from '../lib/firebase';
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

interface AppContextType {
  user: (User | CustomAuthSessionUser) | null;
  profile: Profile | null;
  institute: Institute | null;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  selectedTeacherId: string;
  setSelectedTeacherId: (id: string) => void;
  authLoading: boolean;
  dataLoading: boolean;
  students: Student[];
  teachers: Teacher[];
  batches: Batch[];
  attendance: Attendance[];
  fees: Fee[];
  feePlans: FeePlan[];
  tests: Test[];
  marks: Mark[];
  notices: Notice[];
  subscription: Subscription | null;
  auditLogs: AuditLog[];
  allInstitutes: Institute[];
  allSubscriptions: Subscription[];
  signInWithGoogle: () => Promise<void>;
  setCustomSessionUser: (sessionUser: CustomAuthSessionUser | null) => void;
  logout: () => Promise<void>;
  switchInstitute: (instituteId: string) => Promise<void>;
  isSuperAdminUser: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(User | CustomAuthSessionUser) | null>(() => getStoredCustomAuthUser());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.INSTITUTE_ADMIN);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allInstitutes, setAllInstitutes] = useState<Institute[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<Subscription[]>([]);

  const isSuperAdminUser = Boolean(
    user?.email === 'miss359010@gmail.com' || profile?.role === UserRole.SUPER_ADMIN
  );

  // 1. Auth State Listener (Supports both Firebase Auth and Custom OTP Session)
  useEffect(() => {
    const syncAuth = () => {
      if (auth.currentUser) {
        setUser(auth.currentUser);
      } else {
        const customUser = getStoredCustomAuthUser();
        setUser(customUser);
        if (!customUser) {
          setProfile(null);
          setInstitute(null);
          setAuthLoading(false);
        }
      }
    };

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        const customUser = getStoredCustomAuthUser();
        setUser(customUser);
        if (!customUser) {
          setProfile(null);
          setInstitute(null);
          setAuthLoading(false);
        }
      }
    });

    window.addEventListener('5tar-auth-changed', syncAuth);
    return () => {
      unsub();
      window.removeEventListener('5tar-auth-changed', syncAuth);
    };
  }, []);

  // 2. Profile Listener
  useEffect(() => {
    if (!user) return;
    setAuthLoading(true);
    const profileRef = doc(db, 'profiles', user.uid);
    const unsub = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Profile, 'id'>;
          const prof: Profile = { id: snap.id, ...data };
          setProfile(prof);
          setActiveRole(prof.role);
          if (prof.linked_student_id) {
            setSelectedStudentId(prof.linked_student_id);
          }
          if (prof.linked_teacher_id) {
            setSelectedTeacherId(prof.linked_teacher_id);
          }
        } else {
          setProfile(null);
        }
        setAuthLoading(false);
      },
      (error) => {
        setAuthLoading(false);
        handleFirestoreError(error, OperationType.GET, `profiles/${user.uid}`);
      }
    );
    return () => unsub();
  }, [user]);

  // 3. Tenant Data Listeners (Strictly isolated by profile.institute_id)
  useEffect(() => {
    if (!user || !profile?.institute_id) {
      setInstitute(null);
      setStudents([]);
      setTeachers([]);
      setBatches([]);
      setAttendance([]);
      setFees([]);
      setFeePlans([]);
      setTests([]);
      setMarks([]);
      setNotices([]);
      setSubscription(null);
      setAuditLogs([]);
      return;
    }

    const instId = profile.institute_id;
    setDataLoading(true);

    const unsubs: (() => void)[] = [];

    // Institute Document
    unsubs.push(
      onSnapshot(
        doc(db, 'institutes', instId),
        (snap) => {
          if (snap.exists()) {
            setInstitute({ id: snap.id, ...(snap.data() as Omit<Institute, 'id'>) });
          } else {
            setInstitute(null);
          }
          setDataLoading(false);
        },
        (err) => handleFirestoreError(err, OperationType.GET, `institutes/${instId}`)
      )
    );

    // Students
    unsubs.push(
      onSnapshot(
        query(collection(db, 'students'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) {
            setSelectedStudentId(list[0].id);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'students')
      )
    );

    // Teachers
    unsubs.push(
      onSnapshot(
        query(collection(db, 'teachers'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Teacher, 'id'>) }))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          setTeachers(list);
          if (list.length > 0 && !selectedTeacherId) {
            setSelectedTeacherId(list[0].id);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'teachers')
      )
    );

    // Batches
    unsubs.push(
      onSnapshot(
        query(collection(db, 'batches'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Batch, 'id'>) }))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          setBatches(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'batches')
      )
    );

    // Attendance
    unsubs.push(
      onSnapshot(
        query(collection(db, 'attendance'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attendance, 'id'>) }));
          setAttendance(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
      )
    );

    // Fees
    unsubs.push(
      onSnapshot(
        query(collection(db, 'fees'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Fee, 'id'>) }))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          setFees(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'fees')
      )
    );

    // Fee Plans
    unsubs.push(
      onSnapshot(
        query(collection(db, 'fee_plans'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeePlan, 'id'>) }));
          setFeePlans(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'fee_plans')
      )
    );

    // Tests
    unsubs.push(
      onSnapshot(
        query(collection(db, 'tests'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Test, 'id'>) }))
            .sort((a, b) => b.test_date.localeCompare(a.test_date));
          setTests(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'tests')
      )
    );

    // Marks
    unsubs.push(
      onSnapshot(
        query(collection(db, 'marks'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mark, 'id'>) }));
          setMarks(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'marks')
      )
    );

    // Notices
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notices'), where('institute_id', '==', instId)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Notice, 'id'>) }))
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
          setNotices(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notices')
      )
    );

    // Subscriptions
    unsubs.push(
      onSnapshot(
        query(collection(db, 'subscriptions'), where('institute_id', '==', instId)),
        (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0];
            setSubscription({ id: d.id, ...(d.data() as Omit<Subscription, 'id'>) });
          } else {
            setSubscription(null);
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
      )
    );

    // Audit Logs (Admin or Super Admin)
    if (profile.role === UserRole.INSTITUTE_ADMIN || profile.role === UserRole.SUPER_ADMIN || isSuperAdminUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'audit_logs'), where('institute_id', '==', instId)),
          (snap) => {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            setAuditLogs(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, profile?.institute_id, profile?.role, isSuperAdminUser]);

  // 4. Super Admin Platform-Wide Listeners
  useEffect(() => {
    if (!user || !isSuperAdminUser) {
      setAllInstitutes([]);
      setAllSubscriptions([]);
      return;
    }

    const unsubInst = onSnapshot(
      collection(db, 'institutes'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Institute, 'id'>) }))
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        setAllInstitutes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'institutes')
    );

    const unsubSubs = onSnapshot(
      collection(db, 'subscriptions'),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subscription, 'id'>) }));
        setAllSubscriptions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions')
    );

    return () => {
      unsubInst();
      unsubSubs();
    };
  }, [user, isSuperAdminUser]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      throw err;
    }
  };

  const setCustomSessionUser = (sessionUser: CustomAuthSessionUser | null) => {
    setStoredCustomAuthUser(sessionUser);
    setUser(sessionUser);
  };

  const logout = async () => {
    setStoredCustomAuthUser(null);
    setUser(null);
    setProfile(null);
    setInstitute(null);
    try {
      await signOut(auth);
    } catch {
      // ignore if not signed into firebase auth
    }
  };

  const switchInstitute = async (targetInstituteId: string) => {
    if (!user || !profile) return;
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        institute_id: targetInstituteId,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `profiles/${user.uid}`);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        institute,
        activeRole,
        setActiveRole,
        selectedStudentId,
        setSelectedStudentId,
        selectedTeacherId,
        setSelectedTeacherId,
        authLoading,
        dataLoading,
        students,
        teachers,
        batches,
        attendance,
        fees,
        feePlans,
        tests,
        marks,
        notices,
        subscription,
        auditLogs,
        allInstitutes,
        allSubscriptions,
        signInWithGoogle,
        setCustomSessionUser,
        logout,
        switchInstitute,
        isSuperAdminUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
