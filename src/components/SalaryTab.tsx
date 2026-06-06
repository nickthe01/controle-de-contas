'use client'

import { useState, useMemo } from 'react'
import type { SalaryConfig, ExtraIncome } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

interface Props {
  salary: SalaryConfig | null
  extraIncomes: ExtraIncome[]
  currentDate: Date
  onRefresh: () => void
}

const defaultExtraForm = () => ({
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
})

export default function SalaryTab({ salary, extraIncomes, currentDate, onRefresh }: Props) {
  const [editingSalary, setEditingSalary] = useState(false)
  const [salaryValue, setSalaryValue] = useState('')
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [extraForm, setExtraForm] = useState(defaultExtraForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentMonthExtras = useMemo(() =>
    extraIncomes.filter(e => {
      const d = new Date(e.date + 'T00:00:00')
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    }), [extraIncomes, currentDate])

  const totalExtra = useMemo(() =>
    currentMonthExtras.reduce((s, e) => s + Number(e.amount), 0),
    [currentMonthExtras])

  const totalIncome = (salary?.fixed_amount ?? 0) + totalExtra

  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixed_amount: parseCurrency(salaryValue) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar salário. As tabelas foram criadas no Supabase?')
      setSubmitting(false)
      return
    }
    await onRefresh()
    setEditingSalary(false)
    setSubmitting(false)
  }

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/extra-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...extraForm, amount: parseCurrency(extraForm.amount) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar renda extra.')
      setSubmitting(false)
      return
    }
    await onRefresh()
    setShowExtraModal(false)
    setExtraForm(defaultExtraForm())
    setSubmitting(false)
  }

  async function handleDeleteExtra(id: string) {
    if (!confirm('Excluir esta renda extra?')) return
    await fetch(`/api/extra-income/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      {/* Resumo da renda */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Renda total do mês</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(totalIncome)}</p>
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs opacity-70 font-medium mb-1">Salário fixo</p>
            <p className="text-lg font-bold">{salary ? formatCurrency(salary.fixed_amount) : '—'}</p>
          </div>
          <div>
            <p className="text-xs opacity-70 font-medium mb-1">Extra (mês)</p>
            <p className="text-lg font-bold">{formatCurrency(totalExtra)}</p>
          </div>
        </div>
      </div>

      {/* Salário fixo */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Salário fixo</p>
              {!editingSalary && (
                <p className="text-base font-bold text-gray-800">
                  {salary ? formatCurrency(salary.fixed_amount) : 'Não definido'}
                </p>
              )}
            </div>
          </div>
          {!editingSalary && (
            <button
              onClick={() => { setEditingSalary(true); setSalaryValue(salary?.fixed_amount?.toString() ?? '') }}
              className="text-xs text-indigo-600 font-semibold hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
              {salary ? 'Editar' : 'Definir'}
            </button>
          )}
        </div>
        {editingSalary && (
          <form onSubmit={handleSaveSalary} className="mt-3 pt-3 border-t border-gray-100">
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium mb-3">{error}</p>}
            <div className="flex gap-2">
              <CurrencyInput value={salaryValue} placeholder="R$ 0,00" autoFocus
                onChange={v => setSalaryValue(v)}
                className="flex-1 border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              <button type="submit" disabled={submitting}
                className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {submitting ? '...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setEditingSalary(false)}
                className="text-gray-500 px-3 py-3 rounded-xl text-sm hover:bg-gray-100 transition-colors">
                ✕
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Renda extra */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">Renda extra do mês</h2>
        <button onClick={() => setShowExtraModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Adicionar
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {currentMonthExtras.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhuma renda extra este mês</p>
            <button onClick={() => setShowExtraModal(true)} className="mt-2 text-indigo-600 text-sm font-semibold hover:underline">
              Adicionar renda extra
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {currentMonthExtras.map(e => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 group transition-colors">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-[18px] h-[18px] text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(e.date)}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 flex-shrink-0">
                  +{formatCurrency(Number(e.amount))}
                </span>
                <button onClick={() => handleDeleteExtra(e.id)}
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

      {showExtraModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowExtraModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Renda extra</h2>
              <button onClick={() => { setShowExtraModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
            <form onSubmit={handleAddExtra} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                <input type="text" placeholder="Ex: Freelance, Venda, Bônus" required value={extraForm.description}
                  onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor</label>
                <CurrencyInput value={extraForm.amount} placeholder="R$ 0,00" required
                  onChange={v => setExtraForm(f => ({ ...f, amount: v }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Data</label>
                <input type="date" required value={extraForm.date}
                  onChange={e => setExtraForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2">
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
