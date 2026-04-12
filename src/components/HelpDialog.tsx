import { useState } from 'react'
import { APP_VERSION } from '../constants'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from './ui/sheet'
import { Kbd, KbdGroup } from './ui/kbd'

interface HelpDialogProps {
  isOpen: boolean
  onClose: () => void
  totalImages?: number
}

type Tab = 'whats-new' | 'shortcuts'

const WHATS_NEW = [
  {
    version: '1.3',
    items: [
      'More accurate colors based on real Fujifilm camera profiles',
      'Faster processing with GPU acceleration',
    ],
  },
  {
    version: '1.2',
    items: [
      'Edit multiple photos at once, each with its own preset',
      'Swipe between photos on mobile',
      'Quick photo navigation with thumbnails',
      'Apply one preset to all photos at once',
    ],
  },
  {
    version: '1.1',
    items: [
      'Apply film simulations to videos (up to 30 sec)',
      'Faster and smoother editing',
    ],
  },
  {
    version: '1.0',
    items: [
      'Apply Fujifilm film simulations to your photos',
      '52 ready-made presets to choose from',
      'Fine-tune any preset to your taste',
      'Crop and rotate your photos',
      'Save your favorite presets',
    ],
  },
]

const BASE_KEYBOARD_SHORTCUTS = [
  { keys: ['R'], description: 'Rotate clockwise' },
  { keys: ['Shift', 'R'], description: 'Rotate counter-clockwise' },
  { keys: ['C'], description: 'Open crop mode' },
  { keys: ['T'], description: 'Toggle fine-tune panel' },
  { keys: ['P'], description: 'Toggle side panel' },
  { keys: ['Space'], description: 'Compare before/after (hold)' },
  { keys: ['Esc'], description: 'Cancel crop/tuning' },
  { keys: ['Enter'], description: 'Apply crop/tuning' },
  { keys: ['⌘/Ctrl', 'S'], description: 'Export image' },
]

const MULTI_IMAGE_SHORTCUTS = [
  { keys: ['←'], description: 'Previous image' },
  { keys: ['→'], description: 'Next image' },
]

export function HelpDialog({ isOpen, onClose, totalImages = 1 }: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('whats-new')

  const keyboardShortcuts = totalImages > 1
    ? [...BASE_KEYBOARD_SHORTCUTS, ...MULTI_IMAGE_SHORTCUTS]
    : BASE_KEYBOARD_SHORTCUTS

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-zinc-900 border-zinc-800 w-[320px] sm:w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-white">
            Photochrome
            <sup className="text-[10px] text-zinc-500 ml-1">{APP_VERSION}</sup>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Help and release notes
          </SheetDescription>
        </SheetHeader>

        {/* Tab buttons */}
        <div className="flex border-b border-zinc-800 mt-4">
          <button
            onClick={() => setActiveTab('whats-new')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'whats-new'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            aria-selected={activeTab === 'whats-new'}
            role="tab"
          >
            New
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'shortcuts'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            aria-selected={activeTab === 'shortcuts'}
            role="tab"
          >
            Shortcuts
          </button>
        </div>

        {/* Content */}
        <div className="py-4">
          {activeTab === 'whats-new' && <WhatsNewContent />}
          {activeTab === 'shortcuts' && <ShortcutsContent shortcuts={keyboardShortcuts} />}
        </div>

        {/* Disclaimer */}
        <div className="pt-4 mt-4 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-600 leading-relaxed">
            This app is not affiliated with, endorsed by, or connected to FUJIFILM Corporation. 
            Film simulation names are used for reference purposes only.
          </p>
          <p className="text-[11px] text-zinc-600 mt-2">
            Made by{' '}
            <a 
              href="https://netdesigner.ru" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              Alexander Awerin
            </a>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function WhatsNewContent() {
  return (
    <div className="space-y-5">
      {WHATS_NEW.map((release) => (
        <div key={release.version}>
          <h3 className="text-xs font-semibold text-zinc-500 mb-2">
            Version {release.version}
          </h3>
          <ul className="space-y-1.5">
            {release.items.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-zinc-600 mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

interface ShortcutsContentProps {
  shortcuts: Array<{ keys: string[]; description: string }>
}

function ShortcutsContent({ shortcuts }: ShortcutsContentProps) {
  return (
    <div className="space-y-1">
      {shortcuts.map((shortcut, index) => (
        <div
          key={index}
          className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0"
        >
          <span className="text-sm text-zinc-400">{shortcut.description}</span>
          <KbdGroup>
            {shortcut.keys.map((key, keyIndex) => (
              <Kbd key={keyIndex}>{key}</Kbd>
            ))}
          </KbdGroup>
        </div>
      ))}
    </div>
  )
}
