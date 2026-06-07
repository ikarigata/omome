/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        gothic: ['"DotGothic16"', 'sans-serif'],
      },
      colors: {
        'surface-primary': 'rgb(var(--color-surface-primary) / <alpha-value>)',
        'surface-secondary': 'rgb(var(--color-surface-secondary) / <alpha-value>)',
        'surface-container': 'rgb(var(--color-surface-container) / <alpha-value>)',
        'surface-pure': 'rgb(var(--color-surface-pure) / <alpha-value>)',
        'content-primary': 'rgb(var(--color-content-primary) / <alpha-value>)',
        'content-secondary': 'rgb(var(--color-content-secondary) / <alpha-value>)',
        'content-accent': 'rgb(var(--color-content-accent) / <alpha-value>)',
        'content-inverse': 'rgb(var(--color-content-inverse) / <alpha-value>)',
        'interactive-primary': 'rgb(var(--color-interactive-primary) / <alpha-value>)',
        'interactive-hover': 'rgb(var(--color-interactive-hover) / <alpha-value>)',
        'navigation-bg': 'rgb(var(--color-navigation-bg) / <alpha-value>)',
        'navigation-text': 'rgb(var(--color-navigation-text) / <alpha-value>)',
        'input-bg': 'rgb(var(--color-input-bg) / <alpha-value>)',
        'input-text': 'rgb(var(--color-input-text) / <alpha-value>)',
        'input-placeholder': 'rgb(var(--color-input-placeholder) / <alpha-value>)',
        'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
