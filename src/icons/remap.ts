import type { IconLibraryId, SemanticIconRole } from '@/schema/types'

type SemanticMap = Record<string, string>

const LIBRARY_MAP: Record<IconLibraryId, SemanticMap> = {
  lucide: {
    'navigation.back': 'ArrowLeft',
    'navigation.forward': 'ArrowRight',
    'navigation.menu': 'Menu',
    'navigation.close': 'X',
    'navigation.home': 'Home',
    'action.search': 'Search',
    'action.add': 'Plus',
    'action.edit': 'Pencil',
    'action.delete': 'Trash2',
    'action.settings': 'Settings',
    'action.copy': 'Copy',
    'action.more': 'MoreHorizontal',
    'action.external': 'ExternalLink',
    'feedback.success': 'CircleCheck',
    'feedback.warning': 'TriangleAlert',
    'feedback.error': 'CircleX',
    'feedback.info': 'Info',
    'feedback.loading': 'LoaderCircle',
    'disclosure.expand': 'ChevronDown',
    'disclosure.next': 'ChevronRight',
    'user.profile': 'User',
    'communication.notification': 'Bell',
  },
  phosphor: {
    'navigation.back': 'ArrowLeft',
    'navigation.forward': 'ArrowRight',
    'navigation.menu': 'List',
    'navigation.close': 'X',
    'navigation.home': 'House',
    'action.search': 'MagnifyingGlass',
    'action.add': 'Plus',
    'action.edit': 'PencilSimple',
    'action.delete': 'Trash',
    'action.settings': 'Gear',
    'action.copy': 'Copy',
    'action.more': 'DotsThree',
    'action.external': 'ArrowSquareOut',
    'feedback.success': 'CheckCircle',
    'feedback.warning': 'Warning',
    'feedback.error': 'XCircle',
    'feedback.info': 'Info',
    'feedback.loading': 'CircleNotch',
    'disclosure.expand': 'CaretDown',
    'disclosure.next': 'CaretRight',
    'user.profile': 'User',
    'communication.notification': 'Bell',
  },
  tabler: {
    'navigation.back': 'IconArrowLeft',
    'navigation.forward': 'IconArrowRight',
    'navigation.menu': 'IconMenu2',
    'navigation.close': 'IconX',
    'navigation.home': 'IconHome',
    'action.search': 'IconSearch',
    'action.add': 'IconPlus',
    'action.edit': 'IconPencil',
    'action.delete': 'IconTrash',
    'action.settings': 'IconSettings',
    'action.copy': 'IconCopy',
    'action.more': 'IconDots',
    'action.external': 'IconExternalLink',
    'feedback.success': 'IconCircleCheck',
    'feedback.warning': 'IconAlertTriangle',
    'feedback.error': 'IconCircleX',
    'feedback.info': 'IconInfoCircle',
    'feedback.loading': 'IconLoader2',
    'disclosure.expand': 'IconChevronDown',
    'disclosure.next': 'IconChevronRight',
    'user.profile': 'IconUser',
    'communication.notification': 'IconBell',
  },
  heroicons: {
    'navigation.back': 'ArrowLeftIcon',
    'navigation.forward': 'ArrowRightIcon',
    'navigation.menu': 'Bars3Icon',
    'navigation.close': 'XMarkIcon',
    'navigation.home': 'HomeIcon',
    'action.search': 'MagnifyingGlassIcon',
    'action.add': 'PlusIcon',
    'action.edit': 'PencilIcon',
    'action.delete': 'TrashIcon',
    'action.settings': 'Cog6ToothIcon',
    'action.copy': 'ClipboardIcon',
    'action.more': 'EllipsisHorizontalIcon',
    'action.external': 'ArrowTopRightOnSquareIcon',
    'feedback.success': 'CheckCircleIcon',
    'feedback.warning': 'ExclamationTriangleIcon',
    'feedback.error': 'XCircleIcon',
    'feedback.info': 'InformationCircleIcon',
    'feedback.loading': 'ArrowPathIcon',
    'disclosure.expand': 'ChevronDownIcon',
    'disclosure.next': 'ChevronRightIcon',
    'user.profile': 'UserIcon',
    'communication.notification': 'BellIcon',
  },
  material: {
    'navigation.back': 'arrow_back',
    'navigation.forward': 'arrow_forward',
    'navigation.menu': 'menu',
    'navigation.close': 'close',
    'navigation.home': 'home',
    'action.search': 'search',
    'action.add': 'add',
    'action.edit': 'edit',
    'action.delete': 'delete',
    'action.settings': 'settings',
    'action.copy': 'content_copy',
    'action.more': 'more_horiz',
    'action.external': 'open_in_new',
    'feedback.success': 'check_circle',
    'feedback.warning': 'warning',
    'feedback.error': 'cancel',
    'feedback.info': 'info',
    'feedback.loading': 'progress_activity',
    'disclosure.expand': 'expand_more',
    'disclosure.next': 'chevron_right',
    'user.profile': 'person',
    'communication.notification': 'notifications',
  },
}

/** Roles that often need human review when leaving Lucide (naming drift). */
const REVIEW_SENSITIVE: string[] = [
  'action.more',
  'action.external',
  'feedback.loading',
  'communication.notification',
]

export function remapSemanticIcons(
  current: SemanticMap,
  _from: IconLibraryId,
  to: IconLibraryId,
): { map: SemanticMap; reviewFlags: SemanticIconRole[] } {
  const target = LIBRARY_MAP[to]
  const map: SemanticMap = {}
  const reviewFlags: string[] = []

  for (const role of Object.keys(current)) {
    if (target[role]) {
      map[role] = target[role]!
      if (REVIEW_SENSITIVE.includes(role) && to !== 'lucide') {
        reviewFlags.push(role)
      }
    } else {
      map[role] = current[role]!
      reviewFlags.push(role)
    }
  }

  // Ensure library defaults exist for known roles
  for (const [role, icon] of Object.entries(target)) {
    if (!map[role]) map[role] = icon
  }

  return { map, reviewFlags: reviewFlags as SemanticIconRole[] }
}

export function getIconPackage(libraryId: IconLibraryId): { name: string; importHint: string } {
  switch (libraryId) {
    case 'lucide':
      return { name: 'lucide-react', importHint: "import { ArrowLeft } from 'lucide-react'" }
    case 'phosphor':
      return { name: '@phosphor-icons/react', importHint: "import { ArrowLeft } from '@phosphor-icons/react'" }
    case 'tabler':
      return { name: '@tabler/icons-react', importHint: "import { IconArrowLeft } from '@tabler/icons-react'" }
    case 'heroicons':
      return { name: '@heroicons/react', importHint: "import { ArrowLeftIcon } from '@heroicons/react/24/outline'" }
    case 'material':
      return { name: '@material-symbols/svg-400', importHint: 'Use Material Symbols font or SVG package' }
  }
}
