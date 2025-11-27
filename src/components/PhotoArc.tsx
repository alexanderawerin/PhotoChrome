import { Card } from './ui/card'

interface PhotoArcProps {
  recipes: string[]
}

export function PhotoArc({ recipes }: PhotoArcProps) {
  // Позиции карточек по дуге
  const positions = [
    { rotate: -25, translateY: 120, translateX: -280 },
    { rotate: -18, translateY: 60, translateX: -200 },
    { rotate: -10, translateY: 20, translateX: -120 },
    { rotate: 0, translateY: 0, translateX: 0 },
    { rotate: 10, translateY: 20, translateX: 120 },
    { rotate: 18, translateY: 60, translateX: 200 },
    { rotate: 25, translateY: 120, translateX: 280 },
  ]

  return (
    <div className="relative h-64 w-full flex items-center justify-center mb-12">
      {recipes.slice(0, 7).map((recipe, index) => {
        const pos = positions[index]
        return (
          <div
            key={recipe}
            className="absolute transition-all duration-300 hover:scale-110 hover:z-10"
            style={{
              transform: `
                translateX(${pos.translateX}px) 
                translateY(${pos.translateY}px) 
                rotate(${pos.rotate}deg)
              `,
            }}
          >
            <Card className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700 overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                {recipe}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

