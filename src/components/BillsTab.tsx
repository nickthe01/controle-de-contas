'use client'

import { useState, useMemo } from 'react'
import type { Bill } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function getBillMeta(name: string) {
  const n = name.toLowerCase()
  if (/netflix|spotify|disney|prime|hbo|globo|paramount|crunchyroll/.test(n)) return { icon: '📺', bg: 'bg-purple-100', text: 'text-purple-600', accent: 'from-purple-400 to-violet-500' }
  if (/academia|gym|smart fit|bodytech|fitness/.test(n)) return { icon: '🏋️', bg: 'bg-orange-100', text: 'text-orange-600', accent: 'from-orange-400 to-red-400' }
  if (/água|agua|sabesp|sanepar|cedae/.test(n)) return { icon: '💧', bg: 'bg-blue-100', text: 'text-blue-600', accent: 'from-blue-400 to-cyan-400' }
  if (/luz|energia|enel|cpfl|cemig|light|eletro/.test(n)) return { icon: '⚡', bg: 'bg-yellow-100', text: 'text-yellow-700', accent: 'from-yellow-400 to-amber-400' }
  if (/internet|banda larga|claro|vivo|oi|giga|fibra|net/.test(n)) return { icon: '🌐', bg: 'bg-cyan-100', text: 'text-cyan-600', accent: 'from-cyan-400 to-blue-400' }
  if (/aluguel|condomin|iptu/.test(n)) return { icon: '🏠', bg: 'bg-emerald-100', text: 'text-emerald-600', accent: 'from-emerald-400 to-teal-400' }
  if (/seguro/.test(n)) return { icon: '🛡️', bg: 'bg-indigo-100', text: 'text-indigo-600', accent: 'from-indigo-400 to-violet-400' }
  if (/telefone|celular|tim|plano movel/.test(n)) return { icon: '📱', bg: 'bg-rose-100', text: 'text-rose-600', accent: 'from-rose-400 to-pink-400' }
  if (/carnê|carne|riachuelo|renner|casas bahia|magazine/.test(n)) return { icon: '🛍️', bg: 'bg-pink-100', text: 'text-pink-600', accent: 'from-pink-400 to-rose-400' }
  if (/gas|gás|comgás/.test(n)) return { icon: '🔥', bg: 'bg-amber-100', text: 'text-amber-700', accent: 'from-amber-400 to-orange-400' }
  return { icon: '📄', bg: 'bg-gray-100', text: 'text-gray-500', accent: 'from-gray-300 to-gray-400' }
}

interface Props {
  bills: Bill[]
  currentDate: Date
  onRefresh: () => void
}

const defaultForm = () => ({ description: '', amount: '', due_day: '', is_recurring: false })

export default function BillsTab({ bills, currentDate, onRefresh }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills])
  const totalActive = useMemo(() => activeBills.reduce((s, b) => s + Number(b.amount), 0), [activeBills])
  const today = currentDate.getDate()

  const nextBill = useMemo(() => {
    return activeBills
      .map(b => ({ ...b, daysUntil: b.due_day >= today ? b.due_day - today : 31 - today + b.due_day }))
      .sort((a, b) => a.daysUntil - b.daysUntil)[0] ?? null
  }, [activeBills, today])

  function getDueStatus(dueDay: number) {
    const d = dueDay - today
    if (d < 0) return { label: 'Vencido', bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500', urgent: true }
    if (d === 0) return { label: 'Vence hoje', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', urgent: true }
    if (d <= 3) return { label: `${d}d restantes`, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', urgent: true }
    if (d <= 7) return { label: `${d} dias`, bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400', urgent: false }
    return { label: `Dia ${dueDay}`, bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-300', urgent: false }
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
        is_recurring: form.is_recurring,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); setSubmitting(false); return }
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

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white shadow-lg shadow-orange-200 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute right-6 top-14 w-20 h-20 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Total em boletos ativos</p>
          <p className="text-4xl font-bold tracking-tight">{fmt(totalActive)}</p>
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold">{activeBills.length}</p>
              <p className="text-[10px] uppercase opacity-60 mt-0.5">Ativos</p>
            </div>
            <div className="text-center border-x border-white/20">
              <p className="text-2xl font-bold">{bills.filter(b => b.is_recurring).length}</p>
              <p className="text-[10px] uppercase opacity-60 mt-0.5">Recorrentes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{nextBill ? `${nextBill.daysUntil}d` : '—'}</p>
              <p className="text-[10px] uppercase opacity-60 mt-0.5">Próximo</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Header + botão ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-800 text-base">Boletos e carnês</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {bills.length} cadastrado{bills.length !== 1 ? 's' : ''}
            {bills.length > activeBills.length ? ` · ${bills.length - activeBills.length} inativo${bills.length - activeBills.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity shadow-sm shadow-orange-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo
        </button>
      </div>

      {/* ── Lista ── */}
      {bills.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">📄</div>
          <p className="text-gray-500 text-sm font-semibold">Nenhum boleto cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">Adicione contas fixas como água, luz, streaming…</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-amber-600 text-sm font-bold hover:underline">
            Adicionar boleto
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bills.map(bill => {
            const meta = getBillMeta(bill.description)
            const status = getDueStatus(bill.due_day)
            return (
              <div key={bill.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 group ${
                  bill.is_active ? 'border-gray-100 hover:shadow-md hover:-translate-y-0.5' : 'border-gray-100 opacity-55'
                }`}>
                {/* Accent bar */}
                <div className={`h-1 bg-gradient-to-r ${bill.is_active ? meta.accent : 'from-gray-200 to-gray-300'}`} />

                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Toggle */}
                  <button onClick={() => handleToggle(bill)}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      bill.is_active ? 'border-amber-500 bg-amber-500' : 'border-gray-300 bg-white'
                    }`}>
                    {bill.is_active && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>

                  {/* Icon */}
                  <div className={`w-10 h-10 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-xl`}>
                    {meta.icon}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`text-sm font-bold truncate ${bill.is_active ? 'text-gray-800' : 'line-through text-gray-400'}`}>
                        {bill.description}
                      </p>
                      {bill.is_recurring && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex-shrink-0">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          Recorrente
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                        {status.urgent && <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />}
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold ${bill.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                      {fmt(Number(bill.amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">/ mês</p>
                  </div>

                  {/* Delete */}
                  <button onClick={() => handleDelete(bill.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Novo boleto</h2>
                <p className="text-xs text-white/70">Conta fixa, carnê ou assinatura</p>
              </div>
              <button onClick={() => { setShowModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                  <input type="text" placeholder="Ex: Netflix, Água, Aluguel" required value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor mensal</label>
                    <CurrencyInput value={form.amount} placeholder="R$ 0,00" required
                      onChange={v => setForm(f => ({ ...f, amount: v }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Dia do vencimento</label>
                    <input type="number" placeholder="Ex: 10" required min="1" max="31" value={form.due_day}
                      onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
                  </div>
                </div>

                {/* Toggle de recorrência */}
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    form.is_recurring ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    form.is_recurring ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  }`}>
                    {form.is_recurring && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${form.is_recurring ? 'text-indigo-700' : 'text-gray-600'}`}>
                      Cobrança recorrente
                    </p>
                    <p className="text-[10px] text-gray-400">Renova automaticamente todo mês</p>
                  </div>
                  <svg className={`w-4 h-4 flex-shrink-0 ${form.is_recurring ? 'text-indigo-500' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>

                <button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm shadow-orange-200">
                  {submitting ? 'Salvando...' : 'Salvar boleto'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
