import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let query = getClient().from('payments').select('*')
  if (year) query = query.eq('year', Number(year))
  if (month !== null) query = query.eq('month', Number(month))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { data, error } = await getClient()
    .from('payments')
    .upsert(
      { reference_type: body.reference_type, reference_id: body.reference_id, year: body.year, month: body.month },
      { onConflict: 'reference_type,reference_id,year,month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
