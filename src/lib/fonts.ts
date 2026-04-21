import { Inter } from 'next/font/google'

// Load local Prototype font
import localFont from 'next/font/local'

export const inter = Inter({ subsets: ['latin'] })

export const prototype = localFont({
  src: '../assets/fonts/Prototype.ttf',
  variable: '--font-prototype',
  weight: '400',
  display: 'swap',
})
