import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Copy,
  ExternalLink,
  Home,
  Info,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  TriangleAlert,
  User,
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
  CircleCheck,
  CircleX,
  X,
  Search,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Info,
  AlertCircle,
  AlertTriangle,
  TriangleAlert,
  LoaderCircle,
  Menu,
  Home,
  User,
  Bell,
  Copy,
  ExternalLink,
  MoreHorizontal,
}

export interface SemanticIconProps {
  role: string
  map: Record<string, string>
  strokeWidth?: number
  size?: number
  className?: string
  color?: string
}

export function SemanticIcon({
  role,
  map,
  strokeWidth = 1.75,
  size = 16,
  className,
  color,
}: SemanticIconProps) {
  const iconId = map[role]
  const Icon = (iconId && ICON_MAP[iconId]) || Info
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={color ? { color } : undefined}
      aria-hidden
    />
  )
}

export function resolveLucideIcon(iconId: string): LucideIcon {
  return ICON_MAP[iconId] ?? Info
}

export const AVAILABLE_LUCIDE_ICONS = Object.keys(ICON_MAP)
