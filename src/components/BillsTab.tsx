'use client'

import { useState, useMemo } from 'react'
import type { Bill } from '@/lib/types'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

interface Props {
  bills: Bill[]
  currentDate: Date
  onRefresh: () => void
}

const defaultForm = () => ({ description: '', amount: '', due_day: '' })

export default function BillsTab({ bills, currentDate, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [submitting, setSubmitting] = useState(false)

  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills])
  const totalActive = useMemo(() => activeBills.reduce((s, b) => s + Number(b.amount), 0), [activeBills])

  const today = currentDate.getDate()

  function getDueDaysLabel(dueDay: number) {
    const daysUntil = dueDay - today
    if (daysUntil < 0) return { label: 'Vencido', color: 'text-red-600 bg-red-50' }
    if (daysUntil === 0) return { label: 'Vence hoje', color: 'text-orange-600 bg-orange-50' }
    if (daysUntil <= 5) return { label: `${daysUntil}d`, color: 'text-orange-500 bg-orange-50' }
    return { label: `Dia ${dueDay}`, color: 'text-gray-500 bg-gray-100' }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description,
        amount: parseFloat(form.amount),
        due_day: parseInt(form.due_day),
      }),
    })
    await onRefresh()
    setShowModal(false)
    setForm(defaultForm())
    setSubmitting(false)
  }

  async function handleToggle(bill: Bill) {
    await fetch(`/api/bills/${bill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !bill.is_active }),
    })
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este boleto?')) return
    await fetch(`/api/bills/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Total mensal ativo</p>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totalActive)}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Boleto
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700 text-sm">Boletos e carnês</h2>
        </div>

        {bills.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Nenhum boleto cadastrado.</p>
            <button onClick={() => setShowModal(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
              Adicionar boleto
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {bills.map(bill => {
              const { label, color } = getDueDaysLabel(bill.due_day)
              return (
                <li key={bill.id} className={`flex items-center gap-3 px-4 py-3.5 group transition-colors ${bill.is_active ? 'hover:bg-gray-50' : 'opacity-50 bg-gray-50'}`}>
                  <button
                    onClick={() => handleToggle(bill)}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      bill.is_active ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                    }`}
                    title={bill.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {bill.is_active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{bill.description}</p>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${color}`}>
                      {label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                    {formatCurrency(Number(bill.amount))}
                  </span>
                  <button
                    onClick={() => handleDelete(bill.id)}
                    className="text-gray-200 hover:text-red-500 transition-colors text-xl leading-none flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100"
                    title="Excluir"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo boleto</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Descrição (ex: Água, Carnê Riachuelo)" required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Valor (R$)" required min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Dia do vencimento (1-31)" required min="1" max="31" value={form.due_day}
                onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Salvando...' : 'Salvar boleto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
