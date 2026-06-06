'use client'

import { useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome } from '@/lib/types'

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CAT_COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-orange-500',
]

const CAT_LIGHT = [
  'bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700', 'bg-purple-100 text-purple-700', 'bg-cyan-100 text-cyan-700',
  'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700',
]

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  return targetMonth >= startMonth && targetMonth <= startMonth + t.installments - 1
}

interface Props {
  transactions: Transaction[]
  cards: CreditCard[]
  cardTransactions: CreditCardTransaction[]
  bills: Bill[]
  salary: SalaryConfig | null
  extraIncomes: ExtraIncome[]
  currentDate: Date
}

export default function ReportsTab({ transactions, cards, cardTransactions, bills, salary, extraIncomes, currentDate }: Props) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // ── Saúde financeira atual
  const health = useMemo(() => {
    const extraThisMonth = extraIncomes
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, e) => s + Number(e.amount), 0)
    const totalIncome = (salary?.fixed_amount ?? 0) + extraThisMonth
    const regularExpenses = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, t) => s + Number(t.amount), 0)
    const cardTotal = cardTransactions
      .filter(t => isActiveInMonth(t, year, month))
      .reduce((s, t) => s + t.total_amount / t.installments, 0)
    const billsTotal = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
    const totalExpenses = regularExpenses + cardTotal + billsTotal
    const freeBalance = totalIncome - totalExpenses
    const pct = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0
    return { totalIncome, totalExpenses, freeBalance, pct, regularExpenses, cardTotal, billsTotal }
  }, [transactions, cardTransactions, bills, salary, extraIncomes, year, month])

  // ── Previsão 6 meses
  const forecast = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(year, month + i, 1)
      const fm = d.getMonth(); const fy = d.getFullYear()
      const cardExp = cardTransactions.filter(t => isActiveInMonth(t, fy, fm)).reduce((s, t) => s + t.total_amount / t.installments, 0)
      const billsExp = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
      const income = salary?.fixed_amount ?? 0
      const fixed = cardExp + billsExp
      return { label: `${MONTHS_SHORT[fm]}/${fy}`, income, fixed, card: cardExp, billsTotal: billsExp, balance: income - fixed, isCurrent: fm === month && fy === year }
    }),
    [cardTransactions, bills, salary, year, month])

  // ── Quitação de boletos (carnês com total_months)
  const billsTimeline = useMemo(() => {
    const now = year * 12 + month
    return bills
      .map(bill => {
        if (!bill.total_months) return { ...bill, kind: 'ongoing' as const, endLabel: 'Sem prazo', monthsLeft: null, pct: null, endMonthIndex: Infinity }
        const created = new Date(bill.created_at)
        const startM = created.getFullYear() * 12 + created.getMonth()
        const endM = startM + bill.total_months - 1
        const endDate = new Date(created.getFullYear(), created.getMonth() + bill.total_months - 1, 1)
        const monthsLeft = endM - now
        const currentMonth = Math.max(now - startM + 1, 1)
        const pct = Math.min((currentMonth / bill.total_months) * 100, 100)
        return {
          ...bill,
          kind: monthsLeft < 0 ? 'done' as const : 'installment' as const,
          endLabel: monthsLeft < 0 ? 'Quitado!' : `${MONTHS_SHORT[endDate.getMonth()]}/${endDate.getFullYear()}`,
          monthsLeft: Math.max(monthsLeft, 0),
          pct,
          endMonthIndex: endM,
          remaining: monthsLeft >= 0 ? monthsLeft + 1 : 0,
          totalValue: bill.total_months * Number(bill.amount),
          paidValue: Math.min(currentMonth, bill.total_months) * Number(bill.amount),
        }
      })
      .sort((a, b) => (a.endMonthIndex ?? Infinity) - (b.endMonthIndex ?? Infinity))
  }, [bills, year, month])

  // ── Quitação de parcelas de cartão
  const cardPayoff = useMemo(() => {
    const now = year * 12 + month
    const active = cardTransactions.filter(t => {
      const start = new Date(t.start_date + 'T00:00:00')
      const startM = start.getFullYear() * 12 + start.getMonth()
      return startM + t.installments - 1 >= now && t.installments > 1
    })
    const byEnd: Record<string, { label: string; items: Array<{ desc: string; monthly: number; remaining: number }> }> = {}
    active.forEach(t => {
      const start = new Date(t.start_date + 'T00:00:00')
      const startM = start.getFullYear() * 12 + start.getMonth()
      const endM = startM + t.installments - 1
      const endDate = new Date(Math.floor(endM / 12), endM % 12, 1)
      const key = `${endDate.getFullYear()}-${String(endDate.getMonth()).padStart(2, '0')}`
      const label = `${MONTHS_SHORT[endDate.getMonth()]}/${endDate.getFullYear()}`
      const remaining = endM - now + 1
      if (!byEnd[key]) byEnd[key] = { label, items: [] }
      const card = cards.find(c => c.id === t.card_id)
      byEnd[key].items.push({ desc: `${t.description}${card ? ` (${card.name})` : ''}`, monthly: t.total_amount / t.installments, remaining })
    })
    return Object.entries(byEnd).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [cardTransactions, cards, year, month])

  // ── Gastos por categoria (mês atual)
  const categoryBreakdown = useMemo(() => {
    const expenses = transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00')
      return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year
    })
    const groups: Record<string, number> = {}
    expenses.forEach(t => { groups[t.category] = (groups[t.category] ?? 0) + Number(t.amount) })
    const total = Object.values(groups).reduce((s, v) => s + v, 0)
    return { items: Object.entries(groups).sort(([, a], [, b]) => b - a).map(([cat, val]) => ({ cat, val, pct: total > 0 ? (val / total) * 100 : 0 })), total }
  }, [transactions, year, month])

  const healthLabel = health.pct >= 100 ? 'Crítico' : health.pct >= 85 ? 'Atenção' : health.pct >= 60 ? 'Moderado' : 'Saudável'
  const healthEmoji = health.pct >= 100 ? '🔴' : health.pct >= 85 ? '🟡' : health.pct >= 60 ? '🟠' : '🟢'
  const healthBarColor = health.pct >= 100 ? 'bg-rose-500' : health.pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
  const healthTextColor = health.pct >= 100 ? 'text-rose-600' : health.pct >= 85 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="space-y-4">

      {/* ── Hero: Saúde financeira ── */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Saúde financeira</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{healthEmoji}</span>
                <span className={`text-xl font-bold ${health.pct >= 100 ? 'text-rose-300' : health.pct >= 85 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {healthLabel}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-50 mb-0.5">Saldo livre</p>
              <p className={`text-xl font-bold ${health.freeBalance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {fmt(health.freeBalance)}
              </p>
            </div>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-xs opacity-60 mb-1.5">
              <span>Comprometido do salário</span>
              <span className="font-bold">{Math.round(health.pct)}%</span>
            </div>
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full ${healthBarColor} rounded-full transition-all`} style={{ width: `${health.pct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/10">
            <div className="text-center">
              <p className="text-base font-bold text-emerald-300">{fmt(health.totalIncome)}</p>
              <p className="text-[10px] opacity-50 mt-0.5">Renda</p>
            </div>
            <div className="text-center border-x border-white/10">
              <p className="text-base font-bold text-rose-300">{fmt(health.totalExpenses)}</p>
              <p className="text-[10px] opacity-50 mt-0.5">Gastos totais</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-amber-300">{fmt(health.billsTotal + health.cardTotal)}</p>
              <p className="text-[10px] opacity-50 mt-0.5">Fixos</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Previsão 6 meses ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-sm">Previsão para os próximos meses</h2>
          <p className="text-xs text-gray-400 mt-0.5">Salário × (boletos + parcelas comprometidas)</p>
        </div>
        <div className="divide-y divide-gray-50">
          {forecast.map((f, i) => (
            <div key={i} className={`px-4 py-3.5 ${f.isCurrent ? 'bg-indigo-50/60' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${f.isCurrent ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {f.label.split('/')[0]}
                  <br />
                  <span className="text-[8px] opacity-70">{f.label.split('/')[1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-gray-500">Renda: <span className="font-semibold text-gray-700">{fmt(f.income)}</span></span>
                    <span className={`text-sm font-bold ${f.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {f.balance >= 0 ? '+' : ''}{fmt(f.balance)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${f.balance < 0 ? 'bg-rose-400' : f.balance / (f.income || 1) < 0.15 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: f.income > 0 ? `${Math.min((f.fixed / f.income) * 100, 100)}%` : '100%' }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-gray-400">Cartão: {fmt(f.card)}</span>
                    <span className="text-[10px] text-gray-400">Boletos: {fmt(f.billsTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quitação de carnês ── */}
      {billsTimeline.some(b => b.kind === 'installment' || b.kind === 'done') && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Prazo de quitação — Boletos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Carnês e contas com prazo definido</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {billsTimeline.filter(b => b.kind !== 'ongoing').map(bill => (
              <li key={bill.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${bill.kind === 'done' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                    {bill.kind === 'done' ? '✅' : '📅'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-gray-800 truncate">{bill.description}</p>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${bill.kind === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {bill.endLabel}
                      </span>
                    </div>
                    {bill.kind === 'installment' && bill.pct !== null && (
                      <>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1.5 mb-1">
                          <span>{bill.remaining} {bill.remaining === 1 ? 'mês restante' : 'meses restantes'}</span>
                          <span>{Math.round(bill.pct)}% pago</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${bill.pct}%` }} />
                        </div>
                        {bill.totalValue && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Pago: {fmt(bill.paidValue ?? 0)} de {fmt(bill.totalValue)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Quitação de parcelas de cartão ── */}
      {cardPayoff.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Parcelas de cartão — Fim previsto</h2>
            <p className="text-xs text-gray-400 mt-0.5">Quando cada grupo de parcelas termina</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {cardPayoff.map((group, i) => (
              <li key={i} className="px-4 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-rose-600">{group.label.split('/')[0]}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700">Término em {group.label}</span>
                  </div>
                  <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                    {group.items.length} parcela{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <ul className="space-y-1 pl-9">
                  {group.items.map((item, j) => (
                    <li key={j} className="flex items-center justify-between text-xs text-gray-500">
                      <span className="truncate mr-2">{item.desc}</span>
                      <span className="font-semibold text-gray-700 flex-shrink-0">{fmt(item.monthly)}/mês · {item.remaining}x</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Gastos por categoria ── */}
      {categoryBreakdown.items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 text-sm">Gastos por categoria este mês</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total: {fmt(categoryBreakdown.total)}</p>
          </div>

          {/* Mini bar chart visual */}
          <div className="px-4 pt-4 pb-2 flex items-end gap-1.5 h-24">
            {categoryBreakdown.items.slice(0, 8).map((item, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full ${CAT_COLORS[i % CAT_COLORS.length]} rounded-t-sm min-h-[4px] transition-all`}
                  style={{ height: `${Math.max((item.pct / 100) * 64, 4)}px` }} />
              </div>
            ))}
          </div>

          <ul className="divide-y divide-gray-50 px-0">
            {categoryBreakdown.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${CAT_LIGHT[i % CAT_LIGHT.length]}`}>
                  {item.cat}
                </span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${CAT_COLORS[i % CAT_COLORS.length]} rounded-full`} style={{ width: `${item.pct}%` }} />
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-gray-700">{fmt(item.val)}</span>
                  <span className="text-[10px] text-gray-400 ml-1">{Math.round(item.pct)}%</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Dicas financeiras ── */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-4 space-y-3">
        <h2 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
          <span>💡</span> Análise rápida
        </h2>
        {health.pct >= 100 && (
          <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-100 rounded-xl p-3">
            <span className="text-base flex-shrink-0">🚨</span>
            <p className="text-xs text-rose-700 font-medium">Seus gastos superam sua renda. Revise despesas ou boletos desativados para equilibrar o orçamento.</p>
          </div>
        )}
        {health.pct >= 85 && health.pct < 100 && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <span className="text-base flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 font-medium">Mais de 85% da renda já está comprometida. Evite novos parcelamentos por enquanto.</p>
          </div>
        )}
        {cardPayoff.length > 0 && (
          <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
            <span className="text-base flex-shrink-0">💳</span>
            <p className="text-xs text-indigo-700 font-medium">
              Você tem parcelas de cartão que terminam até {cardPayoff[cardPayoff.length - 1]?.label}. Após isso, {fmt(cardPayoff[cardPayoff.length - 1]?.items.reduce((s, i) => s + i.monthly, 0) ?? 0)}/mês ficam livres no orçamento.
            </p>
          </div>
        )}
        {billsTimeline.some(b => b.kind === 'installment' && (b as any).remaining <= 3) && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <span className="text-base flex-shrink-0">🏁</span>
            <p className="text-xs text-emerald-700 font-medium">
              {billsTimeline.filter(b => b.kind === 'installment' && (b as any).remaining <= 3).map(b => b.description).join(', ')} {billsTimeline.filter(b => b.kind === 'installment' && (b as any).remaining <= 3).length === 1 ? 'quita' : 'quitam'} em breve!
            </p>
          </div>
        )}
        {health.pct < 60 && health.totalIncome > 0 && (
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <span className="text-base flex-shrink-0">✅</span>
            <p className="text-xs text-emerald-700 font-medium">Finanças equilibradas! Menos de 60% da renda comprometida. Ótimo momento para investir a diferença.</p>
          </div>
        )}
      </div>
    </div>
  )
}
