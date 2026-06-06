'use client'

import { useState, useMemo, useEffect } from 'react'
import type { CreditCard, CreditCardTransaction } from '@/lib/types'
import CurrencyInput, { parseCurrency } from './CurrencyInput'

const CARD_CATEGORIES = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Outros']
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
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
  'from-indigo-600 to-violet-600',
  'from-slate-700 to-slate-900',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
]

interface Props {
  cards: CreditCard[]
  transactions: CreditCardTransaction[]
  currentDate: Date
  onRefresh: () => void
}

const defaultCardForm = () => ({ name: '', limit_amount: '', closing_day: '', due_day: '' })
const defaultTxForm = () => ({
  description: '',
  total_amount: '',
  installments: '1',
  start_date: new Date().toISOString().split('T')[0],
  category: 'Outros',
})

export default function CreditCardTab({ cards, transactions, currentDate, onRefresh }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [cardForm, setCardForm] = useState(defaultCardForm())
  const [txForm, setTxForm] = useState(defaultTxForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-select first card when cards load or change
  useEffect(() => {
    if (!selectedCardId && cards.length > 0) {
      setSelectedCardId(cards[0].id)
    }
  }, [cards, selectedCardId])

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null
  const cardGradient = selectedCard
    ? CARD_GRADIENTS[cards.indexOf(selectedCard) % CARD_GRADIENTS.length]
    : CARD_GRADIENTS[0]

  const currentMonthTx = useMemo(() =>
    transactions.filter(t =>
      t.card_id === selectedCardId &&
      isActiveInMonth(t, currentDate.getFullYear(), currentDate.getMonth())
    ), [transactions, selectedCardId, currentDate])

  const monthTotal = useMemo(() =>
    currentMonthTx.reduce((s, t) => s + t.total_amount / t.installments, 0),
    [currentMonthTx])

  const allCardTx = useMemo(() =>
    transactions.filter(t => t.card_id === selectedCardId),
    [transactions, selectedCardId])

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
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar cartão. As tabelas foram criadas no Supabase?')
      setSubmitting(false)
      return
    }
    await onRefresh()
    setSelectedCardId(data.id)
    setShowCardModal(false)
    setCardForm(defaultCardForm())
    setSubmitting(false)
  }

  async function handleAddTx(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/credit-card-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        card_id: selectedCardId,
        description: txForm.description,
        total_amount: parseCurrency(txForm.total_amount),
        installments: parseInt(txForm.installments),
        start_date: txForm.start_date,
        category: txForm.category,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar lançamento.')
      setSubmitting(false)
      return
    }
    await onRefresh()
    setShowTxModal(false)
    setTxForm(defaultTxForm())
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

  const installmentAmount = txForm.total_amount && parseInt(txForm.installments) > 0
    ? parseCurrency(txForm.total_amount) / parseInt(txForm.installments)
    : 0

  return (
    <div className="space-y-4">
      {/* Cartões */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => setSelectedCardId(card.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
              selectedCardId === card.id
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
            }`}
          >
            {card.name}
          </button>
        ))}
        <button
          onClick={() => setShowCardModal(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors bg-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Cartão
        </button>
      </div>

      {!selectedCard ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm font-medium">Nenhum cartão ainda</p>
          <button onClick={() => setShowCardModal(true)} className="mt-3 text-indigo-600 text-sm font-semibold hover:underline">
            Adicionar cartão
          </button>
        </div>
      ) : (
        <>
          {/* Visual card */}
          <div className={`bg-gradient-to-br ${cardGradient} rounded-2xl p-5 text-white shadow-lg`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm font-semibold opacity-80">{selectedCard.name}</p>
                <div className="flex gap-3 mt-1 text-xs opacity-60">
                  {selectedCard.closing_day && <span>Fecha dia {selectedCard.closing_day}</span>}
                  {selectedCard.due_day && <span>Vence dia {selectedCard.due_day}</span>}
                </div>
              </div>
              <button onClick={() => handleDeleteCard(selectedCard.id)} className="text-white/40 hover:text-white/80 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
            <div>
              <p className="text-xs opacity-60 uppercase tracking-widest mb-1">Total este mês</p>
              <p className="text-3xl font-bold">{formatCurrency(monthTotal)}</p>
              {selectedCard.limit_amount && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs opacity-60 mb-1">
                    <span>Limite usado</span>
                    <span>{Math.round((monthTotal / selectedCard.limit_amount) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/70 rounded-full transition-all"
                      style={{ width: `${Math.min((monthTotal / selectedCard.limit_amount) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lançamentos do mês */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">Lançamentos do mês</h2>
              <button onClick={() => setShowTxModal(true)}
                className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Novo
              </button>
            </div>

            {currentMonthTx.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm">Nenhum lançamento neste mês.</p>
                <button onClick={() => setShowTxModal(true)} className="mt-2 text-indigo-600 text-sm font-semibold hover:underline">
                  Adicionar lançamento
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {currentMonthTx.map(t => {
                  const num = getInstallmentNumber(t, currentDate.getFullYear(), currentDate.getMonth())
                  const end = getEndDate(t)
                  const monthlyAmt = t.total_amount / t.installments
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 group transition-colors">
                      <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg className="w-4.5 h-4.5 text-rose-500 w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{t.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.installments > 1
                            ? `${num}/${t.installments} · termina ${MONTHS[end.getMonth()]}/${end.getFullYear()}`
                            : `À vista · ${t.category}`}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-rose-600">-{formatCurrency(monthlyAmt)}</p>
                        {t.installments > 1 && (
                          <p className="text-xs text-gray-400">total {formatCurrency(t.total_amount)}</p>
                        )}
                      </div>
                      <button onClick={() => handleDeleteTx(t.id)}
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

          {/* Previsão */}
          {(() => {
            const forecasts = Array.from({ length: 6 }, (_, i) => {
              const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1)
              const total = allCardTx
                .filter(t => isActiveInMonth(t, d.getFullYear(), d.getMonth()))
                .reduce((s, t) => s + t.total_amount / t.installments, 0)
              return total > 0 ? { date: d, total } : null
            }).filter(Boolean)

            if (!forecasts.length) return null
            return (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3.5 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm">Parcelas futuras</h2>
                </div>
                <ul className="divide-y divide-gray-50">
                  {forecasts.map((f, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-gray-600">{MONTHS[f!.date.getMonth()]} {f!.date.getFullYear()}</span>
                      <span className="text-sm font-bold text-rose-600">{formatCurrency(f!.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </>
      )}

      {/* Modal novo cartão */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowCardModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo cartão</h2>
              <button onClick={() => { setShowCardModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
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
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
                {submitting ? 'Salvando...' : 'Adicionar cartão'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal novo lançamento */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowTxModal(false); setError(null) } }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo lançamento</h2>
              <button onClick={() => { setShowTxModal(false); setError(null) }}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {error && <p className="text-xs text-rose-600 bg-rose-50 rounded-xl px-3 py-2 font-medium">{error}</p>}
            <form onSubmit={handleAddTx} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Descrição</label>
                <input type="text" placeholder="Ex: Amazon, Supermercado" required value={txForm.description}
                  onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Valor total</label>
                <CurrencyInput value={txForm.total_amount} placeholder="R$ 0,00" required
                  onChange={v => setTxForm(f => ({ ...f, total_amount: v }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Parcelas</label>
                  <input type="number" min="1" max="99" required value={txForm.installments}
                    onChange={e => setTxForm(f => ({ ...f, installments: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Data da compra</label>
                  <input type="date" required value={txForm.start_date}
                    onChange={e => setTxForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                </div>
              </div>
              {installmentAmount > 0 && parseInt(txForm.installments) > 1 && (
                <div className="flex items-center gap-2 bg-indigo-50 rounded-xl px-3.5 py-2.5">
                  <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-indigo-700 font-semibold">
                    {txForm.installments}x de {formatCurrency(installmentAmount)}
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Categoria</label>
                <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white">
                  {CARD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-2">
                {submitting ? 'Salvando...' : 'Salvar lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
