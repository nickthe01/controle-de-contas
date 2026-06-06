'use client'

import { useState, useEffect } from 'react'
import type { Transaction, CreditCard, CreditCardTransaction, Bill, SalaryConfig, ExtraIncome, Payment } from '@/lib/types'
import DashboardTab from '@/components/DashboardTab'
import CreditCardTab from '@/components/CreditCardTab'
import BillsTab from '@/components/BillsTab'
import SalaryTab from '@/components/SalaryTab'
import ReportsTab from '@/components/ReportsTab'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const LIME = '#C9F042'

type Tab = 'dashboard' | 'cartao' | 'boletos' | 'salario' | 'relatorios'

const NAV_ITEMS: { id: Tab; label: string; path: string }[] = [
  { id: 'dashboard',  label: 'Início',     path: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25' },
  { id: 'cartao',     label: 'Cartão',     path: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z' },
  { id: 'boletos',    label: 'Boletos',    path: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z' },
  { id: 'salario',    label: 'Salário',    path: 'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3m18-3V6m0 3H3' },
  { id: 'relatorios', label: 'Relatórios', path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
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
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  // Re-fetch payments when month changes (without full reload)
  useEffect(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()
    fetch(`/api/payments?year=${y}&month=${m}`)
      .then(r => r.json())
      .then(d => setPayments(Array.isArray(d) ? d : []))
  }, [currentDate])

  async function fetchAll() {
    setLoading(true)
    try {
      const y = currentDate.getFullYear()
      const m = currentDate.getMonth()
      const [txRes, cardsRes, cardTxRes, billsRes, salaryRes, extraRes, payRes] = await Promise.all([
        fetch('/api/transactions').then(r => r.json()),
        fetch('/api/credit-cards').then(r => r.json()),
        fetch('/api/credit-card-transactions').then(r => r.json()),
        fetch('/api/bills').then(r => r.json()),
        fetch('/api/salary').then(r => r.json()),
        fetch('/api/extra-income').then(r => r.json()),
        fetch(`/api/payments?year=${y}&month=${m}`).then(r => r.json()),
      ])
      setTransactions(Array.isArray(txRes) ? txRes : [])
      setCards(Array.isArray(cardsRes) ? cardsRes : [])
      setCardTransactions(Array.isArray(cardTxRes) ? cardTxRes : [])
      setBills(Array.isArray(billsRes) ? billsRes : [])
      setSalary(salaryRes && !salaryRes.error ? salaryRes : null)
      setExtraIncomes(Array.isArray(extraRes) ? extraRes : [])
      setPayments(Array.isArray(payRes) ? payRes : [])
    } finally {
      setLoading(false)
    }
  }

  function prevMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F2F5' }}>

      {/* ── HEADER ESCURO ── */}
      <header className="sticky top-0 z-10" style={{ backgroundColor: '#0A0A0A' }}>
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
              style={{ backgroundColor: LIME, color: '#0A0A0A' }}>C</div>
            <div>
              <span className="font-black text-white text-sm block leading-tight tracking-tight">
                Conta<span style={{ color: LIME }}>+</span>
              </span>
              <span className="text-[10px] font-medium hidden sm:block" style={{ color: '#6B7280' }}>Gestão financeira</span>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-2xl px-1 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10" style={{ color: '#9CA3AF' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-xs font-bold text-white w-20 text-center">
              {MONTHS[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}
            </span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-xl transition-colors hover:bg-white/10" style={{ color: '#9CA3AF' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <div className="px-4 lg:px-8 flex gap-1 pb-3 overflow-x-auto scrollbar-none">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
              style={tab === item.id
                ? { backgroundColor: LIME, color: '#0A0A0A' }
                : { color: '#6B7280' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
              </svg>
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="px-4 lg:px-8 py-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ backgroundColor: LIME }}>
              <div className="w-5 h-5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-400">Carregando...</p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <DashboardTab transactions={transactions} cards={cards} cardTransactions={cardTransactions}
                bills={bills} salary={salary} extraIncomes={extraIncomes} currentDate={currentDate}
                payments={payments} onRefresh={fetchAll} />
            )}
            {tab === 'cartao' && (
              <CreditCardTab cards={cards} transactions={cardTransactions} currentDate={currentDate}
                payments={payments} onRefresh={fetchAll} />
            )}
            {tab === 'boletos' && (
              <BillsTab bills={bills} currentDate={currentDate}
                payments={payments} onRefresh={fetchAll} />
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
    </div>
  )
}
