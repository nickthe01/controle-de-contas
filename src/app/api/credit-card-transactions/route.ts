import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function GET() {
  const { data, error } = await getClient()
    .from('credit_card_transactions')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()

  const { data, error } = await getClient()
    .from('credit_card_transactions')
    .insert({
      card_id: body.card_id,
      description: body.description,
      total_amount: body.total_amount,
      installments: body.installments,
      start_date: body.start_date,
      category: body.category ?? 'Outros',
      is_recurring: body.is_recurring ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
