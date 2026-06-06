'use client'

import { useState, useMemo } from 'react'
import type { Transaction } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Transferência', 'Outros']
const EXPENSE_CATEGORIES = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Transferência', 'Outros']

const CATEGORY_ICONS: Record<string, string> = {
  Alimentação: '🍽️', Moradia: '🏠', Transporte: '🚗', Saúde: '❤️',
  Educação: '📚', Lazer: '🎬', Compras: '🛍️', Salário: '💼',
  Freelance: '💻', Investimentos: '📈', Transferência: '↔️', Outros: '•',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

const defaultForm = () => ({
  description: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category: 'Outros',
  date: new Date().toISOString().split('T')[0],
})

interface Props {
  transactions: Transaction[]
  currentDate: Date
  onRefresh: () => void
}

export default function DashboardTab({ transactions, currentDate, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredTransactions = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00')
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    }), [transactions, currentDate])

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { income, expense, balance: income - expense }
  }, [filteredTransactions])

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

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="space-y-4">
      {/* Resumo principal */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Saldo do mês</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(totals.balance)}</p>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs opacity-70 font-medium">Receitas</span>
            </div>
            <p className="text-lg font-bold text-emerald-300">{formatCurrency(totals.income)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-xs opacity-70 font-medium">Despesas</span>
            </div>
            <p className="text-lg font-bold text-rose-300">{formatCurrency(totals.expense)}</p>
          </div>
        </div>
      </div>

      {/* Header da lista + botão */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">Transações</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova
        </button>
      </div>

      {/* Lista de transações */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhuma transação este mês</p>
            <button onClick={() => setShowModal(true)} className="mt-2 text-indigo-600 text-sm font-semibold hover:underline">
              Adicionar primeira transação
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {filteredTransactions.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors group">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${t.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  {CATEGORY_ICONS[t.category] ?? '•'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.category} · {formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
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
              {/* Tipo */}
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
