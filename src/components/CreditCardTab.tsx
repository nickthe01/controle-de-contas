'use client'

import { useState, useMemo } from 'react'
import type { CreditCard, CreditCardTransaction } from '@/lib/types'

const CARD_CATEGORIES = ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Outros']
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function getInstallmentMonthlyAmount(t: CreditCardTransaction) {
  return t.total_amount / t.installments
}

function getInstallmentEndDate(t: CreditCardTransaction) {
  const start = new Date(t.start_date + 'T00:00:00')
  const end = new Date(start.getFullYear(), start.getMonth() + t.installments - 1, 1)
  return end
}

function isActiveInMonth(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  const endMonth = startMonth + t.installments - 1
  return targetMonth >= startMonth && targetMonth <= endMonth
}

function getInstallmentNumber(t: CreditCardTransaction, year: number, month: number) {
  const start = new Date(t.start_date + 'T00:00:00')
  const startMonth = start.getFullYear() * 12 + start.getMonth()
  const targetMonth = year * 12 + month
  return targetMonth - startMonth + 1
}

interface Props {
  cards: CreditCard[]
  transactions: CreditCardTransaction[]
  currentDate: Date
  onRefresh: () => void
}

const defaultCardForm = () => ({ name: '', limit_amount: '', closing_day: '', due_day: '' })
const defaultTxForm = () => ({
  card_id: '',
  description: '',
  total_amount: '',
  installments: '1',
  start_date: new Date().toISOString().split('T')[0],
  category: 'Outros',
})

export default function CreditCardTab({ cards, transactions, currentDate, onRefresh }: Props) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(cards[0]?.id ?? null)
  const [showCardModal, setShowCardModal] = useState(false)
  const [showTxModal, setShowTxModal] = useState(false)
  const [cardForm, setCardForm] = useState(defaultCardForm())
  const [txForm, setTxForm] = useState(defaultTxForm())
  const [submitting, setSubmitting] = useState(false)

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null

  const currentMonthTx = useMemo(() =>
    transactions.filter(t =>
      t.card_id === selectedCardId &&
      isActiveInMonth(t, currentDate.getFullYear(), currentDate.getMonth())
    ),
    [transactions, selectedCardId, currentDate]
  )

  const monthTotal = useMemo(() =>
    currentMonthTx.reduce((s, t) => s + getInstallmentMonthlyAmount(t), 0),
    [currentMonthTx]
  )

  const allCardTransactions = useMemo(() =>
    transactions.filter(t => t.card_id === selectedCardId),
    [transactions, selectedCardId]
  )

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/credit-cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cardForm.name,
        limit_amount: cardForm.limit_amount ? parseFloat(cardForm.limit_amount) : null,
        closing_day: cardForm.closing_day ? parseInt(cardForm.closing_day) : null,
        due_day: cardForm.due_day ? parseInt(cardForm.due_day) : null,
      }),
    })
    await onRefresh()
    setShowCardModal(false)
    setCardForm(defaultCardForm())
    setSubmitting(false)
  }

  async function handleDeleteCard(id: string) {
    if (!confirm('Excluir este cartão e todos os seus lançamentos?')) return
    await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' })
    if (selectedCardId === id) setSelectedCardId(null)
    onRefresh()
  }

  async function handleAddTx(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/credit-card-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...txForm,
        card_id: selectedCardId,
        total_amount: parseFloat(txForm.total_amount),
        installments: parseInt(txForm.installments),
      }),
    })
    await onRefresh()
    setShowTxModal(false)
    setTxForm(defaultTxForm())
    setSubmitting(false)
  }

  async function handleDeleteTx(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await fetch(`/api/credit-card-transactions/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-6">
      {/* Lista de cartões */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => setSelectedCardId(card.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              selectedCardId === card.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
            }`}
          >
            {card.name}
          </button>
        ))}
        <button
          onClick={() => setShowCardModal(true)}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + Cartão
        </button>
      </div>

      {!selectedCard ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center">
          <p className="text-gray-400 text-sm">Nenhum cartão selecionado.</p>
          <button onClick={() => setShowCardModal(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            Adicionar cartão
          </button>
        </div>
      ) : (
        <>
          {/* Resumo do cartão */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900">{selectedCard.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {selectedCard.closing_day && <span>Fecha dia {selectedCard.closing_day}</span>}
                  {selectedCard.due_day && <span>Vence dia {selectedCard.due_day}</span>}
                  {selectedCard.limit_amount && <span>Limite {formatCurrency(selectedCard.limit_amount)}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDeleteCard(selectedCard.id)}
                className="text-xs text-gray-300 hover:text-red-500 transition-colors"
              >
                Excluir
              </button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">Total este mês</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(monthTotal)}</span>
            </div>
          </div>

          {/* Lançamentos do mês */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700 text-sm">Lançamentos do mês</h2>
              <button
                onClick={() => setShowTxModal(true)}
                className="text-xs text-blue-600 font-medium hover:underline"
              >
                + Novo
              </button>
            </div>

            {currentMonthTx.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 text-sm">Nenhum lançamento neste mês.</p>
                <button onClick={() => setShowTxModal(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">
                  Adicionar lançamento
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {currentMonthTx.map(t => {
                  const installNum = getInstallmentNumber(t, currentDate.getFullYear(), currentDate.getMonth())
                  const endDate = getInstallmentEndDate(t)
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{t.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.category} ·{' '}
                          {t.installments > 1
                            ? `Parcela ${installNum}/${t.installments} — termina ${MONTHS[endDate.getMonth()]}/${endDate.getFullYear()}`
                            : 'À vista'
                          }
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-red-600">
                          -{formatCurrency(getInstallmentMonthlyAmount(t))}
                        </p>
                        {t.installments > 1 && (
                          <p className="text-xs text-gray-400">Total {formatCurrency(t.total_amount)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteTx(t.id)}
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

          {/* Previsão futura */}
          {allCardTransactions.some(t => getInstallmentEndDate(t) > currentDate) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-semibold text-gray-700 text-sm">Previsão de parcelas futuras</h2>
              </div>
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }, (_, i) => {
                  const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1)
                  const futureTotal = allCardTransactions
                    .filter(t => isActiveInMonth(t, futureDate.getFullYear(), futureDate.getMonth()))
                    .reduce((s, t) => s + getInstallmentMonthlyAmount(t), 0)
                  if (futureTotal === 0) return null
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{MONTHS[futureDate.getMonth()]} {futureDate.getFullYear()}</span>
                      <span className="font-semibold text-red-600">{formatCurrency(futureTotal)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal novo cartão */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCardModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo cartão</h2>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleAddCard} className="space-y-3">
              <input type="text" placeholder="Nome do cartão (ex: Nubank)" required value={cardForm.name}
                onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Limite (R$) — opcional" step="0.01" value={cardForm.limit_amount}
                onChange={e => setCardForm(f => ({ ...f, limit_amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Dia fechamento" min="1" max="31" value={cardForm.closing_day}
                  onChange={e => setCardForm(f => ({ ...f, closing_day: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" placeholder="Dia vencimento" min="1" max="31" value={cardForm.due_day}
                  onChange={e => setCardForm(f => ({ ...f, due_day: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Salvando...' : 'Adicionar cartão'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal novo lançamento */}
      {showTxModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowTxModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Novo lançamento</h2>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl w-8 h-8 flex items-center justify-center">×</button>
            </div>
            <form onSubmit={handleAddTx} className="space-y-3">
              <input type="text" placeholder="Descrição" required value={txForm.description}
                onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" placeholder="Valor total (R$)" required min="0.01" step="0.01" value={txForm.total_amount}
                onChange={e => setTxForm(f => ({ ...f, total_amount: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Parcelas</label>
                  <input type="number" min="1" max="99" required value={txForm.installments}
                    onChange={e => setTxForm(f => ({ ...f, installments: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Data da compra</label>
                  <input type="date" required value={txForm.start_date}
                    onChange={e => setTxForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {txForm.total_amount && parseInt(txForm.installments) > 1 && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  {txForm.installments}x de {formatCurrency(parseFloat(txForm.total_amount) / parseInt(txForm.installments))}
                </p>
              )}
              <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {CARD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button type="submit" disabled={submitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {submitting ? 'Salvando...' : 'Salvar lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
