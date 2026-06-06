'use client'

import { useState, useMemo, useEffect } from 'react'
import type { CreditCard, CreditCardTransaction, Payment } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const CARD_CATEGORIES = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Outros']
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const CATEGORY_META: Record<string, { icon: string; bg: string; text: string }> = {
  Alimentação: { icon: '🍽️', bg: 'bg-orange-100', text: 'text-orange-700' },
  Transporte:  { icon: '🚗', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Saúde:       { icon: '❤️', bg: 'bg-rose-100',   text: 'text-rose-700'   },
  Educação:    { icon: '📚', bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  Lazer:       { icon: '🎬', bg: 'bg-purple-100',  text: 'text-purple-700' },
  Compras:     { icon: '🛍️', bg: 'bg-pink-100',   text: 'text-pink-700'   },
  Assinaturas: { icon: '♻️', bg: 'bg-teal-100',   text: 'text-teal-700'   },
  Outros:      { icon: '•',  bg: 'bg-gray-100',    text: 'text-gray-600'   },
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  return targetMonth >= startMonth && targetMonth <= startMonth + t.installments - 1
}

function getInstallmentNumber(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  return year * 12 + month - startMonth + 1
}

function getEndDate(t: CreditCardTransaction) {
  const start = new Date(t.start_date + 'T00:00:00')
  return new Date(start.getFullYear(), start.getMonth() + t.installments - 1, 1)
}

const CARD_GRADIENTS = [
  'from-indigo-600 via-indigo-500 to-violet-600',
  'from-slate-700 via-slate-600 to-slate-900',
  'from-rose-500 via-rose-400 to-pink-600',
  'from-emerald-500 via-emerald-400 to-teal-600',
  'from-amber-500 via-amber-400 to-orange-500',
]

interface Props {
  cards: CreditCard[]
  transactions: CreditCardTransaction[]
  currentDate: Date
  payments: Payment[]
  onRefresh: () => void
}

const defaultCardForm = () => ({ name: '', limit_amount: '', closing_day: '', due_day: '' })
const defaultTxForm = () => ({
  description: '',
  installment_amount: '',  // valor POR parcela — o total é calculado na hora do submit
  installments: '1',
  start_date: new Date().toISOString().split('T')[0],
  category: 'Outros',
  is_recurring: false,
})

export default function CreditCardTab({ cards, transactions, currentDate, payments, onRefresh }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [editingTx, setEditingTx] = useState<CreditCardTransaction | null>(null)
  const [cardForm, setCardForm] = useState(defaultCardForm())
  const [txForm, setTxForm] = useState(defaultTxForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCardId && cards.length > 0) setSelectedCardId(cards[0].id)
  }, [cards, selectedCardId])

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null
  const cardGradient = selectedCard
    ? CARD_GRADIENTS[cards.indexOf(selectedCard) % CARD_GRADIENTS.length]
    : CARD_GRADIENTS[0]

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const currentMonthTx = useMemo(() =>
    transactions.filter(t => t.card_id === selectedCardId && isActiveInMonth(t, year, month)),
    [transactions, selectedCardId, year, month])

  const monthTotal = useMemo(() =>
    currentMonthTx.reduce((s, t) => s + t.total_amount / t.installments, 0),
    [currentMonthTx])

  const allCardTx = useMemo(() =>
    transactions.filter(t => t.card_id === selectedCardId),
    [transactions, selectedCardId])

  function isTxPaid(txId: string) {
    return payments.some(p => p.reference_type === 'card_tx' && p.reference_id === txId)
  }

  async function toggleTxPayment(txId: string) {
    const existing = payments.find(p => p.reference_type === 'card_tx' && p.reference_id === txId)
    if (existing) {
      await fetch(`/api/payments/${existing.id}`, { method: 'DELETE' })
    } else {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_type: 'card_tx', reference_id: txId, year, month }),
      })
    }
    onRefresh()
  }

  // O usuário digita o valor de cada parcela; o total é parcela × número de parcelas
  const installmentAmount = parseCurrency(txForm.installment_amount)
  const totalAmount = installmentAmount * (parseInt(txForm.installments) || 1)

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/credit-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cardForm.name,
        limit_amount: cardForm.limit_amount ? parseCurrency(cardForm.limit_amount) : null,
        closing_day: cardForm.closing_day ? parseInt(cardForm.closing_day) : null,
        due_day: cardForm.due_day ? parseInt(cardForm.due_day) : null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Erro ao salvar cartão.'); setSubmitting(false); return }
    await onRefresh()
    setSelectedCardId(data.id)
    setShowCardModal(false)
    setCardForm(defaultCardForm())
    setSubmitting(false)
  }

  function openCreateTx() {
    setEditingTx(null)
    setTxForm(defaultTxForm())
    setError(null)
    setShowTxModal(true)
  }

  function openEditTx(tx: CreditCardTransaction) {
    setEditingTx(tx)
    const perInstallment = tx.total_amount / tx.installments
    setTxForm({
      description: tx.description,
      installment_amount: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(perInstallment),
      installments: String(tx.installments),
      start_date: tx.start_date,
      category: tx.category,
      is_recurring: tx.is_recurring,
    })
    setError(null)
    setShowTxModal(true)
  }

  async function handleAddTx(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = {
      card_id: selectedCardId,
      description: txForm.description,
      total_amount: totalAmount,
      installments: parseInt(txForm.installments),
      start_date: txForm.start_date,
      category: txForm.category,
      is_recurring: txForm.is_recurring,
    }

    if (editingTx) {
      const res = await fetch(`/api/credit-card-transactions/${editingTx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao editar lançamento.'); setSubmitting(false); return }
    } else {
      const res = await fetch('/api/credit-card-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar lançamento.'); setSubmitting(false); return }
    }

    await onRefresh()
    setShowTxModal(false)
    setTxForm(defaultTxForm())
    setEditingTx(null)
    setSubmitting(false)
  }

  async function handleDeleteCard(id: string) {
    if (!confirm('Excluir este cartão e todos os seus lançamentos?')) return
    await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' })
    if (selectedCardId === id) setSelectedCardId(cards.find(c => c.id !== id)?.id ?? null)
    onRefresh()
  }

  async function handleDeleteTx(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await fetch(`/api/credit-card-transactions/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-4">

      {/* ── Seleção de cartões ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {cards.map((card, i) => (
          <button key={card.id} onClick={() => setSelectedCardId(card.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
              selectedCardId === card.id
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
            }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${selectedCardId === card.id ? 'bg-white' : `bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length].split(' ')[0].replace('from-', 'bg-')}`}`} />
            {card.name}
          </button>
        ))}
        <button onClick={() => setShowCardModal(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors bg-white">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cartão
        </button>
      </div>

      {!selectedCard ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-3xl">💳</div>
          <p className="text-gray-500 text-sm font-semibold">Nenhum cartão cadastrado</p>
          <p className="text-xs text-gray-400 mt-1">Adicione um cartão para registrar compras e parcelas</p>
          <button onClick={() => setShowCardModal(true)} className="mt-3 text-indigo-600 text-sm font-bold hover:underline">
            Adicionar cartão
          </button>
        </div>
      ) : (
        <>
          {/* ── Cartão visual ── */}
          <div className={`bg-gradient-to-br ${cardGradient} rounded-2xl p-5 text-white shadow-xl relative overflow-hidden`}>
            {/* Decorative circles */}
            <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full pointer-events-none" />
            <div className="absolute right-12 -bottom-4 w-24 h-24 bg-white/10 rounded-full pointer-events-none" />

            <div className="relative">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">Cartão</p>
                  <p className="text-lg font-bold">{selectedCard.name}</p>
                  {(selectedCard.closing_day || selectedCard.due_day) && (
                    <div className="flex gap-3 mt-1">
                      {selectedCard.closing_day && (
                        <span className="text-xs opacity-60 bg-white/10 px-2 py-0.5 rounded-full">Fecha dia {selectedCard.closing_day}</span>
                      )}
                      {selectedCard.due_day && (
                        <span className="text-xs opacity-60 bg-white/10 px-2 py-0.5 rounded-full">Vence dia {selectedCard.due_day}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Chip visual */}
                  <div className="w-8 h-6 bg-amber-300/80 rounded-md border border-amber-200/50" />
                  <button onClick={() => handleDeleteCard(selectedCard.id)}
                    className="text-white/40 hover:text-white/80 transition-colors p-1 hover:bg-white/10 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs opacity-50 uppercase tracking-widest mb-1">Total este mês</p>
                <p className="text-3xl font-bold">{fmt(monthTotal)}</p>
                {selectedCard.limit_amount && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs opacity-60 mb-1.5">
                      <span>Limite usado</span>
                      <span>{Math.round((monthTotal / selectedCard.limit_amount) * 100)}% de {fmt(selectedCard.limit_amount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/80 rounded-full transition-all"
                        style={{ width: `${Math.min((monthTotal / selectedCard.limit_amount) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Lançamentos do mês ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800 text-sm">Lançamentos do mês</h2>
                <p className="text-xs text-gray-400 mt-0.5">{currentMonthTx.length} item{currentMonthTx.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={openCreateTx}
                className="flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Novo lançamento
              </button>
            </div>

            {currentMonthTx.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm font-medium">Nenhum lançamento neste mês</p>
                <button onClick={() => setShowTxModal(true)} className="mt-2 text-indigo-600 text-sm font-bold hover:underline">
                  Adicionar lançamento
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {currentMonthTx.map(t => {
                  const num = getInstallmentNumber(t, year, month)
                  const end = getEndDate(t)
                  const monthlyAmt = t.total_amount / t.installments
                  const catMeta = CATEGORY_META[t.category] ?? CATEGORY_META['Outros']
                  const paid = isTxPaid(t.id)
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 group transition-colors">
                      {/* Checkbox pagamento */}
                      <button onClick={() => toggleTxPayment(t.id)}
                        className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0 active:scale-90"
                        style={paid ? { backgroundColor: '#C9F042', borderColor: '#C9F042' } : { borderColor: '#CBD5E1' }}>
                        {paid && (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#0A0A0A" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                      <div className={`w-9 h-9 ${catMeta.bg} rounded-xl flex items-center justify-center flex-shrink-0 text-base`}>
                        {catMeta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm font-bold truncate ${paid ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.description}</p>
                          {t.is_recurring && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex-shrink-0">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                              </svg>
                              Recorrente
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${catMeta.bg} ${catMeta.text}`}>
                            {t.category}
                          </span>
                          {t.installments > 1 && (
                            <span className="text-[10px] text-gray-400">
                              {num}/{t.installments} · até {MONTHS[end.getMonth()]}/{end.getFullYear()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${paid ? 'line-through text-gray-300' : 'text-rose-600'}`}>-{fmt(monthlyAmt)}</p>
                        {t.installments > 1 && (
                          <p className="text-[10px] text-gray-400">total {fmt(t.total_amount)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0">
                        <button onClick={() => openEditTx(t)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteTx(t.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ── Parcelas futuras ── */}
          {(() => {
            const forecasts = Array.from({ length: 6 }, (_, i) => {
              const d = new Date(year, month + i + 1, 1)
              const total = allCardTx
                .filter(t => isActiveInMonth(t, d.getFullYear(), d.getMonth()))
                .reduce((s, t) => s + t.total_amount / t.installments, 0)
              return total > 0 ? { date: d, total } : null
            }).filter(Boolean)

            if (!forecasts.length) return null
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3.5 border-b border-gray-100">
                  <h2 className="font-bold text-gray-800 text-sm">Parcelas futuras</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Comprometimento dos próximos meses</p>
                </div>
                <ul className="divide-y divide-gray-50">
                  {forecasts.map((f, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 bg-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-rose-500">{MONTHS[f!.date.getMonth()]}</span>
                      </div>
                      <span className="flex-1 text-sm text-gray-500">{f!.date.getFullYear()}</span>
                      <span className="text-sm font-bold text-rose-600">{fmt(f!.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </>
      )}

      {/* ── Modal: novo cartão ── */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowCardModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Novo cartão</h2>
                <p className="text-xs text-white/70">Crédito, débito ou benefício</p>
              </div>
              <button onClick={() => { setShowCardModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
              <form onSubmit={handleAddCard} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nome do cartão</label>
                  <input type="text" placeholder="Ex: Nubank, Itaú Visa" required value={cardForm.name}
                    onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Limite (opcional)</label>
                  <CurrencyInput value={cardForm.limit_amount} placeholder="R$ 0,00"
                    onChange={v => setCardForm(f => ({ ...f, limit_amount: v }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Dia fechamento</label>
                    <input type="number" placeholder="Ex: 15" min="1" max="31" value={cardForm.closing_day}
                      onChange={e => setCardForm(f => ({ ...f, closing_day: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Dia vencimento</label>
                    <input type="number" placeholder="Ex: 25" min="1" max="31" value={cardForm.due_day}
                      onChange={e => setCardForm(f => ({ ...f, due_day: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm shadow-indigo-200">
                  {submitting ? 'Salvando...' : 'Adicionar cartão'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: novo lançamento ── */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowTxModal(false); setEditingTx(null); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between ${editingTx ? 'bg-gradient-to-r from-slate-700 to-slate-800' : 'bg-gradient-to-r from-rose-500 to-pink-600'}`}>
              <div>
                <h2 className="text-base font-bold text-white">{editingTx ? 'Editar lançamento' : 'Novo lançamento'}</h2>
                <p className="text-xs text-white/70">{editingTx ? editingTx.description : selectedCard?.name}</p>
              </div>
              <button onClick={() => { setShowTxModal(false); setEditingTx(null); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
              <form onSubmit={handleAddTx} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                  <input type="text" placeholder="Ex: Amazon, Supermercado" required value={txForm.description}
                    onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor da parcela</label>
                  <CurrencyInput value={txForm.installment_amount} placeholder="R$ 0,00" required
                    onChange={v => setTxForm(f => ({ ...f, installment_amount: v }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Parcelas</label>
                    <input type="number" min="1" max="99" required value={txForm.installments}
                      onChange={e => setTxForm(f => ({ ...f, installments: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Data da compra</label>
                    <input type="date" required value={txForm.start_date}
                      onChange={e => setTxForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent" />
                  </div>
                </div>

                {installmentAmount > 0 && (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3.5 py-2.5">
                    <div className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-xs text-rose-700 font-bold">
                      {txForm.installments}× de {fmt(installmentAmount)} = {fmt(totalAmount)} no total
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Categoria</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {CARD_CATEGORIES.map(c => {
                      const m = CATEGORY_META[c] ?? CATEGORY_META['Outros']
                      return (
                        <button key={c} type="button"
                          onClick={() => setTxForm(f => ({ ...f, category: c }))}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-[10px] font-bold ${
                            txForm.category === c
                              ? `border-rose-400 ${m.bg} ${m.text}`
                              : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                          }`}>
                          <span className="text-base">{m.icon}</span>
                          {c}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Toggle de recorrência */}
                <button type="button"
                  onClick={() => setTxForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    txForm.is_recurring ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    txForm.is_recurring ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
                  }`}>
                    {txForm.is_recurring && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${txForm.is_recurring ? 'text-indigo-700' : 'text-gray-600'}`}>
                      Cobrança recorrente
                    </p>
                    <p className="text-[10px] text-gray-400">Assinatura que renova todo mês</p>
                  </div>
                  <svg className={`w-4 h-4 flex-shrink-0 ${txForm.is_recurring ? 'text-indigo-500' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>

                <button type="submit" disabled={submitting}
                  className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white py-3.5 rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm shadow-rose-200">
                  {submitting ? 'Salvando...' : editingTx ? 'Salvar alterações' : 'Salvar lançamento'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
