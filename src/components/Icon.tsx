import type { LucideIcon } from 'lucide-react'
import * as Icons from '../lib/icons'

interface IconProps {
  name: keyof typeof Icons
  size?: number
  className?: string
}

export default function Icon({ name, size = 20, className = '' }: IconProps) {
  const IconComponent = Icons[name] as LucideIcon | undefined

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`)
    return null
  }

  return <IconComponent size={size} className={className} />
}
