import { useState } from 'react';
import type { FormEvent } from 'react';
import { Coins, Star, Wallet } from 'lucide-react';

type ChildBalance = { id: string; name: string; balance: number; avatar: string };
const toFa = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
const toman = (stars: number, rate: number) => `${toFa(stars * rate)} تومان`;

export default function CashoutForm({ childrenList, rate, onCashOut, onClose }: {
  childrenList: ChildBalance[];
  rate: number;
  onCashOut: (childId: string, stars: number) => void;
  onClose: () => void;
}) {
  const [childId, setChildId] = useState(childrenList.find(child => child.balance > 0)?.id ?? childrenList[0]?.id ?? '');
  const [stars, setStars] = useState(1);
  const child = childrenList.find(item => item.id === childId);
  const valid = Boolean(child && Number.isInteger(stars) && stars > 0 && stars <= child.balance);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && child) onCashOut(child.id, stars);
  };
  if (!childrenList.some(item => item.balance > 0)) return <div className="cashout-empty"><span><Coins size={24}/></span><b>هنوز ستاره‌ای برای تبدیل ندارید</b><p>پس از انجام کارها و تأیید والد، ستاره‌ها در کیف پول هر فرزند جمع می‌شوند.</p><button type="button" className="cancel-btn" onClick={onClose}>متوجه شدم</button></div>;
  return <form className="form-content cashout-form" onSubmit={submit}>
    <p className="form-intro">هر ستاره {toFa(rate)} تومان است. انتخاب و پرداخت را والد ثبت می‌کند.</p>
    <label>برای کدام فرزند؟<select value={childId} onChange={event => { setChildId(event.target.value); setStars(1); }}>{childrenList.map(item => <option key={item.id} value={item.id} disabled={item.balance === 0}>{item.avatar} {item.name} · {toFa(item.balance)} ستاره</option>)}</select></label>
    <label>تعداد ستاره برای تبدیل<div className="cashout-number"><input type="number" inputMode="numeric" min="1" step="1" max={child?.balance ?? 0} value={stars} onChange={event => setStars(Number(event.target.value))}/><Star size={18} fill="currentColor"/><span>از {toFa(child?.balance ?? 0)} ستاره</span></div></label>
    <div className="cashout-total"><div><Star size={18} fill="currentColor"/><b>{toFa(stars)} ستاره</b></div><span>=</span><div><Wallet size={19}/><b>{toman(stars, rate)}</b></div></div>
    {!valid && <p className="cashout-warning">تعداد ستاره باید بین ۱ و موجودی فرزند باشد.</p>}
    <div className="form-actions"><button type="button" className="cancel-btn" onClick={onClose}>انصراف</button><button type="submit" className="primary-btn" disabled={!valid}><Wallet size={18}/>ثبت پرداخت {toman(stars, rate)}</button></div>
  </form>;
}
