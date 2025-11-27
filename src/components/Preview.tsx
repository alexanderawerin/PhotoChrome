import { useEffect, useRef } from 'react'
import { Card } from './ui/card'

interface PreviewProps {
  imageData: ImageData | null
  alt?: string
}

export function Preview({ imageData, alt = 'Preview' }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!imageData || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = imageData.width
    canvas.height = imageData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(imageData, 0, 0)
  }, [imageData])

  if (!imageData) {
    return (
      <Card className="w-full aspect-video flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Нет изображения</p>
      </Card>
    )
  }

  return (
    <Card className="w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        aria-label={alt}
      />
    </Card>
  )
}

