'use client'

import { useState, useMemo } from 'react'
import type { SalaryConfig, ExtraIncome } from '@/lib/types'

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
  const [salaryValue, setSalaryValue] = useState(salary?.fixed_amount?.toString() ?? '')
  const [showExtraModal, setShowExtraModal] = useState(false)
  const [extraForm, setExtraForm] = useState(defaultExtraForm())
  const [submitting, setSubmitting] = useState(false)

  const currentMonthExtras = useMemo(() =>
    extraIncomes.filter(e => {
      const d = new Date(e.date + 'T00:00:00')
      return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
    }),
    [extraIncomes, currentDate]
  )

  const totalExtra = useMemo(() =>
    currentMonthExtras.reduce((s, e) => s + Number(e.amount), 0),
    [currentMonthExtras]
  )

  const totalIncome = (salary?.fixed_amount ?? 0) + totalExtra

  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixed_amount: parseFloat(salaryValue) }),
    })
    await onRefresh()
    setEditingSalary(false)
    setSubmitting(false)
  }

  async function handleAddExtra(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/extra-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...extraForm, amount: parseFloat(extraForm.amount) }),
    })
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
    <div className="space-y-6">
      {/* Salário fixo */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Salário fixo</p>
            {!editingSalary ? (
              <p className="text-2xl font-bold text-green-600">
                {salary ? formatCurrency(salary.fixed_amount) : '—'}
              </p>
            ) : (
              <form onSubmit={handleSaveSalary} className="flex gap-2 mt-1">
                <input
                  type="number"
                  placeholder="Valor (R$)"
                  required
                  min="0"
                  step="0.01"
                  value={salaryValue}
                  onChange={e => setSalaryValue(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                  autoFocus
                />
                <button type="submit" disabled={submitting}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? '...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => setEditingSalary(false)}
                  className="text-gray-400 px-3 py-2 rounded-lg text-sm hover:bg-gray-100">
                  Cancelar
                </button>
              </form>
            )}
          </div>
          {!editingSalary && (
            <button
              onClick={() => { setEditingSalary(true); setSalaryValue(salary?.fixed_amount?.toString() ?? '') }}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              {salary ? 'Editar' : 'Definir'}
            </button>
          )}
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Renda extra (mês)</p>
          <p className="text-base font-bold text-green-600">{formatCurrency(totalExtra)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total do mês</p>
          <p className="text-base font-bold text-green-700">{formatCurrency(totalIncome)}</p>
        </div>
      </div>

      {/* Rendas extras do mês */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 text-sm">Renda extra do mês</h2>
          <button
            onClick={() => setShowExtraModal(true)}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            + Adicionar
          </button>
        </div>

        {currentMonthExtras.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-400 text-sm">Nenhuma renda extra neste mês.</p>
            <button onClick={() => setShowExtraModal(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">
              Adicionar renda extra
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {currentMonthExtras.map(e => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(e.date)}</p>
                </div>
                <span className="text-sm font-semibold text-green-600 flex-shrink-0">
                  +{formatCurrency(Number(e.amount))}
                </span>
                <button
                  onClick={() => handleDeleteExtra(e.id)}
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

      {showExtraModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowExtraModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Renda extra</h2>
              <button onClick={() => setShowExtraModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleAddExtra} className="space-y-3">
              <input type="text" placeholder="Descrição (ex: Freelance, Venda)" required value={extraForm.description}
                onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Valor (R$)" required min="0.01" step="0.01" value={extraForm.amount}
                onChange={e => setExtraForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="date" required value={extraForm.date}
                onChange={e => setExtraForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
