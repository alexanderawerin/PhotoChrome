import { useMemo } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const SPINNER_COLORS = [
  "text-red-500",
  "text-green-500",
  "text-blue-500",
  "text-yellow-500",
  "text-purple-500",
] as const

function Spinner({ className, randomColor = false, ...props }: React.ComponentProps<"svg"> & { randomColor?: boolean }) {
  const colorClass = useMemo(() => {
    if (!randomColor) return ""
    return SPINNER_COLORS[Math.floor(Math.random() * SPINNER_COLORS.length)]
  }, [randomColor])

  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", randomColor && colorClass, className)}
      {...props}
    />
  )
}

export { Spinner }

