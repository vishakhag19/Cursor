import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  Search,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  CheckCircle,
  X,
  Search,
  Plus,
  Settings,
  Info,
  AlertCircle,
  AlertTriangle,
}

export interface SemanticIconProps {
  role: string
  map: Record<string, string>
  strokeWidth?: number
  size?: number
  className?: string
}

export function SemanticIcon({
  role,
  map,
  strokeWidth = 1.75,
  size = 16,
  className,
}: SemanticIconProps) {
  const iconName = map[role]
  const Icon = iconName ? ICON_MAP[iconName] : undefined

  if (!Icon) return null

  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}
