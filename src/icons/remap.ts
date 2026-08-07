import type { IconLibraryId, SemanticIconRole } from '@/schema/types'

/** Maps semantic roles to equivalent icon names when switching libraries. */
const LIBRARY_MAP: Record<IconLibraryId, Record<SemanticIconRole, string>> = {
  lucide: {
    'navigation.back': 'ArrowLeft',
    'navigation.forward': 'ArrowRight',
    'navigation.menu': 'Menu',
    'navigation.close': 'X',
    'action.search': 'Search',
    'action.add': 'Plus',
    'action.edit': 'Pencil',
    'action.delete': 'Trash2',
    'action.settings': 'Settings',
    'feedback.success': 'CircleCheck',
    'feedback.warning': 'TriangleAlert',
    'feedback.error': 'CircleX',
    'feedback.info': 'Info',
    'feedback.loading': 'LoaderCircle',
  },
  phosphor: {
    'navigation.back': 'ArrowLeft',
    'navigation.forward': 'ArrowRight',
    'navigation.menu': 'List',
    'navigation.close': 'X',
    'action.search': 'MagnifyingGlass',
    'action.add': 'Plus',
    'action.edit': 'PencilSimple',
    'action.delete': 'Trash',
    'action.settings': 'Gear',
    'feedback.success': 'CheckCircle',
    'feedback.warning': 'Warning',
    'feedback.error': 'XCircle',
    'feedback.info': 'Info',
    'feedback.loading': 'CircleNotch',
  },
  tabler: {
    'navigation.back': 'IconArrowLeft',
    'navigation.forward': 'IconArrowRight',
    'navigation.menu': 'IconMenu2',
    'navigation.close': 'IconX',
    'action.search': 'IconSearch',
    'action.add': 'IconPlus',
    'action.edit': 'IconPencil',
    'action.delete': 'IconTrash',
    'action.settings': 'IconSettings',
    'feedback.success': 'IconCircleCheck',
    'feedback.warning': 'IconAlertTriangle',
    'feedback.error': 'IconCircleX',
    'feedback.info': 'IconInfoCircle',
    'feedback.loading': 'IconLoader2',
  },
  heroicons: {
    'navigation.back': 'ArrowLeftIcon',
    'navigation.forward': 'ArrowRightIcon',
    'navigation.menu': 'Bars3Icon',
    'navigation.close': 'XMarkIcon',
    'action.search': 'MagnifyingGlassIcon',
    'action.add': 'PlusIcon',
    'action.edit': 'PencilIcon',
    'action.delete': 'TrashIcon',
    'action.settings': 'Cog6ToothIcon',
    'feedback.success': 'CheckCircleIcon',
    'feedback.warning': 'ExclamationTriangleIcon',
    'feedback.error': 'XCircleIcon',
    'feedback.info': 'InformationCircleIcon',
    'feedback.loading': 'ArrowPathIcon',
  },
  material: {
    'navigation.back': 'arrow_back',
    'navigation.forward': 'arrow_forward',
    'navigation.menu': 'menu',
    'navigation.close': 'close',
    'action.search': 'search',
    'action.add': 'add',
    'action.edit': 'edit',
    'action.delete': 'delete',
    'action.settings': 'settings',
    'feedback.success': 'check_circle',
    'feedback.warning': 'warning',
    'feedback.error': 'cancel',
    'feedback.info': 'info',
    'feedback.loading': 'progress_activity',
  },
}

export function remapSemanticIcons(
  _current: Record<SemanticIconRole, string>,
  _from: IconLibraryId,
  to: IconLibraryId,
): Record<SemanticIconRole, string> {
  return { ...LIBRARY_MAP[to] }
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
