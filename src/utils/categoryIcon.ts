import {
  Store,
  ShieldCheck,
  Zap,
  Shield,
  Sparkles,
  Wrench,
  FileText,
  Users,
  UtensilsCrossed,
  Coffee,
  Fuel,
  Droplets,
  Car,
  Bus,
  Wifi,
  Phone,
  Megaphone,
  PaintRoller,
  Hammer,
  Lightbulb,
  Trash2,
  HeartPulse,
  GraduationCap,
  Gift,
  Banknote,
  Landmark,
  Building2,
  Package,
  ShoppingCart,
  Printer,
  Armchair,
  Laptop,
  Scale,
  Receipt,
  PartyPopper,
  Plane,
  KeyRound,
  CircleDollarSign,
} from 'lucide-react';

type Icon = React.ComponentType<{ className?: string }>;

export interface CategoryLook {
  icon: Icon;
  tone: string; // background + text colour for the icon bubble
}

// A category typed freely gets an icon from the words in it (first match wins).
const RULES: [RegExp, Icon, string][] = [
  [/rent|kiro/, Store, 'bg-orange-100 text-orange-600'],
  [/deposit|escrow|dammaanad/, ShieldCheck, 'bg-blue-100 text-blue-600'],
  [/electric|power|koronto|nal\b/, Zap, 'bg-amber-100 text-amber-600'],
  [/light|bulb|lamp/, Lightbulb, 'bg-amber-100 text-amber-600'],
  [/fuel|diesel|petrol|gas\b|benzin|shidaal|generator/, Fuel, 'bg-rose-100 text-rose-600'],
  [/water|biyo|plumb|pipe/, Droplets, 'bg-sky-100 text-sky-600'],
  [/food|meal|lunch|breakfast|dinner|cunto|restaurant|grocer/, UtensilsCrossed, 'bg-emerald-100 text-emerald-600'],
  [/tea|coffee|shaah|drink|soda/, Coffee, 'bg-amber-100 text-amber-700'],
  [/clean|waste|garbage|rubbish|nadaaf|wash|soap|detergent/, Sparkles, 'bg-teal-100 text-teal-600'],
  [/trash|bin\b|dump/, Trash2, 'bg-slate-200 text-slate-600'],
  [/guard|security|ilaalin|watch/, Shield, 'bg-indigo-100 text-indigo-600'],
  [/paint|rinji/, PaintRoller, 'bg-pink-100 text-pink-600'],
  [/build|construct|cement|brick|dhis/, Hammer, 'bg-orange-100 text-orange-700'],
  [/repair|mainten|fix|wrench|mechanic|dayac/, Wrench, 'bg-orange-100 text-orange-600'],
  [/salar|payroll|wage|staff|worker|mushahar|shaqaal|employee/, Users, 'bg-violet-100 text-violet-600'],
  [/tax|licen|permit|govern|canshuur|council/, Scale, 'bg-slate-200 text-slate-700'],
  [/internet|wifi|data\b/, Wifi, 'bg-cyan-100 text-cyan-600'],
  [/phone|airtime|call|mobile|telefoon/, Phone, 'bg-cyan-100 text-cyan-600'],
  [/transport|taxi|bajaj|boda|travel ticket|bus/, Bus, 'bg-yellow-100 text-yellow-700'],
  [/car|vehicle|gaari/, Car, 'bg-yellow-100 text-yellow-700'],
  [/flight|plane|air ticket|travel/, Plane, 'bg-sky-100 text-sky-600'],
  [/advert|marketing|promo|sign\b|banner|xayaysiis/, Megaphone, 'bg-fuchsia-100 text-fuchsia-600'],
  [/medic|health|hospital|clinic|daawo|doctor/, HeartPulse, 'bg-rose-100 text-rose-600'],
  [/school|train|course|educat/, GraduationCap, 'bg-indigo-100 text-indigo-600'],
  [/gift|donat|charity|sadaqa|zakat/, Gift, 'bg-pink-100 text-pink-600'],
  [/party|event|ceremony|celebrat/, PartyPopper, 'bg-fuchsia-100 text-fuchsia-600'],
  [/print|paper|stationer|ink/, Printer, 'bg-slate-200 text-slate-600'],
  [/furniture|chair|table|desk/, Armchair, 'bg-amber-100 text-amber-700'],
  [/computer|laptop|software|system|it\b/, Laptop, 'bg-blue-100 text-blue-600'],
  [/key|lock/, KeyRound, 'bg-slate-200 text-slate-700'],
  [/shop|buy|purchase|market|supply|supplies/, ShoppingCart, 'bg-emerald-100 text-emerald-600'],
  [/stock|goods|package|deliver/, Package, 'bg-amber-100 text-amber-700'],
  [/bank|transfer|withdraw/, Landmark, 'bg-blue-100 text-blue-600'],
  [/loan|debt|credit|deen/, Banknote, 'bg-emerald-100 text-emerald-700'],
  [/bill|invoice|receipt/, Receipt, 'bg-slate-200 text-slate-700'],
  [/document|contract|legal|lawyer/, FileText, 'bg-slate-200 text-slate-700'],
  [/building|office|property/, Building2, 'bg-orange-100 text-orange-600'],
];

export function categoryLook(category: string | undefined, type: 'Inflow' | 'Outflow' = 'Outflow'): CategoryLook {
  const text = (category || '').toLowerCase();
  for (const [rule, icon, tone] of RULES) if (rule.test(text)) return { icon, tone };
  return type === 'Inflow'
    ? { icon: CircleDollarSign, tone: 'bg-emerald-100 text-emerald-600' }
    : { icon: Receipt, tone: 'bg-rose-100 text-rose-600' };
}
