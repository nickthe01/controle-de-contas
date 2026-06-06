'use client'

import { useState, useMemo } from 'react'
import type { Transaction } from '@/lib/types'

const INCOME_CATEGORIES = ['Salário', 'Freelance', 'Investimentos', 'Transferência', 'Outros']
const EXPENSE_CATEGORIES = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Transferência', 'Outros']

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

  const filteredTransactions = useMemo(() =>
    transactions.filter(t => {
      const d = new Date(t.date + 'T00:00:00')
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    }),
    [transactions, currentDate]
  )

  const totals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    return { income, expense, balance: income - expense }
  }, [filteredTransactions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
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
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nova transação
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Saldo</p>
          <p className={`text-base font-bold ${totals.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Receitas</p>
          <p className="text-base font-bold text-green-600">{formatCurrency(totals.income)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Despesas</p>
          <p className="text-base font-bold text-red-600">{formatCurrency(totals.expense)}</p>
        </div>
      </div>

      {/* Lista de transações */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Transações</h2>
          {filteredTransactions.length > 0 && (
            <span className="text-xs text-gray-400">{filteredTransactions.length} registros</span>
          )}
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Nenhuma transação neste mês.</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-blue-600 text-sm font-medium hover:underline"
            >
              Adicionar primeira transação
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filteredTransactions.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{t.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t.category} · {formatDate(t.date)}</p>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                </span>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-gray-200 hover:text-red-500 transition-colors text-xl leading-none flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100"
                  title="Excluir"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal nova transação */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nova transação</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category: 'Outros' }))}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${form.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  Despesa
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category: 'Outros' }))}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${form.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  Receita
                </button>
              </div>
              <input type="text" placeholder="Descrição" required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Valor (R$)" required min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="date" required value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors mt-2">
                {submitting ? 'Salvando...' : 'Salvar transação'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
