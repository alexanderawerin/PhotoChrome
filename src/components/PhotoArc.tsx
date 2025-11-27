// Градиенты для имитации разных фото с плёночными эффектами
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
]

const CARD_SIZE = 110

export function PhotoArc() {
  const totalCards = 11
  const arcRadius = 300 // уменьшенный радиус
  const arcSpan = 180
  
  const positions = Array.from({ length: totalCards }, (_, i) => {
    const angle = -arcSpan / 2 + (arcSpan / (totalCards - 1)) * i
    const angleRad = (angle * Math.PI) / 180
    
    const x = Math.sin(angleRad) * arcRadius
    const y = -Math.cos(angleRad) * arcRadius * 0.6
    
    const distFromCenter = Math.abs(i - (totalCards - 1) / 2)
    const z = totalCards - Math.floor(distFromCenter)
    
    return { rotate: angle * 0.35, translateX: x, translateY: y, z }
  })

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Карточки */}
      <div className="absolute inset-0 flex items-center justify-center">
        {positions.map((pos, index) => (
          <div
            key={index}
            className="absolute"
            style={{
              transform: `translateX(${pos.translateX}px) translateY(${pos.translateY - 60}px) rotate(${pos.rotate}deg)`,
              zIndex: pos.z,
            }}
          >
            <div 
              className="rounded-2xl overflow-hidden shadow-2xl shadow-black/70"
              style={{ width: CARD_SIZE, height: CARD_SIZE, background: CARD_GRADIENTS[index] }}
            >
              <div 
                className="w-full h-full"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 50%)' }}
              />
            </div>
          </div>
        ))}
      </div>
      
      {/* Fade слева */}
      <div 
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: '25%',
          background: 'linear-gradient(to right, rgb(9, 9, 11) 0%, rgb(9, 9, 11) 40%, rgba(9, 9, 11, 0.6) 70%, transparent 100%)',
          zIndex: 20,
        }}
      />
      {/* Fade справа */}
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
