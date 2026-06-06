'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome } from '@/lib/types'
import DashboardTab from '@/components/DashboardTab'
import CreditCardTab from '@/components/CreditCardTab'
import BillsTab from '@/components/BillsTab'
import SalaryTab from '@/components/SalaryTab'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Tab = 'dashboard' | 'cartao' | 'boletos' | 'salario'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Início' },
  { id: 'cartao', label: 'Cartão' },
  { id: 'boletos', label: 'Boletos' },
  { id: 'salario', label: 'Salário' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  const endMonth = startMonth + t.installments - 1
  return targetMonth >= startMonth && targetMonth <= endMonth
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [currentDate, setCurrentDate] = useState(new Date())

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [cardTransactions, setCardTransactions] = useState<CreditCardTransaction[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [salary, setSalary] = useState<SalaryConfig | null>(null)
  const [extraIncomes, setExtraIncomes] = useState<ExtraIncome[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [txRes, cardsRes, cardTxRes, billsRes, salaryRes, extraRes] = await Promise.all([
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/credit-cards').then(r => r.json()),
      fetch('/api/credit-card-transactions').then(r => r.json()),
      fetch('/api/bills').then(r => r.json()),
      fetch('/api/salary').then(r => r.json()),
      fetch('/api/extra-income').then(r => r.json()),
    ])
    setTransactions(Array.isArray(txRes) ? txRes : [])
    setCards(Array.isArray(cardsRes) ? cardsRes : [])
    setCardTransactions(Array.isArray(cardTxRes) ? cardTxRes : [])
    setBills(Array.isArray(billsRes) ? billsRes : [])
    setSalary(salaryRes ?? null)
    setExtraIncomes(Array.isArray(extraRes) ? extraRes : [])
    setLoading(false)
  }

  function prevMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  // Cálculo de alertas
  const alertInfo = useMemo(() => {
    if (!salary || salary.fixed_amount <= 0) return null

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const extraThisMonth = extraIncomes
      .filter(e => { const d = new Date(e.date + 'T00:00:00'); return d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, e) => s + Number(e.amount), 0)

    const totalIncome = salary.fixed_amount + extraThisMonth

    const regularExpenses = transactions
      .filter(t => { const d = new Date(t.date + 'T00:00:00'); return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year })
      .reduce((s, t) => s + Number(t.amount), 0)

    const cardTotal = cardTransactions
      .filter(t => isActiveInMonth(t, year, month))
      .reduce((s, t) => s + (t.total_amount / t.installments), 0)

    const billsTotal = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)

    const totalExpenses = regularExpenses + cardTotal + billsTotal
    const pct = totalExpenses / totalIncome

    if (pct >= 1) return {
      level: 'danger' as const,
      message: `Atenção! Seus gastos (${formatCurrency(totalExpenses)}) superam sua renda (${formatCurrency(totalIncome)}) este mês.`,
      detail: `Cartão: ${formatCurrency(cardTotal)} · Boletos: ${formatCurrency(billsTotal)} · Despesas: ${formatCurrency(regularExpenses)}`
    }
    if (pct >= 0.85) return {
      level: 'warning' as const,
      message: `Cuidado! Você já comprometeu ${Math.round(pct * 100)}% da sua renda este mês.`,
      detail: `Cartão: ${formatCurrency(cardTotal)} · Boletos: ${formatCurrency(billsTotal)} · Despesas: ${formatCurrency(regularExpenses)}`
    }
    return null
  }, [salary, extraIncomes, transactions, cardTransactions, bills, currentDate])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Controle de Contas</h1>
          <nav className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Alerta de gastos */}
        {alertInfo && (
          <div className={`rounded-xl px-4 py-3 border ${
            alertInfo.level === 'danger'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-orange-50 border-orange-200 text-orange-800'
          }`}>
            <p className="text-sm font-semibold">{alertInfo.message}</p>
            <p className="text-xs mt-1 opacity-75">{alertInfo.detail}</p>
          </div>
        )}

        {/* Navegação de mês */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600 text-2xl">
            ‹
          </button>
          <span className="text-base font-semibold text-gray-800 w-48 text-center">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600 text-2xl">
            ›
          </button>
        </div>

        {loading ? (
          <div className="py-24 text-center text-gray-400 text-sm">Carregando...</div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <DashboardTab
                transactions={transactions}
                currentDate={currentDate}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'cartao' && (
              <CreditCardTab
                cards={cards}
                transactions={cardTransactions}
                currentDate={currentDate}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'boletos' && (
              <BillsTab
                bills={bills}
                currentDate={currentDate}
                onRefresh={fetchAll}
              />
            )}
            {tab === 'salario' && (
              <SalaryTab
                salary={salary}
                extraIncomes={extraIncomes}
                currentDate={currentDate}
                onRefresh={fetchAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}
