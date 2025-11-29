import { useState, useEffect, useMemo } from 'react'
import { PHOTO_ARC } from '../constants'

/** Total number of processed card images available */
const TOTAL_CARD_IMAGES = 34

/**
 * Shuffles an array using Fisher-Yates algorithm.
 * Returns a new array without modifying the original.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Generates an array of random card image paths.
 * Ensures no duplicates if count <= total available images.
 */
function getRandomCardImages(count: number): string[] {
  const allIndexes = Array.from({ length: TOTAL_CARD_IMAGES }, (_, i) => i + 1)
  const shuffled = shuffleArray(allIndexes)
  
  return shuffled.slice(0, count).map(
    index => `/cards/card-${String(index).padStart(2, '0')}.jpg`
  )
}

/** Rotation factor for cards based on their angle */
const ROTATION_FACTOR = 1

/** Breakpoint for desktop (md) */
const DESKTOP_BREAKPOINT = 768

/**
 * Calculates positions for cards arranged in a circle.
 */
function calculateCirclePositions(cardCount: number, radius: number) {
  return Array.from({ length: cardCount }, (_, i) => {
    // Distribute cards evenly around the circle (360 degrees)
    const angle = (360 / cardCount) * i - 90 // Start from top (-90 degrees)
    const angleRad = (angle * Math.PI) / 180
    
    const x = Math.cos(angleRad) * radius
    const y = Math.sin(angleRad) * radius
    
    // Rotate card to face outward from center
    const rotate = angle + 90
    
    return { 
      rotate: rotate * ROTATION_FACTOR, 
      translateX: x, 
      translateY: y,
      angle
    }
  })
}

/**
 * Decorative circle of gradient cards displayed on the landing screen.
 * Purely visual element, hidden from screen readers.
 */
export function PhotoArc() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : true
  )

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const settings = isDesktop ? PHOTO_ARC.DESKTOP : PHOTO_ARC.MOBILE
  const positions = calculateCirclePositions(settings.CARD_COUNT, settings.RADIUS)
  
  // Generate random card images once on mount (stable across re-renders)
  const cardImages = useMemo(
    () => getRandomCardImages(Math.max(PHOTO_ARC.DESKTOP.CARD_COUNT, PHOTO_ARC.MOBILE.CARD_COUNT)),
    []
  )

  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 10 }}
      aria-hidden="true"
      role="presentation"
    >
      {/* Decorative cards in a circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        {positions.map((pos, index) => (
          <div
            key={index}
            className="absolute transition-transform duration-300"
            style={{
              transform: `translateX(${pos.translateX}px) translateY(${pos.translateY}px) rotate(${pos.rotate}deg)`,
            }}
          >
            <div 
              className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/70 transition-all duration-300 bg-zinc-900"
              style={{ 
                width: settings.CARD_SIZE, 
                height: settings.CARD_SIZE, 
              }}
            >
              {/* Card image */}
              <img
                src={cardImages[index]}
                alt=""
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              {/* Light reflection effect overlay */}
              <div 
                className="absolute inset-0"
                style={{ 
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08) 0%, transparent 50%)' 
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
