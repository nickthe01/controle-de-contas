'use client'

import { useState, useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Transferência', 'Outros']
const EXPENSE_CATEGORIES = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Transferência', 'Outros']

const CATEGORY_ICONS: Record<string, string> = {
  Alimentação: '🍽️', Moradia: '🏠', Transporte: '🚗', Saúde: '❤️',
  Educação: '📚', Lazer: '🎬', Compras: '🛍️', Salário: '💼',
  Freelance: '💻', Investimentos: '📈', Transferência: '↔️', Outros: '•',
}

function fmt(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function fmtDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  return targetMonth >= startMonth && targetMonth <= startMonth + t.installments - 1
}

interface BarChartData {
  month: string
  income: number
  expense: number
}

function BarChart({ data }: { data: BarChartData[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]), 1)
  return (
    <div className="flex items-end gap-2 h-28 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex gap-0.5 items-end" style={{ height: '88px' }}>
            <div
              className="flex-1 bg-emerald-400 rounded-t-sm transition-all min-h-[2px]"
              style={{ height: `${Math.max((d.income / maxVal) * 100, 2)}%` }}
            />
            <div
              className="flex-1 bg-rose-400 rounded-t-sm transition-all min-h-[2px]"
              style={{ height: `${Math.max((d.expense / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-400 font-medium leading-none">{d.month}</span>
        </div>
      ))}
    </div>
  )
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

const defaultForm = () => ({
  description: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category: 'Outros',
  date: new Date().toISOString().split('T')[0],
})

export default function DashboardTab({ transactions, cards, cardTransactions, bills, salary, extraIncomes, currentDate, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date().getDate()

  // Cálculos do mês atual cruzando todas as fontes
  const summary = useMemo(() => {
    const extraThisMonth = extraIncomes
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, e) => s + Number(e.amount), 0)

    const totalIncome = (salary?.fixed_amount ?? 0) + extraThisMonth

    const regularExpenses = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, t) => s + Number(t.amount), 0)

    const regularIncome = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'income' && d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, t) => s + Number(t.amount), 0)

    const cardTotal = cardTransactions
      .filter(t => isActiveInMonth(t, year, month))
      .reduce((s, t) => s + t.total_amount / t.installments, 0)

    const billsTotal = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)

    const totalExpenses = regularExpenses + cardTotal + billsTotal
    const freeBalance = totalIncome - totalExpenses
    const pct = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0

    return { totalIncome, extraThisMonth, regularExpenses, regularIncome, cardTotal, billsTotal, totalExpenses, freeBalance, pct }
  }, [transactions, cardTransactions, bills, salary, extraIncomes, year, month])

  // Últimas transações do mês
  const recentTransactions = useMemo(() =>
    transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [transactions, year, month])

  // Gráfico: últimos 6 meses
  const chartData: BarChartData[] = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month - 5 + i, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const monthTx = transactions.filter(t => {
        const td = new Date(t.date + 'T00:00:00')
        return td.getMonth() === m && td.getFullYear() === y
      })
      return {
        month: MONTHS_SHORT[m],
        income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
        expense: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      }
    })
  }, [transactions, year, month])

  // Boletos urgentes (próximos do vencimento)
  const urgentBills = useMemo(() => {
    return bills
      .filter(b => b.is_active)
      .map(b => ({ ...b, daysUntil: b.due_day >= today ? b.due_day - today : 31 - today + b.due_day }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3)
  }, [bills, today])

  // Estimativa próximos 4 meses
  const forecast = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(year, month + i + 1, 1)
      const fm = d.getMonth()
      const fy = d.getFullYear()
      const projectedCard = cardTransactions
        .filter(t => isActiveInMonth(t, fy, fm))
        .reduce((s, t) => s + t.total_amount / t.installments, 0)
      const projectedBills = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
      const projectedIncome = salary?.fixed_amount ?? 0
      const projectedExpenses = projectedCard + projectedBills
      return {
        label: `${MONTHS_SHORT[fm]}/${fy}`,
        income: projectedIncome,
        expenses: projectedExpenses,
        balance: projectedIncome - projectedExpenses,
      }
    }).filter(f => f.income > 0 || f.expenses > 0)
  }, [cardTransactions, bills, salary, year, month])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseCurrency(form.amount) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar transação.')
      setSubmitting(false)
      return
    }
    await onRefresh()
    setShowModal(false)
    setForm(defaultForm())
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta transação?')) return
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  const balanceColor = summary.freeBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'
  const pctColor = summary.pct >= 100 ? 'bg-rose-500' : summary.pct >= 85 ? 'bg-amber-500' : 'bg-emerald-400'

  function getBillStatus(daysUntil: number) {
    if (daysUntil <= 0) return { label: 'Vencido', bg: 'bg-rose-100', text: 'text-rose-700' }
    if (daysUntil === 0) return { label: 'Hoje', bg: 'bg-orange-100', text: 'text-orange-700' }
    if (daysUntil <= 5) return { label: `${daysUntil}d`, bg: 'bg-amber-100', text: 'text-amber-700' }
    return { label: `${daysUntil}d`, bg: 'bg-gray-100', text: 'text-gray-500' }
  }

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="space-y-4">

      {/* ── Hero: saldo livre cruzado ── */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Saldo livre do mês</p>
        <p className={`text-4xl font-bold tracking-tight ${balanceColor}`}>{fmt(summary.freeBalance)}</p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs opacity-60 mb-1.5">
            <span>Comprometido do salário</span>
            <span>{Math.round(summary.pct)}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full ${pctColor} rounded-full transition-all`}
              style={{ width: `${summary.pct}%` }}
            />
          </div>
        </div>

        {/* Mini stats 2x2 */}
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Renda total</p>
            <p className="text-base font-bold text-emerald-300">{fmt(summary.totalIncome)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Despesas avulsas</p>
            <p className="text-base font-bold text-rose-300">{fmt(summary.regularExpenses)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Cartões (mês)</p>
            <p className="text-base font-bold text-orange-300">{fmt(summary.cardTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Boletos</p>
            <p className="text-base font-bold text-pink-300">{fmt(summary.billsTotal)}</p>
          </div>
        </div>
      </div>

      {/* ── Gráfico últimos 6 meses ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-800 text-sm">Histórico (6 meses)</h2>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Receitas</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" /> Despesas</span>
          </div>
        </div>
        <BarChart data={chartData} />
      </div>

      {/* ── Estimativa futura ── */}
      {forecast.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Estimativa próximos meses</h2>
            <p className="text-xs text-gray-400 mt-0.5">Salário vs boletos + parcelas comprometidas</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {forecast.map((f, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                <span className="text-sm font-semibold text-gray-600 w-16 flex-shrink-0">{f.label}</span>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${f.balance < 0 ? 'bg-rose-400' : f.balance / (f.income || 1) < 0.15 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: f.income > 0 ? `${Math.min((f.expenses / f.income) * 100, 100)}%` : '100%' }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Fixos: {fmt(f.expenses)} · Renda: {fmt(f.income)}
                  </p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${f.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {f.balance >= 0 ? '+' : ''}{fmt(f.balance)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Boletos urgentes ── */}
      {urgentBills.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Boletos próximos</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {urgentBills.map(bill => {
              const status = getBillStatus(bill.daysUntil)
              return (
                <li key={bill.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 text-base">
                    📄
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{bill.description}</p>
                    <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{fmt(Number(bill.amount))}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Transações recentes ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">Transações do mês</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {recentTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhuma transação este mês</p>
            <button onClick={() => setShowModal(true)} className="mt-2 text-indigo-600 text-sm font-semibold hover:underline">
              Adicionar transação
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentTransactions.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${t.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {CATEGORY_ICONS[t.category] ?? '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.category} · {fmtDate(t.date)}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                </span>
                <button onClick={() => handleDelete(t.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 ml-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal nova transação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nova transação</h2>
              <button onClick={() => { setShowModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'Outros' }))}
                  className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${form.type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-400'}`}>
                  Despesa
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Outros' }))}
                  className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${form.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>
                  Receita
                </button>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                <input type="text" placeholder="Ex: Mercado, Salário..." required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor</label>
                <CurrencyInput value={form.amount} placeholder="R$ 0,00" required
                  onChange={v => setForm(f => ({ ...f, amount: v }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Categoria</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Data</label>
                <input type="date" required value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <button type="submit" disabled={submitting}
                className={`w-full py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors mt-2 ${form.type === 'expense' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                {submitting ? 'Salvando...' : 'Salvar transação'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
