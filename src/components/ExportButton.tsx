import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from './ui/button'

interface ExportButtonProps {
  onExport: () => Promise<void>
  disabled?: boolean
}

export function ExportButton({ onExport, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await onExport()
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className="gap-2"
    >
      <Download className="w-4 h-4" />
      {isExporting ? 'Экспорт...' : 'Скачать'}
    </Button>
  )
}

