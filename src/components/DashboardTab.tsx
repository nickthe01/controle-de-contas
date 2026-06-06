'use client'

import { useState, useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Transferência', 'Outros']
const EXPENSE_CATEGORIES = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Transferência', 'Outros']

const CAT_COLORS: Record<string, string> = {
  Alimentação: '#A3E635', Moradia: '#14B8A6', Transporte: '#F59E0B',
  Saúde: '#F43F5E', Educação: '#8B5CF6', Lazer: '#06B6D4',
  Compras: '#EC4899', Transferência: '#6B7280', Outros: '#94A3B8',
  Salário: '#A3E635', Freelance: '#14B8A6', Investimentos: '#F59E0B',
}

const CAT_ICONS: Record<string, string> = {
  Alimentação: '🍽️', Moradia: '🏠', Transporte: '🚗', Saúde: '❤️',
  Educação: '📚', Lazer: '🎬', Compras: '🛍️', Salário: '💼',
  Freelance: '💻', Investimentos: '📈', Transferência: '↔️', Outros: '·',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fmtShort(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`
  return `R$${v.toFixed(0)}`
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const sm = start.getFullYear() * 12 + start.getMonth()
  const tm = year * 12 + month
  return tm >= sm && tm <= sm + t.installments - 1
}

interface Props {
  transactions: Transaction[]
  cards: CreditCard[]
  cardTransactions: CreditCardTransaction[]
  bills: Bill[]
  salary: SalaryConfig | null
  extraIncomes: ExtraIncome[]
  currentDate: Date
  onRefresh: () => void
}

const blankForm = () => ({
  description: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category: 'Outros',
  date: new Date().toISOString().split('T')[0],
})

export default function DashboardTab({ transactions, cards, cardTransactions, bills, salary, extraIncomes, currentDate, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [form, setForm] = useState(blankForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date().getDate()

  const summary = useMemo(() => {
    const extra = extraIncomes
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, e) => s + Number(e.amount), 0)
    const totalIncome = (salary?.fixed_amount ?? 0) + extra
    const regularExpenses = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, t) => s + Number(t.amount), 0)
    const cardTotal = cardTransactions.filter(t => isActiveInMonth(t, year, month)).reduce((s, t) => s + t.total_amount / t.installments, 0)
    const billsTotal = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
    const totalExpenses = regularExpenses + cardTotal + billsTotal
    const freeBalance = totalIncome - totalExpenses
    const pct = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0
    return { totalIncome, regularExpenses, cardTotal, billsTotal, totalExpenses, freeBalance, pct }
  }, [transactions, cardTransactions, bills, salary, extraIncomes, year, month])

  const chartData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 5 + i, 1)
      const m = d.getMonth(); const y = d.getFullYear()
      const income = (salary?.fixed_amount ?? 0) + extraIncomes
        .filter(e => { const ed = new Date(e.date + 'T00:00:00'); return ed.getMonth() === m && ed.getFullYear() === y })
        .reduce((s, e) => s + Number(e.amount), 0)
      const expenses = transactions
        .filter(t => { const td = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && td.getMonth() === m && td.getFullYear() === y })
        .reduce((s, t) => s + Number(t.amount), 0)
        + cardTransactions.filter(t => isActiveInMonth(t, y, m)).reduce((s, t) => s + t.total_amount / t.installments, 0)
        + bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
      return { label: MONTHS_SHORT[m], income, expenses, isCurrent: m === month && y === year }
    }),
    [transactions, cardTransactions, bills, salary, extraIncomes, year, month])

  const maxChart = Math.max(...chartData.flatMap(d => [d.income, d.expenses]), 1)

  const upcomingBills = useMemo(() =>
    bills.filter(b => b.is_active)
      .map(b => ({ ...b, daysUntil: b.due_day >= today ? b.due_day - today : 31 - today + b.due_day }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5),
    [bills, today])

  const maxBill = Math.max(...upcomingBills.map(b => Number(b.amount)), 1)

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {}
    transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year })
      .forEach(t => { cats[t.category] = (cats[t.category] ?? 0) + Number(t.amount) })
    const total = Object.values(cats).reduce((s, v) => s + v, 0)
    return Object.entries(cats)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round(value / total * 100) : 0 }))
  }, [transactions, year, month])

  const recentTx = useMemo(() =>
    transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6),
    [transactions, year, month])

  function openCreate() { setEditingTx(null); setForm(blankForm()); setError(null); setShowModal(true) }
  function openEdit(tx: Transaction) {
    setEditingTx(tx)
    setForm({ description: tx.description, amount: String(Number(tx.amount).toFixed(2)).replace('.', ','), type: tx.type, category: tx.category, date: tx.date })
    setError(null); setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError(null)
    const payload = { ...form, amount: parseCurrency(form.amount) }
    const url = editingTx ? `/api/transactions/${editingTx.id}` : '/api/transactions'
    const method = editingTx ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); setSubmitting(false); return }
    await onRefresh(); setShowModal(false); setForm(blankForm()); setEditingTx(null); setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta transação?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' }); onRefresh()
  }

  const pct = Math.round(summary.pct)
  const limeAccent = '#C9F042'

  return (
    <div className="space-y-4">

      {/* ── HERO: grande card escuro ── */}
      <div className="rounded-3xl bg-[#0A0A0A] p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-5" style={{ background: limeAccent, transform: 'translate(40%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-5" style={{ background: '#14B8A6', transform: 'translate(-30%, 40%)' }} />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.1em]">Saldo Livre</p>
              <p className={`text-[34px] font-black tracking-tight leading-none mt-1 ${summary.freeBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {fmt(summary.freeBalance)}
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold mt-1 ${pct >= 90 ? 'bg-rose-500/20 text-rose-400' : pct >= 70 ? 'bg-amber-500/20 text-amber-400' : 'text-[#0A0A0A]'}`}
              style={pct < 70 ? { backgroundColor: `${limeAccent}25`, color: limeAccent } : {}}>
              {pct}% usado
            </div>
          </div>

          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#F43F5E' : pct >= 70 ? '#F59E0B' : limeAccent }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Renda', value: summary.totalIncome, color: limeAccent },
              { label: 'Cartão', value: summary.cardTotal, color: '#14B8A6' },
              { label: 'Boletos', value: summary.billsTotal, color: '#F59E0B' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 rounded-2xl p-3 border border-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: stat.color }}>{stat.label}</p>
                <p className="text-white font-bold text-sm leading-tight">{fmtShort(stat.value)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHART: seção com fundo lime (inspirado no GoodBoard amarelo) ── */}
      <div className="rounded-3xl p-5 overflow-hidden" style={{ backgroundColor: `${limeAccent}15`, border: `1px solid ${limeAccent}30` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-slate-900 text-base">Evolução mensal</h2>
            <p className="text-slate-500 text-xs">Renda vs gastos totais</p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
              <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: limeAccent }} />
              Receitas
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
              <span className="w-3 h-1.5 rounded-full bg-slate-800 inline-block" />
              Gastos
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: '84px' }}>
                <div className="flex-1 rounded-t-md transition-all"
                  style={{ height: `${Math.max((d.income / maxChart) * 100, d.income > 0 ? 3 : 0)}%`, backgroundColor: d.isCurrent ? limeAccent : `${limeAccent}60` }} />
                <div className="flex-1 rounded-t-md transition-all"
                  style={{ height: `${Math.max((d.expenses / maxChart) * 100, d.expenses > 0 ? 3 : 0)}%`, backgroundColor: d.isCurrent ? '#0A0A0A' : '#0A0A0A40' }} />
              </div>
              <span className={`text-[9px] font-bold ${d.isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOLETOS: estilo Top Products ── */}
      {upcomingBills.length > 0 && (
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-black text-slate-900 text-base">Boletos próximos</h2>
              <p className="text-slate-400 text-xs mt-0.5">Contas do mês</p>
            </div>
          </div>
          <div className="px-5 pb-2">
            <div className="grid grid-cols-[20px_1fr_auto_64px] gap-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
              <span>#</span><span>Nome</span><span className="text-right">Vence</span><span className="text-right">Valor</span>
            </div>
          </div>
          <ul className="px-5 pb-4 space-y-3">
            {upcomingBills.map((bill, i) => {
              const pctBar = Math.round((Number(bill.amount) / maxBill) * 100)
              const urgent = bill.daysUntil <= 3
              return (
                <li key={bill.id} className="grid grid-cols-[20px_1fr_auto_64px] gap-x-3 items-center">
                  <span className="text-[11px] font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">{bill.description}</p>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${limeAccent}25` }}>
                      <div className="h-full rounded-full" style={{ width: `${pctBar}%`, backgroundColor: limeAccent }} />
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold shrink-0 px-2 py-0.5 rounded-lg ${urgent ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                    {bill.daysUntil === 0 ? 'Hoje' : `${bill.daysUntil}d`}
                  </span>
                  <span className="text-sm font-black text-slate-900 text-right">{fmt(Number(bill.amount))}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── GASTOS POR CATEGORIA ── */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-black text-slate-900 text-base">Gastos por categoria</h2>
              <p className="text-slate-400 text-xs mt-0.5">{MONTHS_SHORT[month]} · despesas avulsas</p>
            </div>
          </div>
          <div className="space-y-3.5">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="grid grid-cols-[20px_1fr_auto_40px] gap-x-3 items-center">
                <span className="text-[11px] font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate leading-tight mb-1">{cat.name}</p>
                  <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${cat.pct}%`, backgroundColor: CAT_COLORS[cat.name] ?? '#94A3B8' }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-500">{fmt(cat.value)}</span>
                <span className="text-xs font-black text-right" style={{ color: CAT_COLORS[cat.name] ?? '#94A3B8' }}>{cat.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TRANSAÇÕES RECENTES ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-black text-slate-900 text-base">Transações do mês</h2>
            <p className="text-slate-400 text-xs">{MONTHS_SHORT[month]} {year}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 text-sm font-black px-4 py-2.5 rounded-2xl text-[#0A0A0A] transition-all active:scale-95"
            style={{ backgroundColor: limeAccent }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nova
          </button>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {recentTx.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${limeAccent}20` }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: limeAccent }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-semibold">Nenhuma transação este mês</p>
              <button onClick={openCreate} className="mt-2 text-sm font-bold" style={{ color: '#6366f1' }}>Adicionar agora</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentTx.map(t => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: t.type === 'income' ? `${limeAccent}20` : '#FFF1F250' }}>
                    {CAT_ICONS[t.category] ?? '·'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{t.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t.category} · {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <span className={`text-sm font-black flex-shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => openEdit(t)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button onClick={() => handleDelete(t.id)}
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── MODAL CRIAR / EDITAR ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setError(null) } }}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 pt-6 pb-4 bg-[#0A0A0A] flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white">{editingTx ? 'Editar transação' : 'Nova transação'}</h2>
                {editingTx && <p className="text-xs text-gray-400 mt-0.5">{editingTx.description}</p>}
              </div>
              <button onClick={() => { setShowModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-2xl px-4 py-3 font-semibold">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  {(['expense', 'income'] as const).map(type => (
                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, type, category: 'Outros' }))}
                      className={`py-2.5 rounded-xl text-sm font-black transition-all ${form.type === type ? `bg-white shadow-sm ${type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}` : 'text-slate-400'}`}>
                      {type === 'expense' ? 'Despesa' : 'Receita'}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Descrição</label>
                  <input type="text" placeholder="Ex: Mercado, Salário..." required value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent placeholder:font-normal placeholder:text-slate-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Valor</label>
                  <CurrencyInput value={form.amount} placeholder="R$ 0,00" required
                    onChange={v => setForm(f => ({ ...f, amount: v }))}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Categoria</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-white">
                    {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Data</label>
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-2xl text-sm font-black disabled:opacity-50 transition-all active:scale-98"
                  style={{ backgroundColor: form.type === 'expense' ? '#0A0A0A' : '#C9F042', color: form.type === 'expense' ? 'white' : '#0A0A0A' }}>
                  {submitting ? 'Salvando...' : editingTx ? 'Salvar alterações' : 'Salvar transação'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
