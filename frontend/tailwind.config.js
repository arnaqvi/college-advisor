/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        accent: 'var(--accent)',
        'accent-contrast': 'var(--accent-contrast)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        border: 'var(--border)',
        aquamarine: 'var(--aquamarine)',
        ink: 'var(--ink)',
        offwhite: 'var(--offwhite)',
        reach: 'var(--reach)',
        'reach-bg': 'var(--reach-bg)',
        target: 'var(--target)',
        'target-bg': 'var(--target-bg)',
        safety: 'var(--safety)',
        'safety-bg': 'var(--safety-bg)',
      },
    },
  },
  plugins: [],
}
