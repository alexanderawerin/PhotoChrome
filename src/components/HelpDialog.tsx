import { useEffect, useState } from 'react'
import { Bug, Lightbulb, Github } from 'lucide-react'
import { GITHUB_REPO_URL } from '../constants'
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
  mobile?: boolean
  hasUnreadUpdate?: boolean
  onUpdateViewed?: () => void
}

type Tab = 'quick-guide' | 'whats-new' | 'shortcuts' | 'feedback'

const WHATS_NEW = [
  {
    version: '1.6',
    items: [
      'Export all photos at once as a ZIP archive',
    ],
  },
  {
    version: '1.5',
    items: [
      'Smart Picks: recipe recommendations tailored to your photo',
      "Editor's Choice now also visible on mobile",
    ],
  },
  {
    version: '1.4',
    items: [
      '100 ready-made film recipes to choose from',
      'Set white balance by color temperature (Kelvin)',
      "Editor's Choice: a curated selection of top recipes",
      'Send feedback directly from the app',
    ],
  },
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
  { keys: ['F'], description: 'Flip horizontally' },
  { keys: ['T'], description: 'Open Adjust inspector' },
  { keys: ['P'], description: 'Toggle inspector' },
  { keys: ['Space'], description: 'Compare before/after (hold)' },
  { keys: ['Esc'], description: 'Cancel crop/tuning' },
  { keys: ['Enter'], description: 'Apply crop/tuning' },
  { keys: ['⌘/Ctrl', 'S'], description: 'Export image' },
]

const MULTI_IMAGE_SHORTCUTS = [
  { keys: ['←'], description: 'Previous image' },
  { keys: ['→'], description: 'Next image' },
]

export function HelpDialog({
  isOpen,
  onClose,
  totalImages = 1,
  mobile = false,
  hasUnreadUpdate = false,
  onUpdateViewed,
}: HelpDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>(hasUnreadUpdate ? 'whats-new' : 'quick-guide')

  useEffect(() => {
    if (!isOpen) return
    setActiveTab(hasUnreadUpdate ? 'whats-new' : 'quick-guide')
  }, [isOpen, hasUnreadUpdate])

  const keyboardShortcuts = totalImages > 1
    ? [...BASE_KEYBOARD_SHORTCUTS, ...MULTI_IMAGE_SHORTCUTS]
    : BASE_KEYBOARD_SHORTCUTS

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (open) return
        if (hasUnreadUpdate) onUpdateViewed?.()
        onClose()
      }}
    >
      <SheetContent className="bg-zinc-900 border-zinc-800 w-[320px] sm:w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="sr-only">Photochrome help</SheetTitle>
          <SheetDescription className="sr-only">
            Help and release notes
          </SheetDescription>
        </SheetHeader>

        {/* Tab buttons */}
        <div className="flex border-b border-zinc-800 mt-4" role="tablist">
          <button
            onClick={() => setActiveTab('quick-guide')}
            className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'quick-guide'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'quick-guide'}
            role="tab"
          >
            Quick Guide
          </button>
          <button
            onClick={() => setActiveTab('whats-new')}
            className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'whats-new'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'whats-new'}
            role="tab"
          >
            What's New
          </button>
          {!mobile && <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'shortcuts'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'shortcuts'}
            role="tab"
          >
            Shortcuts
          </button>}
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 min-h-11 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'feedback'
                ? 'text-white border-b-2 border-white -mb-px'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'feedback'}
            role="tab"
          >
            Feedback
          </button>
        </div>

        {/* Content */}
        <div className="py-4">
          {activeTab === 'quick-guide' && <QuickGuideContent />}
          {activeTab === 'whats-new' && <WhatsNewContent />}
          {activeTab === 'shortcuts' && <ShortcutsContent shortcuts={keyboardShortcuts} />}
          {activeTab === 'feedback' && <FeedbackContent />}
        </div>

        {/* Disclaimer */}
        <div className="pt-4 mt-4 border-t border-zinc-800">
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            This app is not affiliated with, endorsed by, or connected to FUJIFILM Corporation. 
            Film simulation names are used for reference purposes only.
          </p>
          <p className="text-[11px] text-zinc-400 mt-2">
            Made by{' '}
            <a 
              href="https://netdesigner.ru" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Alexander Awerin
            </a>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function QuickGuideContent() {
  const steps = [
    ['Add photos', 'Upload one or more photos. Swipe the photo to move through a batch.'],
    ['Presets', 'Choose a film preset, use Smart Picks, or hold the photo to compare before and after.'],
    ['Adjust', 'Open a tool, preview changes live, then use Done or Cancel.'],
    ['Crop', 'Crop, rotate, or flip without changing the other photos in the batch.'],
    ['Batch', 'Apply preset and Adjust settings to all. Crop, Rotate, and Flip stay per photo.'],
    ['Export', 'Export the current photo or export every photo that has a preset.'],
  ]
  return (
    <ol className="space-y-3">
      {steps.map(([title, description], index) => (
        <li key={title} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-400">
            {index + 1}
          </span>
          <div>
            <p className="font-medium text-zinc-200">{title}</p>
            <p className="mt-0.5 text-zinc-400">{description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function WhatsNewContent() {
  return (
    <div className="space-y-5">
      {WHATS_NEW.map((release) => (
        <div key={release.version}>
          <h3 className="text-xs font-semibold text-zinc-400 mb-2">
            Version {release.version}
          </h3>
          <ul className="space-y-1.5">
            {release.items.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-zinc-400 mt-0.5">•</span>
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

function FeedbackContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Help improve Photochrome — report bugs or suggest new features on GitHub.
      </p>
      <div className="space-y-2">
        <a
          href={`${GITHUB_REPO_URL}/issues/new?template=bug_report.yml`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-zinc-300"
        >
          <Bug className="w-4 h-4 text-zinc-500" />
          Report a Bug
        </a>
        <a
          href={`${GITHUB_REPO_URL}/issues/new?template=feature_request.yml`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm text-zinc-300"
        >
          <Lightbulb className="w-4 h-4 text-zinc-500" />
          Request a Feature
        </a>
      </div>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Github className="w-3.5 h-3.5" />
        View on GitHub
      </a>
    </div>
  )
}
