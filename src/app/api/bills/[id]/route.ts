import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if ('is_active' in body) updates.is_active = body.is_active
  if ('description' in body) updates.description = body.description
  if ('amount' in body) updates.amount = body.amount
  if ('due_day' in body) updates.due_day = body.due_day
  if ('is_recurring' in body) updates.is_recurring = body.is_recurring
  if ('total_months' in body) updates.total_months = body.total_months

  const { data, error } = await getClient()
    .from('bills')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await getClient().from('bills').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
