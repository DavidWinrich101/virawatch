/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary Background - Deep Midnight Navy
        'virawatch-bg': '#080912',
        
        // Surfaces
        'virawatch-surface': '#111827',
        'virawatch-elevated': '#1A2233',
        'virawatch-border': '#2A3446',
        
        // Primary Accent - Medical Cyan
        'virawatch-cyan': '#00C8F8',
        'virawatch-cyan-dark': '#0099CC',
        'virawatch-cyan-light': '#33D6FF',
        
        // Secondary Accent - Electric Blue
        'virawatch-blue': '#3B82F6',
        
        // Risk Colours
        'virawatch-minimal': '#10B981',   // Emerald
        'virawatch-low': '#00C8F8',       // Cyan
        'virawatch-moderate': '#F59E0B',  // Amber
        'virawatch-high': '#F97316',      // Orange
        'virawatch-critical': '#EF4444',  // Red
        
        // Status
        'virawatch-success': '#10B981',
        'virawatch-info': '#38BDF8',
        'virawatch-warning': '#F59E0B',
        'virawatch-error': '#EF4444',
        'virawatch-offline': '#D97706',   // Gold
        
        // Endemic Status (Muted)
        'virawatch-endemic-bg': '#4B1D22',
        'virawatch-endemic-text': '#FF6B6B',
        'virawatch-nonendemic-bg': '#123D34',
        'virawatch-nonendemic-text': '#34D399',
        
        // Typography
        'virawatch-heading': '#F8FAFC',
        'virawatch-subheading': '#E2E8F0',
        'virawatch-body': '#CBD5E1',
        'virawatch-meta': '#94A3B8',
        'virawatch-disabled': '#64748B',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '12px',
        'badge': '20px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'elevated': '0 4px 16px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(0, 200, 248, 0.1)',
      },
      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
}