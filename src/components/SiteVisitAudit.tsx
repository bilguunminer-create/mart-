import { useState } from 'react';
import type { SiteVisitLocation, SiteVisitPeriod, SiteVisitStats } from '../services/supabaseAuth';

const periods: Array<[SiteVisitPeriod, string]> = [['today', 'Өнөөдөр'], ['last7days', '7 хоног'], ['last30days', '30 хоног'], ['total', 'Нийт']];

// ISO 3166-2:MN subdivision codes as sent by Vercel's x-vercel-ip-country-region.
const MN_REGIONS: Record<string, string> = {
  '1': 'Улаанбаатар', '035': 'Орхон', '037': 'Дархан-Уул', '039': 'Хэнтий', '041': 'Хөвсгөл', '043': 'Ховд',
  '046': 'Увс', '047': 'Төв', '049': 'Сэлэнгэ', '051': 'Сүхбаатар', '053': 'Өмнөговь', '055': 'Өвөрхангай',
  '057': 'Завхан', '059': 'Дундговь', '061': 'Дорнод', '063': 'Дорноговь', '064': 'Говьсүмбэр', '065': 'Говь-Алтай',
  '067': 'Булган', '069': 'Баянхонгор', '071': 'Баян-Өлгий', '073': 'Архангай',
};

function countryName(code: string) {
  try { return new Intl.DisplayNames(['mn'], { type: 'region' }).of(code) || code; } catch { return code; }
}

function locationLabel(row: SiteVisitLocation) {
  if (!row.country) return 'Тодорхойгүй (байршил хадгалагдахаас өмнөх)';
  const region = row.country === 'MN' ? MN_REGIONS[row.region] || row.region : row.region;
  return [row.city, region, countryName(row.country)].filter(Boolean).join(' · ');
}

function SiteVisitLocations({ locations }: { locations?: SiteVisitLocation[] }) {
  const [period, setPeriod] = useState<SiteVisitPeriod>('last7days');
  if (!locations) return <p className="text-xs text-amber-800">Байршлын тайлан идэвхжээгүй байна. Supabase дээр add-site-visit-locations.sql-ийг ажиллуулсны дараа шинэ хандалтуудаас эхэлж харагдана.</p>;
  const rows = locations.filter(row => row.period === period);
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="text-sm font-bold text-stone-900">Байршлаар</h5>
      <div className="flex gap-1">{periods.map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-lg px-2.5 py-1 text-xs font-bold ${period === value ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>{label}</button>)}</div>
    </div>
    <p className="text-xs text-stone-500">IP хаягаар тооцсон ойролцоо байршил. Утасны сүлжээгээр орсон хүмүүс оператор нь хаана байгаагаас хамаарч ихэвчлэн Улаанбаатар гэж харагдана.</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead><tr className="border-b text-stone-500"><th className="p-2">Байршил</th><th className="p-2 text-right">Зочин</th><th className="p-2 text-right">Үзэлт</th></tr></thead>
        <tbody>{rows.map(row => <tr key={`${row.country}|${row.region}|${row.city}`} className="border-b border-stone-100">
          <td className="p-2">{locationLabel(row)}</td>
          <td className="p-2 text-right font-bold">{row.visitors}</td>
          <td className="p-2 text-right">{row.pageviews}</td>
        </tr>)}</tbody>
      </table>
      {rows.length === 0 && <p className="py-2 text-xs text-stone-500">Энэ хугацаанд хандалт алга.</p>}
    </div>
  </div>;
}

export function SiteVisitAudit({ stats }: { stats: SiteVisitStats }) {
  if (stats.total_verified_login_sessions === undefined) return <p className="text-xs text-amber-800">IP болон баталгаажсан сессийн тайлан идэвхжээгүй байна. Өмнөх хандалтуудаас бодит нэвтрэлт тогтоох боломжгүй.</p>;
  return <div className="space-y-3 border-t border-stone-100 pt-3">
    <h5 className="text-sm font-bold text-stone-900">IP ба баталгаажсан нэвтрэлт</h5>
    <p className="text-xs text-stone-500">IP нь сүлжээний хаяг тул хэд хэдэн хүн ижил IP ашиглаж болно. Нэвтрэлтийг баталгаажсан бүртгэл, сессээр ялгана. Хуудас шинэчлэх, token сунгах нь шинэ нэвтрэлт болохгүй.</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {periods.map(([period, label]) => <div key={period} className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs">
        <p className="font-bold text-emerald-900">{label}</p>
        <p className="mt-1">{stats[`${period}_unique_ips`] ?? 0} өөр IP</p>
        <p>{stats[`${period}_verified_login_sessions`] ?? 0} баталгаажсан сесс</p>
        <p>{stats[`${period}_repeat_logins`] ?? 0} давтан нэвтрэлт</p>
        <p className="mt-1 text-stone-500">{stats[`${period}_unverified_pageviews`] ?? 0} нэвтрэлт баталгаажаагүй үзэлт</p>
      </div>)}
    </div>
    <p className="text-xs text-stone-500">Давтан нэвтрэлт: өмнө бүртгэгдсэн хэрэглэгч өөр баталгаажсан сессээр дахин орсон тоо. Энэ нь тухайн хүнийг эсвэл бот бишийг дангаараа нотлохгүй.</p>
    <SiteVisitLocations locations={stats.locations} />
    {stats.recent_visits_error ? <p role="status" className="text-xs text-amber-800">Сүүлийн хандалтуудыг ачаалж чадсангүй. Шинэчлэх товчоор дахин оролдоно уу.</p> : <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <caption className="pb-2 text-left font-bold text-stone-700">Сүүлийн 50 хандалт — зөвхөн админд</caption>
        <thead><tr className="border-b text-stone-500"><th className="p-2">Огноо (УБ)</th><th className="p-2">IP</th><th className="p-2">Бүртгэл / browser</th><th className="p-2">Шалгалт</th></tr></thead>
        <tbody>{(stats.recent_visits || []).map(visit => <tr key={visit.id} className="border-b border-stone-100">
          <td className="whitespace-nowrap p-2">{new Date(visit.created_at).toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })}</td>
          <td className="whitespace-nowrap p-2 font-mono">{visit.ip_address || 'Хадгалаагүй'}</td>
          <td className="p-2 font-mono" title={visit.user_id || visit.visitor_id}>{visit.user_id ? `Бүртгэл ${visit.user_id.slice(0, 8)}` : `Browser ${visit.visitor_id.slice(0, 8)}`}</td>
          <td className="p-2">{visit.identity_status === 'verified' ? 'Баталгаажсан сесс' : visit.identity_status === 'guest' ? 'Нэвтрээгүй' : 'Өмнөх бүртгэл — баталгаагүй'}</td>
        </tr>)}</tbody>
      </table>
      {!stats.recent_visits?.length && <p className="py-2 text-xs text-stone-500">Хандалт бүртгэгдээгүй байна.</p>}
    </div>}
  </div>;
}
