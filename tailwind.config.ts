// tailwind.config.ts — mapeia os tokens para classes (bg-surface, text-muted, ...). Nunca usar hex cru nos componentes.
import type { Config } from 'tailwindcss'

const v = (name: string) => `var(--color-${name})`

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg': v('bg'),
        'surface': v('surface'),
        'surface-2': v('surface-2'),
        'border': v('border'),
        'border-input': v('border-input'),
        'text': v('text'),
        'text-muted': v('text-muted'),
        'accent': v('accent'),
        'nexo-ponto': v('ponto'),
        'nexo-texto': v('ponto-texto'),
        'on-accent': v('on-accent'),
        'accent-soft': v('accent-soft'),
        'on-accent-soft': v('on-accent-soft'),
        'danger': v('danger'),
        'on-danger': v('on-danger'),
        'danger-soft': v('danger-soft'),
        'on-danger-soft': v('on-danger-soft'),
        'success': v('success'),
        'success-soft': v('success-soft'),
        'on-success-soft': v('on-success-soft'),
        'warning-soft': v('warning-soft'),
        'on-warning-soft': v('on-warning-soft'),
        'focus': v('focus'),
        'hero': v('hero'),
        'hero-2': v('hero-2'),
        'on-hero': v('on-hero'),
        'on-hero-muted': v('on-hero-muted'),
        'hero-line': v('hero-line'),
        'hero-hover': v('hero-hover'),
        'hero-active': v('hero-active'),
      },
      fontFamily: { sans: ['var(--font-sans)'], mono: ['var(--font-mono)'] },
      fontSize: {
        'xs': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'xl': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        '2xl': ['40px', { lineHeight: '48px', fontWeight: '700' }],
      },
      borderRadius: { sm: '4px', md: '8px', lg: '12px', full: '9999px' },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      maxWidth: { content: '1280px' },
      spacing: { sidebar: '240px', 'sidebar-collapsed': '64px', header: '56px' },
      transitionDuration: { fast: '120ms', base: '200ms' },
    },
  },
} satisfies Config
