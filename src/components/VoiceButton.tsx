'use client'

import { useState, useCallback, useRef } from 'react'

export interface ParsedTransaction {
  description: string
  amount: string
  type: 'income' | 'expense'
  category: string
  date: string
}

interface Props {
  onResult: (parsed: ParsedTransaction) => void
}

const CATEGORY_MAP: [RegExp, string, 'income' | 'expense' | 'any'][] = [
  [/mercado|supermercado|alimenta|comida|restaurante|lanche|ifood|delivery|pizza|hamburguer|açougue|padaria/i, 'Alimentação', 'expense'],
  [/uber|taxi|táxi|transporte|gasolina|combustível|ônibus|metro|estacionamento|passagem/i, 'Transporte', 'expense'],
  [/aluguel|energia|água|internet|condomínio|condominio|iptu|moradia|luz/i, 'Moradia', 'expense'],
  [/médico|medico|farmácia|farmacia|saúde|saude|plano de saúde|hospital|dentista|remédio/i, 'Saúde', 'expense'],
  [/netflix|spotify|disney|amazon|assinatura|streaming|lazer|cinema|show|teatro/i, 'Lazer', 'expense'],
  [/escola|faculdade|curso|livro|educação|educacao|aula|mensalidade/i, 'Educação', 'expense'],
  [/shopping|roupa|sapato|compra|loja/i, 'Compras', 'expense'],
  [/salário|salario|pagamento|holerite/i, 'Salário', 'income'],
  [/freela|freelance|serviço|servico|trabalho/i, 'Freelance', 'income'],
  [/investimento|rendimento|dividendo|juros/i, 'Investimentos', 'income'],
]

function parseVoice(text: string): ParsedTransaction {
  const lower = text.toLowerCase()

  // Tipo: receita ou despesa
  const incomeWords = /receita|salário|salario|entrada|renda|receb|ganh|paguei não|depositaram|caiu na conta/i
  const type: 'income' | 'expense' = incomeWords.test(lower) ? 'income' : 'expense'

  // Valor: "50 reais", "50,00", "R$50", "mil e quinhentos"
  let amount = ''
  const numMatch = lower.match(/(\d+(?:[,\.]\d{1,2})?)/)
  if (numMatch) {
    amount = numMatch[1].replace('.', ',')
    if (!amount.includes(',')) amount += ',00'
  }

  // Categoria
  let category = type === 'income' ? 'Salário' : 'Outros'
  for (const [regex, cat, catType] of CATEGORY_MAP) {
    if (regex.test(lower) && (catType === 'any' || catType === type)) {
      category = cat
      break
    }
  }

  // Descrição: remove palavras de comando e valores
  const description = text
    .replace(/(?:adicionar?|criar?|nova?|novo?|registrar?|lançar?)\s+(?:uma?\s+)?(?:despesa|receita|transação|gasto|lançamento)\s+(?:de\s+)?/gi, '')
    .replace(/\d+(?:[,\.]\d{1,2})?\s*reais?/gi, '')
    .replace(/r\$\s*\d+(?:[,\.]\d{1,2})?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:de|no|na|em|para|com)\s+/i, '')
    .trim()

  return {
    type,
    amount,
    category,
    description: description || (type === 'income' ? 'Receita' : 'Despesa'),
    date: new Date().toISOString().split('T')[0],
  }
}

type State = 'idle' | 'listening' | 'done' | 'unsupported' | 'error'

export default function VoiceButton({ onResult }: Props) {
  const [state, setState] = useState<State>('idle')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setState('unsupported'); return }

    const r = new SR()
    r.lang = 'pt-BR'
    r.continuous = false
    r.interimResults = false
    r.maxAlternatives = 1
    recognitionRef.current = r

    r.onstart = () => { setState('listening'); setTranscript('') }
    r.onend = () => setState(s => s === 'listening' ? 'idle' : s)
    r.onerror = () => setState('error')

    r.onresult = (e: any) => {
      const text: string = e.results[0][0].transcript
      setTranscript(text)
      setState('done')
      const parsed = parseVoice(text)
      setTimeout(() => {
        onResult(parsed)
        setTranscript('')
        setState('idle')
      }, 800)
    }

    r.start()
  }, [onResult])

  function stopListening() {
    recognitionRef.current?.stop()
    setState('idle')
  }

  if (state === 'unsupported') return null

  const LIME = '#C9F042'
  const isListening = state === 'listening'
  const isDone = state === 'done'

  return (
    <div className="fixed bottom-6 right-5 z-40 flex flex-col items-end gap-2">
      {/* Balão com o que foi reconhecido */}
      {(transcript || isListening) && (
        <div className="bg-[#0A0A0A] rounded-2xl px-4 py-2.5 shadow-xl text-xs font-semibold text-white max-w-[220px] text-right border border-white/10">
          {isListening ? (
            <span className="flex items-center gap-2 justify-end">
              <span className="flex gap-0.5 items-end h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-0.5 rounded-full animate-bounce"
                    style={{ height: `${6 + i * 3}px`, backgroundColor: LIME, animationDelay: `${i * 0.12}s` }} />
                ))}
              </span>
              Ouvindo...
            </span>
          ) : (
            <span style={{ color: LIME }}>&ldquo;{transcript}&rdquo;</span>
          )}
        </div>
      )}

      {/* Botão mic */}
      <button
        onClick={isListening ? stopListening : startListening}
        className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90"
        style={{
          backgroundColor: isListening ? '#F43F5E' : isDone ? LIME : LIME,
          boxShadow: isListening
            ? '0 0 0 8px rgba(244,63,94,0.15), 0 8px 24px rgba(0,0,0,0.3)'
            : `0 0 0 4px ${LIME}20, 0 8px 24px rgba(0,0,0,0.25)`,
        }}
        title={isListening ? 'Parar' : 'Comando de voz'}
      >
        {isListening ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
          </svg>
        ) : isDone ? (
          <svg className="w-6 h-6 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-[#0A0A0A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Label */}
      {!isListening && !isDone && (
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">Voz</p>
      )}
    </div>
  )
}
