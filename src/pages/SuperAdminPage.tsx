import React, { useState } from 'react';
import { Building2, CheckCircle2, PauseCircle, Plus, ShieldAlert, X } from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { useApp } from '../context/AppContext';
import { makeId, seedSampleCoachingData } from '../services/database';
import { Institute, OperationType, Subscription, SubscriptionPlan } from '../types';

export const SuperAdminPage: React.FC = () => {
  const { user, allInstitutes, allSubscriptions, institute, switchInstitute } = useApp();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [plan, setPlan] = useState<SubscriptionPlan>('PRO');
  const [seedDemo, setSeedDemo] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeInstitutesCount = allInstitutes.filter((i) => i.status === 'Active').length;
  const suspendedInstitutesCount = allInstitutes.filter((i) => i.status === 'Suspended').length;

  const handleToggleInstituteStatus = async (inst: Institute) => {
    const nextStatus = inst.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateDoc(doc(db, 'institutes', inst.id), {
        status: nextStatus,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `institutes/${inst.id}`);
    }
  };

  const handleChangePlan = async (sub: Subscription, nextPlan: SubscriptionPlan) => {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), {
        plan: nextPlan,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${sub.id}`);
    }
  };

  const handleCreateTenantInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !ownerName.trim()) return;
    setSaving(true);
    try {
      const instId = makeId('inst');
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const instData: Omit<Institute, 'id'> = {
        name: name.trim().slice(0, 120),
        logo_url: '',
        address: address.trim().slice(0, 300),
        phone: phone.trim().slice(0, 30),
        email: (user.email || '').slice(0, 120),
        website: '',
        owner_name: ownerName.trim().slice(0, 100),
        owner_uid: user.uid,
        primary_color: '#0f172a',
        status: 'Active',
        created_at: now,
      };

      const subId = makeId('sub');
      const subData: Omit<Subscription, 'id'> = {
        institute_id: instId,
        plan,
        status: 'Active',
        start_date: today,
        expiry_date: nextYear,
        created_at: now,
      };

      await setDoc(doc(db, 'institutes', instId), instData);
      await setDoc(doc(db, 'subscriptions', subId), subData);

      if (seedDemo) {
        await switchInstitute(instId);
        await seedSampleCoachingData(instId, ownerName.trim());
      }

      setShowCreateModal(false);
      setName('');
      setOwnerName('');
      setPhone('');
      setAddress('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'institutes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            SaaS Platform Control Center · Super Admin
          </span>
          <h1 className="text-xl sm:text-2xl font-bold mt-1">
            Multi-Tenant Coaching Institutes &amp; Subscriptions
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Create isolated institutes, test tenant isolation by switching active workspace, and manage SaaS plans
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Coaching Tenant</span>
        </button>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Total Institutes</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {allInstitutes.length}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Active Tenants</span>
          <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">
            {activeInstitutesCount}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Suspended Tenants</span>
          <span className="text-2xl font-bold font-mono text-rose-600 mt-1 block">
            {suspendedInstitutesCount}
          </span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <span className="text-xs text-slate-500 block">Active Subscriptions</span>
          <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
            {allSubscriptions.filter((s) => s.status === 'Active').length}
          </span>
        </div>
      </div>

      {/* Tenant List & Isolation Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registered Coaching Institutes</h2>
            <p className="text-xs text-slate-500">
              Student personal information is strictly isolated per tenant and not exposed in Super Admin overview.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-600">
            Current Active Tenant: <strong>{institute?.name}</strong>
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-xs">
                <th className="py-2.5 pr-3">Institute Name</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">SaaS Plan</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 text-right">Tenant Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {allInstitutes.map((inst) => {
                const sub = allSubscriptions.find((s) => s.institute_id === inst.id);
                const isCurrent = institute?.id === inst.id;

                return (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="py-3.5 pr-3">
                      <p className="font-bold text-slate-900">{inst.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">ID: {inst.id}</p>
                    </td>
                    <td className="py-3.5 px-3 text-slate-800">{inst.owner_name}</td>
                    <td className="py-3.5 px-3 font-mono text-slate-700">{inst.phone || '—'}</td>
                    <td className="py-3.5 px-3">
                      {sub ? (
                        <select
                          value={sub.plan}
                          onChange={(e) => handleChangePlan(sub, e.target.value as SubscriptionPlan)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900 bg-white"
                        >
                          <option value="FREE">FREE / DEMO</option>
                          <option value="BASIC">BASIC</option>
                          <option value="PRO">PRO</option>
                          <option value="PREMIUM">PREMIUM</option>
                        </select>
                      ) : (
                        <span className="font-mono text-xs">PRO</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-xs">
                      <span className={inst.status === 'Active' ? 'text-emerald-700' : 'text-rose-600'}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => switchInstitute(inst.id)}
                          disabled={isCurrent}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-100 text-emerald-900 cursor-default'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {isCurrent ? 'Active Workspace' : 'Switch Tenant'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleInstituteStatus(inst)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          {inst.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SaaS Tier Architecture Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            plan: 'FREE / DEMO',
            audience: 'For new coaching trials',
            limit: 'Up to 25 Students',
            features: 'Core batches, attendance & basic receipts',
          },
          {
            plan: 'BASIC',
            audience: 'For small tuition centers',
            limit: 'Up to 150 Students',
            features: 'Student management, fee ledger & tests',
          },
          {
            plan: 'PRO',
            audience: 'For growing institutes',
            limit: 'Up to 1,000 Students',
            features: 'Custom branding, ID cards, reports & notices',
          },
          {
            plan: 'PREMIUM',
            audience: 'For multi-branch academies',
            limit: 'Unlimited Students',
            features: 'Full audit trail, multi-role portals & priority SLA',
          },
        ].map((tier) => (
          <div key={tier.plan} className="bg-white rounded-2xl border border-slate-200 p-4">
            <span className="text-xs font-bold text-amber-700">{tier.plan}</span>
            <p className="text-xs text-slate-500 mt-0.5">{tier.audience}</p>
            <p className="text-base font-bold font-mono text-slate-900 mt-2">{tier.limit}</p>
            <p className="text-xs text-slate-600 mt-1">{tier.features}</p>
          </div>
        ))}
      </div>

      {/* Create New Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Create New Coaching Institute Tenant</h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTenantInstitute} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Institute Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Resonance Career Institute (Tenant B)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Owner Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Vikram Singh"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subscription Plan</label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="FREE">FREE / DEMO</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Kota, Rajasthan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={seedDemo}
                  onChange={(e) => setSeedDemo(e.target.checked)}
                />
                <span>Switch to new institute &amp; seed sample data</span>
              </label>
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
                  {saving ? 'Creating...' : 'Create Institute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
