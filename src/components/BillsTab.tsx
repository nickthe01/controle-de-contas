'use client'

import { useState, useMemo } from 'react'
import type { Bill } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

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
  const [error, setError] = useState<string | null>(null)

  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills])
  const totalActive = useMemo(() => activeBills.reduce((s, b) => s + Number(b.amount), 0), [activeBills])
  const today = currentDate.getDate()

  function getDueStatus(dueDay: number) {
    const daysUntil = dueDay - today
    if (daysUntil < 0) return { label: 'Vencido', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' }
    if (daysUntil === 0) return { label: 'Vence hoje', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' }
    if (daysUntil <= 5) return { label: `${daysUntil} dias`, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' }
    return { label: `Dia ${dueDay}`, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: form.description,
        amount: parseCurrency(form.amount),
        due_day: parseInt(form.due_day),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar boleto. As tabelas foram criadas no Supabase?')
      setSubmitting(false)
      return
    }
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
    <div className="space-y-4">
      {/* Resumo */}
      <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-200">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Total mensal</p>
        <p className="text-4xl font-bold tracking-tight">{formatCurrency(totalActive)}</p>
        <p className="text-sm opacity-60 mt-2">
          {activeBills.length} boleto{activeBills.length !== 1 ? 's' : ''} ativo{activeBills.length !== 1 ? 's' : ''}
          {bills.length > activeBills.length && ` · ${bills.length - activeBills.length} inativo${bills.length - activeBills.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Header + botão */}
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base">Boletos e carnês</h2>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {bills.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Nenhum boleto cadastrado</p>
            <button onClick={() => setShowModal(true)} className="mt-2 text-indigo-600 text-sm font-semibold hover:underline">
              Adicionar boleto
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {bills.map(bill => {
              const status = getDueStatus(bill.due_day)
              return (
                <li key={bill.id} className={`flex items-center gap-3 px-4 py-4 group transition-colors ${bill.is_active ? 'hover:bg-slate-50' : 'bg-gray-50/50'}`}>
                  {/* Toggle */}
                  <button onClick={() => handleToggle(bill)}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      bill.is_active ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'
                    }`}>
                    {bill.is_active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                  <div className={`flex-1 min-w-0 ${!bill.is_active ? 'opacity-50' : ''}`}>
                    <p className={`text-sm font-semibold text-gray-800 truncate ${!bill.is_active ? 'line-through' : ''}`}>
                      {bill.description}
                    </p>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ${bill.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                    {formatCurrency(Number(bill.amount))}
                  </span>
                  <button onClick={() => handleDelete(bill.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 ml-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo boleto</h2>
              <button onClick={() => { setShowModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                <input type="text" placeholder="Ex: Água, Carnê Riachuelo, Netflix" required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor mensal</label>
                <CurrencyInput value={form.amount} placeholder="R$ 0,00" required
                  onChange={v => setForm(f => ({ ...f, amount: v }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Dia do vencimento</label>
                <input type="number" placeholder="Ex: 10" required min="1" max="31" value={form.due_day}
                  onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
                {submitting ? 'Salvando...' : 'Salvar boleto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
