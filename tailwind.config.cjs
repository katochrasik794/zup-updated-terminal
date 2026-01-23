/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#8B5CF6',
                success: '#16A34A',
                danger: '#EF4444',
                info: '#3B82F6',
                warning: '#F59E0B',
                background: '#02040d',
                surface: '#02040d',
            },
            fontFamily: {
                sans: ['Manrope', 'Manrope Fallback', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
        },
    },
    plugins: [],
}
