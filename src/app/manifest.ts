import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Controle de Contas',
    short_name: 'Conta+',
    description: 'Gestão financeira pessoal',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A0A',
    theme_color: '#0A0A0A',
    categories: ['finance'],
    icons: [
      { src: '/api/icon?s=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/icon?s=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Nova despesa',
        url: '/?voz=despesa',
        description: 'Lançar uma nova despesa',
      },
      {
        name: 'Nova receita',
        url: '/?voz=receita',
        description: 'Lançar uma nova receita',
      },
    ],
  }
}
