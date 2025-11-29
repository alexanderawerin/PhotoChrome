import { PHOTO_ARC } from '../constants'

/** Gradient backgrounds for decorative cards representing different film looks */
const CARD_GRADIENTS = [
  'linear-gradient(135deg, #2d1f3d 0%, #614385 50%, #516395 100%)',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear-gradient(135deg, #3d2914 0%, #6b4423 50%, #8b6914 100%)',
  'linear-gradient(135deg, #134e5e 0%, #71b280 50%, #c9d99e 100%)',
  'linear-gradient(135deg, #232526 0%, #414345 50%, #606060 100%)',
  'linear-gradient(135deg, #4a1c40 0%, #8e3a59 50%, #c96480 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  'linear-gradient(135deg, #3e2723 0%, #5d4037 50%, #8d6e63 100%)',
  'linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #4a90a4 100%)',
  'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #87ceeb 100%)',
  'linear-gradient(135deg, #355c7d 0%, #6c5b7b 50%, #c06c84 100%)',
] as const

/** Rotation factor for cards based on their angle in the arc */
const ROTATION_FACTOR = 0.35

/** Y-axis scaling factor for the arc (makes it elliptical) */
const Y_SCALE_FACTOR = 0.6

/** Vertical offset for the entire arc */
const Y_OFFSET = -60

/**
 * Calculates position for each card in the arc.
 */
function calculateCardPositions(cardCount: number, radius: number, spanDegrees: number) {
  return Array.from({ length: cardCount }, (_, i) => {
    const angle = -spanDegrees / 2 + (spanDegrees / (cardCount - 1)) * i
    const angleRad = (angle * Math.PI) / 180
    
    const x = Math.sin(angleRad) * radius
    const y = -Math.cos(angleRad) * radius * Y_SCALE_FACTOR
    
    // Cards closer to center have higher z-index
    const distFromCenter = Math.abs(i - (cardCount - 1) / 2)
    const z = cardCount - Math.floor(distFromCenter)
    
    return { 
      rotate: angle * ROTATION_FACTOR, 
      translateX: x, 
      translateY: y + Y_OFFSET, 
      z 
    }
  })
}

/**
 * Decorative arc of gradient cards displayed on the landing screen.
 * Purely visual element, hidden from screen readers.
 */
export function PhotoArc() {
  const positions = calculateCardPositions(
    PHOTO_ARC.CARD_COUNT,
    PHOTO_ARC.RADIUS,
    PHOTO_ARC.SPAN_DEGREES
  )

  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 10 }}
      aria-hidden="true"
      role="presentation"
    >
      {/* Decorative cards */}
      <div className="absolute inset-0 flex items-center justify-center">
        {positions.map((pos, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              transform: `translateX(${pos.translateX}px) translateY(${pos.translateY}px) rotate(${pos.rotate}deg)`,
              zIndex: pos.z,
            }}
          >
            <div 
              className="rounded-2xl overflow-hidden shadow-2xl shadow-black/70"
              style={{ 
                width: PHOTO_ARC.CARD_SIZE, 
                height: PHOTO_ARC.CARD_SIZE, 
                background: CARD_GRADIENTS[index % CARD_GRADIENTS.length] 
              }}
            >
              {/* Light reflection effect */}
              <div 
                className="w-full h-full"
                style={{ 
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 50%)' 
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Left fade gradient */}
      <div 
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: '25%',
          background: 'linear-gradient(to right, rgb(9, 9, 11) 0%, rgb(9, 9, 11) 40%, rgba(9, 9, 11, 0.6) 70%, transparent 100%)',
          zIndex: 20,
        }}
      />
      {/* Right fade gradient */}
      <div 
        className="absolute right-0 top-0 bottom-0"
        style={{
          width: '25%',
          background: 'linear-gradient(to left, rgb(9, 9, 11) 0%, rgb(9, 9, 11) 40%, rgba(9, 9, 11, 0.6) 70%, transparent 100%)',
          zIndex: 20,
        }}
      />
    </div>
  )
}
