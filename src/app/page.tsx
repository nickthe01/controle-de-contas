'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome } from '@/lib/types'
import DashboardTab from '@/components/DashboardTab'
import CreditCardTab from '@/components/CreditCardTab'
import BillsTab from '@/components/BillsTab'
import SalaryTab from '@/components/SalaryTab'
import ReportsTab from '@/components/ReportsTab'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Tab = 'dashboard' | 'cartao' | 'boletos' | 'salario' | 'relatorios'

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  return targetMonth >= startMonth && targetMonth <= startMonth + t.installments - 1
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function CardIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  )
}

function DocIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  )
}

function WalletIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3m18-3V6m0 3H3" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
}

const TABS: { id: Tab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
  { id: 'dashboard',  label: 'Início',     icon: (a) => <HomeIcon active={a} /> },
  { id: 'cartao',     label: 'Cartão',     icon: (a) => <CardIcon active={a} /> },
  { id: 'boletos',    label: 'Boletos',    icon: (a) => <DocIcon active={a} /> },
  { id: 'salario',    label: 'Salário',    icon: (a) => <WalletIcon active={a} /> },
  { id: 'relatorios', label: 'Relatórios', icon: (a) => <ChartIcon active={a} /> },
]

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
    try {
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
      setSalary(salaryRes && !salaryRes.error ? salaryRes : null)
      setExtraIncomes(Array.isArray(extraRes) ? extraRes : [])
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

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
    const cardTotal = cardTransactions.filter(t => isActiveInMonth(t, year, month)).reduce((s, t) => s + t.total_amount / t.installments, 0)
    const billsTotal = bills.filter(b => b.is_active).reduce((s, b) => s + Number(b.amount), 0)
    const totalExpenses = regularExpenses + cardTotal + billsTotal
    const pct = totalExpenses / totalIncome
    if (pct >= 1) return { level: 'danger' as const, message: `Seus gastos (${formatCurrency(totalExpenses)}) superam sua renda este mês!`, detail: `Cartão: ${formatCurrency(cardTotal)} · Boletos: ${formatCurrency(billsTotal)} · Despesas: ${formatCurrency(regularExpenses)}` }
    if (pct >= 0.85) return { level: 'warning' as const, message: `Atenção: ${Math.round(pct * 100)}% da sua renda já foi comprometida este mês.`, detail: `Cartão: ${formatCurrency(cardTotal)} · Boletos: ${formatCurrency(billsTotal)} · Despesas: ${formatCurrency(regularExpenses)}` }
    return null
  }, [salary, extraIncomes, transactions, cardTransactions, bills, currentDate])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-gray-900 text-sm block leading-tight">Controle de Contas</span>
                <span className="text-[10px] text-gray-400 font-medium">Gestão financeira pessoal</span>
              </div>
            </div>
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-xl p-0.5">
              <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-gray-500 hover:text-gray-700 hover:shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="text-xs font-bold text-gray-700 w-24 text-center">
                {MONTHS[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white transition-colors text-gray-500 hover:text-gray-700 hover:shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Alert */}
      {alertInfo && (
        <div className={`border-b px-4 py-3 ${alertInfo.level === 'danger' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="max-w-2xl mx-auto flex gap-3 items-start">
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${alertInfo.level === 'danger' ? 'bg-rose-500' : 'bg-amber-500'}`}>
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <div>
              <p className={`text-sm font-semibold ${alertInfo.level === 'danger' ? 'text-rose-800' : 'text-amber-800'}`}>{alertInfo.message}</p>
              <p className={`text-xs mt-0.5 ${alertInfo.level === 'danger' ? 'text-rose-600' : 'text-amber-600'}`}>{alertInfo.detail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Carregando...</p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <DashboardTab transactions={transactions} cards={cards} cardTransactions={cardTransactions}
                bills={bills} salary={salary} extraIncomes={extraIncomes} currentDate={currentDate} onRefresh={fetchAll} />
            )}
            {tab === 'cartao' && (
              <CreditCardTab cards={cards} transactions={cardTransactions} currentDate={currentDate} onRefresh={fetchAll} />
            )}
            {tab === 'boletos' && (
              <BillsTab bills={bills} currentDate={currentDate} onRefresh={fetchAll} />
            )}
            {tab === 'salario' && (
              <SalaryTab salary={salary} extraIncomes={extraIncomes} currentDate={currentDate} onRefresh={fetchAll} />
            )}
            {tab === 'relatorios' && (
              <ReportsTab transactions={transactions} cards={cards} cardTransactions={cardTransactions}
                bills={bills} salary={salary} extraIncomes={extraIncomes} currentDate={currentDate} />
            )}
          </>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 z-20 safe-area-bottom shadow-lg shadow-black/5">
        <div className="max-w-2xl mx-auto flex px-2 py-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-2xl transition-all duration-200 relative ${
                tab === t.id ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-500'
              }`}>
              {tab === t.id && <span className="absolute inset-0 bg-indigo-50 rounded-2xl" />}
              <span className="relative">{t.icon(tab === t.id)}</span>
              <span className={`text-[9px] font-bold tracking-wide relative ${tab === t.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
