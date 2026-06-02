import React, { useState, useEffect } from 'react';
import { useMLMStore, ROOT_ID, COURSE_PRICE, COURSE_BV } from '../store/useMLMStore';
import { Users, Trophy, Plus, X, UserPlus, Activity, RefreshCw, ArrowRight } from 'lucide-react';

// ─── Recursive Tree Node ────────────────────────────────────────────────────
const TreeNode = ({ memberId, members, getLegBVs, depth = 0, onAddMember }) => {
  const member = members.find(m => m.id === memberId);
  if (!member) return null;

  const isRoot = memberId === ROOT_ID;
  const { leftBV, rightBV } = getLegBVs(memberId);
  const leftChild  = members.find(m => m.parentId === memberId && m.leg === 'left');
  const rightChild = members.find(m => m.parentId === memberId && m.leg === 'right');

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div
        className={`flex flex-col items-center group cursor-default transition-transform hover:scale-105`}
        title={`${member.name} | ${member.bv} BV | Joined: ${member.joinedAt}`}
      >
        <div
          className={`
            w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-sm
            ${isRoot
              ? 'bg-brand-600 border-brand-400 shadow-brand-100'
              : member.leg === 'left'
                ? 'bg-indigo-100 border-indigo-200'
                : 'bg-blue-100 border-blue-200'}
          `}
        >
          {isRoot
            ? <Trophy className="text-white" size={22} />
            : <Users className={member.leg === 'left' ? 'text-indigo-600' : 'text-blue-600'} size={18} />
          }
        </div>
        <p className={`mt-1.5 text-[10px] font-bold uppercase tracking-tight max-w-[80px] text-center truncate ${isRoot ? 'text-brand-600' : 'text-slate-500'}`}>
          {member.name}
        </p>
        <p className="text-[10px] font-black text-slate-700">{member.bv} BV</p>
        
        {/* Admin manual BV buttons */}
        <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => useMLMStore.getState().addBVToMember(member.id, 3000, 'left')}
            className="px-1.5 py-0.5 bg-indigo-500 text-[8px] text-white rounded-md font-bold hover:bg-indigo-600"
            title="Add 3000 BV to Left Leg"
          >
            +L
          </button>
          <button 
            onClick={() => useMLMStore.getState().addBVToMember(member.id, 3000, 'right')}
            className="px-1.5 py-0.5 bg-blue-500 text-[8px] text-white rounded-md font-bold hover:bg-blue-600"
            title="Add 3000 BV to Right Leg"
          >
            +R
          </button>
        </div>
      </div>

      {/* Children */}
      {(leftChild || rightChild) && (
        <div className="flex flex-col items-center">
          <div className="h-6 w-px bg-slate-400" />
          <div className="flex items-start gap-16">
            {/* Left branch */}
            <div className="flex flex-col items-center relative">
              {/* Horizontal line: from center to right-middle of gap */}
              <div className="absolute top-0 left-1/2 -right-[32px] h-px bg-slate-400" />
              <div className="h-4 w-px bg-slate-400" />
              {leftChild ? (
                <TreeNode memberId={leftChild.id} members={members} getLegBVs={getLegBVs} depth={depth + 1} onAddMember={onAddMember} />
              ) : (
                <EmptySlot label="Left" onClick={() => onAddMember(member.id, 'left')} />
              )}
              <p className="mt-2 text-[9px] font-bold text-indigo-400 uppercase tracking-widest">{leftBV} BV</p>
            </div>

            {/* Right branch */}
            <div className="flex flex-col items-center relative">
              {/* Horizontal line: from center to left-middle of gap */}
              <div className="absolute top-0 right-1/2 -left-[32px] h-px bg-slate-400" />
              <div className="h-4 w-px bg-slate-400" />
              {rightChild ? (
                <TreeNode memberId={rightChild.id} members={members} getLegBVs={getLegBVs} depth={depth + 1} onAddMember={onAddMember} />
              ) : (
                <EmptySlot label="Right" onClick={() => onAddMember(member.id, 'right')} />
              )}
              <p className="mt-2 text-[9px] font-bold text-blue-400 uppercase tracking-widest">{rightBV} BV</p>
            </div>
          </div>
        </div>
      )}

      {/* Show empty slots if node has zero children but we want to show expansion points */}
      {depth < 3 && !leftChild && !rightChild && (
        <div className="flex flex-col items-center">
          <div className="h-6 w-px bg-slate-400" />
          <div className="flex items-start gap-16">
            <div className="flex flex-col items-center relative">
              <div className="absolute top-0 left-1/2 -right-[32px] h-px bg-slate-400" />
              <div className="h-4 w-px bg-slate-400" />
              <EmptySlot label="Left" onClick={() => onAddMember(member.id, 'left')} />
            </div>
            <div className="flex flex-col items-center relative">
              <div className="absolute top-0 right-1/2 -left-[32px] h-px bg-slate-400" />
              <div className="h-4 w-px bg-slate-400" />
              <EmptySlot label="Right" onClick={() => onAddMember(member.id, 'right')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptySlot = ({ label, onClick }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center opacity-40 hover:opacity-100 transition-all cursor-pointer group"
  >
    <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 group-hover:bg-brand-50 group-hover:border-brand-300">
      <Plus className="text-slate-300 group-hover:text-brand-500" size={18} />
    </div>
    <p className="mt-1.5 text-[10px] font-bold text-slate-300 uppercase tracking-tight group-hover:text-brand-600">{label} (empty)</p>
  </button>
);

// ─── Add Member Modal ───────────────────────────────────────────────────────
const AddMemberModal = ({ onClose, initialParentId, initialLeg }) => {
  const { members, addMember, findNextAvailablePlacement } = useMLMStore();
  const [form, setForm] = useState({
    name: '',
    sponsorId: initialParentId || ROOT_ID,
    parentId: initialParentId || ROOT_ID,
    leg: initialLeg || 'left',
    bv: COURSE_BV,
  });
  const [error, setError] = useState('');

  // Auto-placement logic when Sponsor changes
  useEffect(() => {
    // Check for stored referral code on first load
    const storedRef = sessionStorage.getItem('referral_code');
    if (storedRef && form.sponsorId === ROOT_ID) {
      const sponsor = members.find(m => m.referralCode === storedRef);
      if (sponsor) {
        setForm(f => ({ ...f, sponsorId: sponsor.id }));
        sessionStorage.removeItem('referral_code'); // Clear after use
      }
    }

    if (form.sponsorId) {
      const placement = findNextAvailablePlacement(form.sponsorId);
      setForm(f => ({ ...f, parentId: placement.parentId, leg: placement.leg }));
    }
  }, [form.sponsorId, findNextAvailablePlacement, members]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Member name is required.'); return; }
    const bv = COURSE_BV; // Automatically add COURSE_BV on registration

    // Check slot availability under the selected parent
    const occupied = members.find(m => m.parentId === form.parentId && m.leg === form.leg);
    if (occupied) {
      setError(`The ${form.leg} leg under that parent is already taken by "${occupied.name}".`);
      return;
    }

    addMember({ 
      name: form.name.trim(), 
      sponsorId: form.sponsorId, 
      parentId: form.parentId,
      leg: form.leg, 
      bv 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-y-auto">
        <button onClick={onClose} className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <UserPlus className="text-brand-600" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Register New Member</h3>
            <p className="text-xs text-brand-600 font-bold">System will automatically credit {COURSE_BV} BV.</p>
          </div>
        </div>

        {/* Commission preview */}
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center gap-3 text-sm">
            <ArrowRight className="text-emerald-500 shrink-0" size={18} />
            <span className="font-bold text-emerald-700">Direct Commission: ₹{(COURSE_PRICE * 0.10).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-bold text-emerald-700">3000 BV Matching Bonus: $70</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Member Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
            />
          </div>

          {/* Sponsor */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sponsor (Referrer)</label>
            <select
              value={form.sponsorId}
              onChange={e => { setForm(f => ({ ...f, sponsorId: e.target.value })); setError(''); }}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all font-bold text-slate-800"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
              ))}
            </select>
          </div>

          {/* Auto-calculated Placement Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Auto-Placement Parent</label>
              <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                {members.find(m => m.id === form.parentId)?.name || '...'}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Auto-Placement Leg</label>
              <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-brand-600 uppercase tracking-widest">
                {form.leg} Leg
              </div>
            </div>
          </div>

          {/* Initial BV (Removed to enforce manual addition) */}
          <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
            <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1">Registration Policy</p>
            <p className="text-xs text-brand-700 leading-relaxed">
              New members start with <span className="font-black">{COURSE_BV} BV</span> automatically credited to their leg. This will trigger matching commissions for uplines.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-semibold bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-100"
          >
            Add Member & Run Matching
          </button>
          
        </form>
      </div>
    </div>
  );
};

// ─── Main NetworkTree Component ─────────────────────────────────────────────
export const NetworkTree = () => {
  const store = useMLMStore();
  const sessionUserStr = sessionStorage.getItem('user');
  const sessionUser = sessionUserStr ? JSON.parse(sessionUserStr) : null;
  const rootId = sessionUser ? sessionUser.id : ROOT_ID;
  
  const [modalData, setModalData] = useState(null); // { parentId, leg } or null
  const { leftBV, rightBV } = store.getLegBVs(rootId);
  const matchedBV = Math.min(leftBV, rightBV);

  return (
    <>
      {modalData && (
        <AddMemberModal 
          onClose={() => setModalData(null)} 
          initialParentId={modalData.parentId}
          initialLeg={modalData.leg}
        />
      )}

      <div className="glass-card rounded-3xl p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Activity size={24} className="text-brand-500" />
              Binary Network Tree {sessionUser ? `(${sessionUser.username})` : ''}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {store.members.length - 1} member{store.members.length !== 2 ? 's' : ''} · Root Leg Balances: L {leftBV} | R {rightBV}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModalData({ parentId: rootId, leg: 'left' })}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 active:scale-95 transition-all shadow-lg shadow-brand-100"
            >
              <UserPlus size={16} /> Add Member
            </button>
            <button
              onClick={store.processMatching}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
              title="Process Binary Matching"
            >
              <RefreshCw size={16} /> Match
            </button>
          </div>
        </div>

        {/* Tree canvas */}
        <div className="bg-slate-50/60 rounded-2xl p-10 border border-slate-100 overflow-x-auto flex justify-center min-h-[240px]">
          <TreeNode
            memberId={rootId}
            members={store.members}
            getLegBVs={store.getLegBVs}
            depth={0}
            onAddMember={(parentId, leg) => setModalData({ parentId, leg })}
          />
        </div>

        {/* Matching summary */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Available Left BV</p>
            <p className="text-xl font-black text-indigo-700">{leftBV}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">3000 BV Matching</p>
            <p className="text-xl font-black text-emerald-700">{Math.floor(Math.min(leftBV, rightBV) / 3000)} Unit(s)</p>
            <p className="text-[10px] text-emerald-500 font-semibold">Ready to split</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Available Right BV</p>
            <p className="text-xl font-black text-blue-700">{rightBV}</p>
          </div>
        </div>
      </div>
    </>
  );
};
