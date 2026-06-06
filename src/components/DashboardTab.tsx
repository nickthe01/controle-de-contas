'use client'

import { useState, useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome, Payment } from '@/lib/types'
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
  payments: Payment[]
  onRefresh: () => void
}

const blankForm = () => ({
  description: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category: 'Outros',
  date: new Date().toISOString().split('T')[0],
})

function PayCheck({ paid, onToggle }: { paid: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 active:scale-90"
      style={paid
        ? { backgroundColor: '#C9F042', borderColor: '#C9F042' }
        : { backgroundColor: 'transparent', borderColor: '#CBD5E1' }}>
      {paid && (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#0A0A0A" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
    </button>
  )
}

export default function DashboardTab({ transactions, cards, cardTransactions, bills, salary, extraIncomes, currentDate, payments, onRefresh }: Props) {
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
    const paidBillsTotal = bills.filter(b => b.is_active && payments.some(p => p.reference_type === 'bill' && p.reference_id === b.id)).reduce((s, b) => s + Number(b.amount), 0)
    return { totalIncome, regularExpenses, cardTotal, billsTotal, totalExpenses, freeBalance, pct, paidBillsTotal }
  }, [transactions, cardTransactions, bills, salary, extraIncomes, payments, year, month])

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
      .sort((a, b) => a.daysUntil - b.daysUntil),
    [bills, today])

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
      .slice(0, 8),
    [transactions, year, month])

  function isPaid(type: 'bill' | 'card_tx', id: string) {
    return payments.some(p => p.reference_type === type && p.reference_id === id)
  }

  async function togglePayment(type: 'bill' | 'card_tx', refId: string) {
    const existing = payments.find(p => p.reference_type === type && p.reference_id === refId)
    if (existing) {
      await fetch(`/api/payments/${existing.id}`, { method: 'DELETE' })
    } else {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_type: type, reference_id: refId, year, month }),
      })
    }
    onRefresh()
  }

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
  const LIME = '#C9F042'
  const paidCount = bills.filter(b => b.is_active && isPaid('bill', b.id)).length

  return (
    <div className="space-y-4">

      {/* ── HERO: card escuro ── */}
      <div className="rounded-3xl bg-[#0A0A0A] p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-5" style={{ background: LIME, transform: 'translate(40%,-40%)' }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-5" style={{ background: '#14B8A6', transform: 'translate(-30%,40%)' }} />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.1em]">Saldo Livre</p>
              <p className={`text-[34px] font-black tracking-tight leading-none mt-1 ${summary.freeBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {fmt(summary.freeBalance)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 mt-1">
              <div className="px-3 py-1 rounded-xl text-xs font-bold"
                style={pct < 70 ? { backgroundColor: `${LIME}25`, color: LIME } : pct < 90 ? { backgroundColor: '#F59E0B25', color: '#F59E0B' } : { backgroundColor: '#F43F5E25', color: '#F43F5E' }}>
                {pct}% usado
              </div>
              {paidCount > 0 && (
                <div className="px-2.5 py-1 rounded-xl text-[10px] font-bold" style={{ backgroundColor: `${LIME}15`, color: LIME }}>
                  {paidCount}/{bills.filter(b => b.is_active).length} pago{paidCount > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-4">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#F43F5E' : pct >= 70 ? '#F59E0B' : LIME }} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Renda', value: summary.totalIncome, color: LIME },
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

      {/* ── GRID 2 COLUNAS no desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* COLUNA ESQUERDA */}
        <div className="space-y-4">

          {/* Chart */}
          <div className="rounded-3xl p-5" style={{ backgroundColor: `${LIME}12`, border: `1px solid ${LIME}25` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-slate-900 text-base">Evolução mensal</h2>
                <p className="text-slate-500 text-xs">Renda vs gastos totais</p>
              </div>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                  <span className="w-3 h-1.5 rounded-full inline-block" style={{ backgroundColor: LIME }} />Receitas
                </span>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                  <span className="w-3 h-1.5 rounded-full bg-slate-800 inline-block" />Gastos
                </span>
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-28">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-0.5" style={{ height: '84px' }}>
                    <div className="flex-1 rounded-t-md transition-all"
                      style={{ height: `${Math.max((d.income / maxChart) * 100, d.income > 0 ? 3 : 0)}%`, backgroundColor: d.isCurrent ? LIME : `${LIME}55` }} />
                    <div className="flex-1 rounded-t-md transition-all"
                      style={{ height: `${Math.max((d.expenses / maxChart) * 100, d.expenses > 0 ? 3 : 0)}%`, backgroundColor: d.isCurrent ? '#0A0A0A' : '#0A0A0A35' }} />
                  </div>
                  <span className={`text-[9px] font-bold ${d.isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Categorias */}
          {categoryData.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm">
              <h2 className="font-black text-slate-900 text-base mb-1">Gastos por categoria</h2>
              <p className="text-slate-400 text-xs mb-4">{MONTHS_SHORT[month]} · despesas avulsas</p>
              <div className="space-y-3.5">
                {categoryData.map((cat, i) => (
                  <div key={cat.name} className="grid grid-cols-[20px_1fr_auto_38px] gap-x-3 items-center">
                    <span className="text-[11px] font-bold text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate leading-tight mb-1">{cat.name}</p>
                      <div className="h-1.5 rounded-full overflow-hidden bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.pct}%`, backgroundColor: CAT_COLORS[cat.name] ?? '#94A3B8' }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 text-right">{fmt(cat.value)}</span>
                    <span className="text-xs font-black text-right" style={{ color: CAT_COLORS[cat.name] ?? '#94A3B8' }}>{cat.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA */}
        <div className="space-y-4">

          {/* Boletos com checkboxes de pagamento */}
          {upcomingBills.length > 0 && (
            <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-black text-slate-900 text-base">Boletos do mês</h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {paidCount} de {upcomingBills.length} pago{upcomingBills.length !== 1 ? 's' : ''}
                    {summary.paidBillsTotal > 0 && ` · ${fmt(summary.paidBillsTotal)} quitado`}
                  </p>
                </div>
              </div>

              {/* Progress bar pagamentos */}
              {upcomingBills.length > 0 && (
                <div className="px-5 pb-3">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${upcomingBills.length > 0 ? (paidCount / upcomingBills.length) * 100 : 0}%`, backgroundColor: LIME }} />
                  </div>
                </div>
              )}

              <div className="px-5 pb-2">
                <div className="grid grid-cols-[28px_1fr_auto_auto] gap-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100">
                  <span></span><span>Nome</span><span className="text-right">Vence</span><span className="text-right">Valor</span>
                </div>
              </div>
              <ul className="px-5 pb-4 space-y-3">
                {upcomingBills.map(bill => {
                  const paid = isPaid('bill', bill.id)
                  const urgent = bill.daysUntil <= 3
                  return (
                    <li key={bill.id} className="grid grid-cols-[28px_1fr_auto_auto] gap-x-3 items-center">
                      <PayCheck paid={paid} onToggle={() => togglePayment('bill', bill.id)} />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold truncate leading-tight ${paid ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {bill.description}
                        </p>
                        <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${LIME}25` }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min((Number(bill.amount) / Math.max(...upcomingBills.map(b => Number(b.amount)))) * 100, 100)}%`, backgroundColor: paid ? '#CBD5E1' : LIME }} />
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${urgent && !paid ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                        {bill.daysUntil === 0 ? 'Hoje' : `${bill.daysUntil}d`}
                      </span>
                      <span className={`text-sm font-black text-right ${paid ? 'text-slate-300 line-through' : 'text-slate-900'}`}>
                        {fmt(Number(bill.amount))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Card transactions do mês com checkboxes */}
          {(() => {
            const activeTx = cardTransactions.filter(t => isActiveInMonth(t, year, month))
            if (activeTx.length === 0) return null
            const paidCardCount = activeTx.filter(t => isPaid('card_tx', t.id)).length
            return (
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-black text-slate-900 text-base">Parcelas do cartão</h2>
                    <p className="text-slate-400 text-xs mt-0.5">{paidCardCount} de {activeTx.length} pago{activeTx.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {activeTx.length > 0 && (
                  <div className="px-5 pb-3">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(paidCardCount / activeTx.length) * 100}%`, backgroundColor: '#14B8A6' }} />
                    </div>
                  </div>
                )}
                <ul className="px-5 pb-4 space-y-3">
                  {activeTx.map(t => {
                    const paid = isPaid('card_tx', t.id)
                    const monthly = t.total_amount / t.installments
                    const start = new Date(t.start_date + 'T00:00:00')
                    const installNum = year * 12 + month - (start.getFullYear() * 12 + start.getMonth()) + 1
                    return (
                      <li key={t.id} className="flex items-center gap-3">
                        <PayCheck paid={paid} onToggle={() => togglePayment('card_tx', t.id)} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${paid ? 'line-through text-slate-400' : 'text-slate-800'}`}>{t.description}</p>
                          <p className="text-[10px] text-slate-400">{t.category} · {installNum}/{t.installments}×</p>
                        </div>
                        <span className={`text-sm font-black shrink-0 ${paid ? 'text-slate-300 line-through' : 'text-rose-600'}`}>
                          -{fmt(monthly)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── TRANSAÇÕES ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-black text-slate-900 text-base">Transações do mês</h2>
            <p className="text-slate-400 text-xs">{MONTHS_SHORT[month]} {year}</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 text-sm font-black px-4 py-2.5 rounded-2xl transition-all active:scale-95"
            style={{ backgroundColor: LIME, color: '#0A0A0A' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nova
          </button>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden shadow-sm">
          {recentTx.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${LIME}20` }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke={LIME} strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm font-semibold">Nenhuma transação este mês</p>
              <button onClick={openCreate} className="mt-2 text-sm font-bold text-indigo-600">Adicionar agora</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentTx.map(t => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors group">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg"
                    style={{ backgroundColor: t.type === 'income' ? `${LIME}20` : '#FFF1F2' }}>
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

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setError(null) } }}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 pt-6 pb-4 bg-[#0A0A0A] flex items-center justify-between">
              <h2 className="text-base font-black text-white">{editingTx ? 'Editar transação' : 'Nova transação'}</h2>
              <button onClick={() => { setShowModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20">
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
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent" />
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
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white">
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
                  style={{ backgroundColor: form.type === 'expense' ? '#0A0A0A' : LIME, color: form.type === 'expense' ? 'white' : '#0A0A0A' }}>
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
