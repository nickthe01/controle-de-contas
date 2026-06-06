export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  description: string
  amount: number
  type: TransactionType
  category: string
  date: string
  created_at: string
}

export interface CreditCard {
  id: string
  name: string
  limit_amount: number | null
  closing_day: number | null
  due_day: number | null
  created_at: string
}

export interface CreditCardTransaction {
  id: string
  card_id: string
  description: string
  total_amount: number
  installments: number
  start_date: string
  category: string
  is_recurring: boolean
  created_at: string
}

export interface Bill {
  id: string
  description: string
  amount: number
  due_day: number
  is_active: boolean
  is_recurring: boolean
  total_months: number | null
  created_at: string
}

export interface SalaryConfig {
  id: string
  fixed_amount: number
  updated_at: string
}

export interface ExtraIncome {
  id: string
  description: string
  amount: number
  date: string
  created_at: string
}

export interface Payment {
  id: string
  reference_type: 'bill' | 'card_tx'
  reference_id: string
  year: number
  month: number
  paid_at: string
}
