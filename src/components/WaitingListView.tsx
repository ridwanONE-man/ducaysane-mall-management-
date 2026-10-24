import React, { useMemo, useState } from 'react';
import {
  Hourglass,
  UserPlus,
  Phone,
  Store,
  LayoutGrid,
  Calendar,
  Search,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  History,
} from 'lucide-react';
import { DepositRecord, PropertyUnit, WaitingEntry } from '../types';
import { formatLongDate, parsePaymentDate } from '../utils/printUtils';
import { formatUnitRent } from '../utils/currency';
import { AssignTenantModal } from './AssignTenantModal';
import { DeleteButton } from './DeleteControls';

interface WaitingListViewProps {
  entries: WaitingEntry[];
  units: PropertyUnit[];
  dbReady: boolean; // false while the waiting_list table doesn't exist yet
  onAdd: (entry: WaitingEntry) => void;
  onUpdate: (entry: WaitingEntry) => void;
  onDelete: (entry: WaitingEntry) => void;
  onSaveUnit: (unit: PropertyUnit) => void;
  onSaveDeposit: (deposit: DepositRecord) => void;
}

type TypeFilter = 'all' | 'Shop' | 'Space';

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isShopUnit = (u: PropertyUnit) => u.type === 'Shop' || u.categoryType === 'Shop' || u.unitNumber.startsWith('G');
const initials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

// First come, first served: earliest request date, then whoever was added first that day.
const byArrival = (a: WaitingEntry, b: WaitingEntry) =>
  a.requestedDate.localeCompare(b.requestedDate) || a.createdAt.localeCompare(b.createdAt);

const daysWaiting = (e: WaitingEntry) => {
  const d = parsePaymentDate(e.requestedDate);
  if (!d) return 0;
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000));
};

export const WaitingListView: React.FC<WaitingListViewProps> = ({
  entries,
  units,
  dbReady,
  onAdd,
  onUpdate,
  onDelete,
  onSaveUnit,
  onSaveDeposit,
}) => {
  // Add form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(toISO(new Date()));
  const [unitType, setUnitType] = useState<'Shop' | 'Space'>('Shop');
  const [trade, setTrade] = useState('');
  const [notes, setNotes] = useState('');

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [leasing, setLeasing] = useState<{ entry: WaitingEntry; unit: PropertyUnit } | null>(null);
  const [pickingFor, setPickingFor] = useState<WaitingEntry | null>(null);

  const waiting = useMemo(() => entries.filter(e => e.status === 'Waiting').sort(byArrival), [entries]);
  const history = useMemo(
    () => entries.filter(e => e.status !== 'Waiting').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries]
  );
  // Newest additions, shown at the top
  const recent = useMemo(() => [...waiting].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), [waiting]);

  // Position in the queue for each type (1 = next to be served)
  const positionOf = (e: WaitingEntry) => waiting.filter(w => w.unitType === e.unitType).findIndex(w => w.id === e.id) + 1;

  const available = (type: 'Shop' | 'Space') =>
    units.filter(u => (u.occupancyStatus === 'Available' || !u.currentTenant) && (type === 'Shop' ? isShopUnit(u) : !isShopUnit(u)));

  const q = search.trim().toLowerCase();
  const queue = waiting.filter(e =>
    (typeFilter === 'all' || e.unitType === typeFilter) &&
    (!q || [e.name, e.phone, e.trade, e.notes].some(v => (v || '').toLowerCase().includes(q)))
  );

  const handleAdd = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: `wait-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      unitType,
      trade: trade.trim() || undefined,
      requestedDate: date || toISO(new Date()),
      notes: notes.trim() || undefined,
      status: 'Waiting',
      createdAt: new Date().toISOString(),
    });
    setName('');
    setPhone('');
    setTrade('');
    setNotes('');
    setDate(toISO(new Date()));
  };

  const startLease = (entry: WaitingEntry) => {
    const free = available(entry.unitType);
    if (free.length === 1) setLeasing({ entry, unit: free[0] });
    else setPickingFor(entry);
  };

  const handleLeaseConfirmed = (updatedUnit: PropertyUnit, newDeposit?: DepositRecord) => {
    onSaveUnit(updatedUnit);
    if (newDeposit) onSaveDeposit(newDeposit);
    if (leasing) onUpdate({ ...leasing.entry, status: 'Leased', leasedUnit: updatedUnit.unitNumber });
    setLeasing(null);
  };

  const field = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-2 focus:ring-orange-100';
  const typeTone = (t: 'Shop' | 'Space') => (t === 'Shop' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-sky-50 text-sky-700 border-sky-200');
  const shopCount = waiting.filter(e => e.unitType === 'Shop').length;
  const spaceCount = waiting.filter(e => e.unitType === 'Space').length;

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200/80 shadow-xs">
        <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-orange-100/50" />
        <div className="relative p-5 sm:p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Hourglass className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Waiting List</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">People waiting for a shop or space — served first come, first served.</p>
          </div>
        </div>
      </div>

      {!dbReady && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            The waiting list table isn't set up in the database yet, so entries are kept on this device for now.
            Run <strong>supabase/waiting_list.sql</strong> once in the Supabase SQL Editor — saved entries upload automatically after that.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-6 items-start">
        {/* Add to the list */}
        <form data-edit onSubmit={handleAdd} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center"><UserPlus className="w-4 h-4" /></span>
            <h2 className="text-sm font-extrabold text-slate-900">Add to waiting list</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['Shop', 'Space'] as const).map(t => {
              const on = unitType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUnitType(t)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-all ${
                    on
                      ? t === 'Shop' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-sky-500 bg-sky-50 text-sky-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {t === 'Shop' ? <Store className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />} Wants a {t.toLowerCase()}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Full name</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amina Hassan" className={field} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+211 920 000 001" className={field} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date requested</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Business / trade <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={trade} onChange={e => setTrade(e.target.value)} placeholder="e.g. Clothing, Electronics" className={field} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Note <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Prefers ground floor" className={field} />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add to list
          </button>
        </form>

        <div className="space-y-5">
          {/* Just added */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-orange-500/20" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h2 className="text-sm font-extrabold">Just added</h2>
              </div>
              <div className="flex gap-1.5 text-[10px] font-bold">
                <span className="px-2 py-0.5 rounded-md bg-orange-500/90">{shopCount} for shops</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/90">{spaceCount} for spaces</span>
              </div>
            </div>
            {recent.length === 0 ? (
              <p className="relative mt-3 text-xs text-slate-400">Nobody is waiting yet. Add the first person on the left.</p>
            ) : (
              <div className="relative mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recent.map(e => (
                  <div key={e.id} className="flex items-center gap-2.5 rounded-2xl bg-white/10 px-3 py-2">
                    <span className={`w-8 h-8 shrink-0 rounded-xl text-[10px] font-black flex items-center justify-center ${e.unitType === 'Shop' ? 'bg-orange-500' : 'bg-sky-500'}`}>
                      {initials(e.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{e.name}</p>
                      <p className="text-[10px] text-slate-400">#{positionOf(e)} for a {e.unitType.toLowerCase()} • {formatLongDate(e.requestedDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Queue — first come, first served</h2>
                <p className="text-[11px] text-slate-500">#1 is next in line for each type.</p>
              </div>
              <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold self-start">
                {([['all', `All (${waiting.length})`], ['Shop', `Shops (${shopCount})`], ['Space', `Spaces (${spaceCount})`]] as [TypeFilter, string][]).map(([f, label]) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setTypeFilter(f)}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                      typeFilter === f ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, trade..." className={`${field} pl-9`} />
              </div>
            </div>

            {queue.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 rounded-3xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3"><Hourglass className="w-7 h-7" /></div>
                <p className="font-extrabold text-slate-900 text-sm">{waiting.length ? 'No one matches' : 'The waiting list is empty'}</p>
              </div>
            ) : (
              <ul className="p-4 space-y-2">
                {queue.map(e => {
                  const pos = positionOf(e);
                  const free = available(e.unitType).length;
                  const waited = daysWaiting(e);
                  return (
                    <li
                      key={e.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border p-3 transition-all hover:shadow-sm ${
                        pos === 1 ? 'border-orange-300 bg-orange-50/50' : 'border-slate-200/80 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className={`w-10 h-10 shrink-0 rounded-xl flex flex-col items-center justify-center leading-none font-black ${
                          pos === 1 ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <span className="text-[8px] font-bold opacity-80">NO.</span>
                          <span className="text-sm">{pos}</span>
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-extrabold text-slate-900 truncate">{e.name}</p>
                            <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${typeTone(e.unitType)}`}>{e.unitType}</span>
                            {pos === 1 && <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black">Next</span>}
                          </div>
                          <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {e.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {e.phone}</span>}
                            <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatLongDate(e.requestedDate)}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {waited === 0 ? 'today' : `${waited} day${waited === 1 ? '' : 's'} waiting`}</span>
                            {e.trade && <span>{e.trade}</span>}
                          </p>
                          {e.notes && <p className="text-[11px] text-slate-400 italic truncate">{e.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:justify-end">
                        <button data-edit
                          type="button"
                          disabled={free === 0}
                          onClick={() => startLease(e)}
                          title={free === 0 ? `No ${e.unitType.toLowerCase()} is available right now` : `Lease an available ${e.unitType.toLowerCase()} to ${e.name}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> {free === 0 ? 'None free' : `Lease (${free} free)`}
                        </button>
                        <button data-edit
                          type="button"
                          onClick={() => onUpdate({ ...e, status: 'Removed' })}
                          title="Take off the list (kept in history)"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs">
              <button
                type="button"
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <span className="flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> Served & removed ({history.length})</span>
                <span className="text-orange-600">{showHistory ? 'Hide' : 'Show'}</span>
              </button>
              {showHistory && (
                <ul className="px-4 pb-4 space-y-1.5">
                  {history.map(e => (
                    <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px]">
                      <span className="min-w-0 truncate">
                        <strong className="text-slate-800">{e.name}</strong> • {e.unitType} • asked {formatLongDate(e.requestedDate)}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {e.status === 'Leased'
                          ? <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">Leased {e.leasedUnit}</span>
                          : (
                            <button data-edit
                              type="button"
                              onClick={() => onUpdate({ ...e, status: 'Waiting' })}
                              className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 font-bold cursor-pointer hover:bg-orange-100"
                              title="Put back in the queue at their original date"
                            >
                              Put back
                            </button>
                          )}
                        <DeleteButton
                          title="Delete for good"
                          onDelete={() => onDelete(e)}
                          confirm={{ title: 'Delete this entry?', subject: `${e.name} • ${e.unitType}` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Choose which free unit to lease */}
      {pickingFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={() => setPickingFor(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={ev => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Choose a {pickingFor.unitType.toLowerCase()} for {pickingFor.name}</h3>
                <p className="text-[11px] text-slate-500">Available {pickingFor.unitType.toLowerCase()}s</p>
              </div>
              <button type="button" onClick={() => setPickingFor(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <ul className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {available(pickingFor.unitType).map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => { setLeasing({ entry: pickingFor, unit: u }); setPickingFor(null); }}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 px-4 py-3 text-left cursor-pointer"
                  >
                    <span>
                      <span className="block text-sm font-black text-slate-900 font-mono">{u.unitNumber}</span>
                      <span className="block text-[11px] text-slate-500">{u.floor} • {u.sizeSqM} m²</span>
                    </span>
                    <span className="text-sm font-black text-emerald-700">{formatUnitRent(u)}/mo</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {leasing && (
        <AssignTenantModal
          isOpen
          unit={leasing.unit}
          prefill={{ name: leasing.entry.name, phone: leasing.entry.phone, trade: leasing.entry.trade }}
          onClose={() => setLeasing(null)}
          onConfirmLease={handleLeaseConfirmed}
        />
      )}
    </div>
  );
};

