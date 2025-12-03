import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Zap } from 'lucide-react'
import { Button } from './ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './ui/empty'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback UI to show instead of default error message */
  fallback?: ReactNode
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Detect browser name from user agent
 */
function getBrowserName(): string {
  const ua = navigator.userAgent
  
  if (ua.includes('YaBrowser')) return 'Yandex Browser'
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Firefox')) return 'Firefox'
  
  return 'Unknown'
}

/**
 * Error boundary component that catches JavaScript errors in child components.
 * Displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <Empty className="max-w-md border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-red-500/10 text-red-400 size-14 rounded-2xl [&_svg]:size-7">
                <Zap className="fill-current" />
              </EmptyMedia>
              <EmptyTitle className="text-xl text-white">
                Something went wrong
              </EmptyTitle>
              <EmptyDescription className="text-zinc-400">
                An unexpected error occurred. Please try reloading the page.
              </EmptyDescription>
            </EmptyHeader>

            {this.state.error && (
              <div className="w-full max-w-sm space-y-3">
                <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800/50 space-y-2">
                  <p className="text-xs text-zinc-500 font-mono break-all leading-relaxed">
                    {this.state.error.message}
                  </p>
                  <p className="text-[10px] text-zinc-600 font-mono">
                    Browser: {getBrowserName()}
                  </p>
                </div>
                {/* Hint about browser extensions for common DOM errors */}
                {this.state.error.message?.includes('removeChild') && (
                  <p className="text-xs text-zinc-600 text-center">
                    This error is often caused by browser extensions. Try disabling them or using a different browser.
                  </p>
                )}
              </div>
            )}

            <EmptyContent>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={this.handleReset}
                  className="gap-2 border-zinc-700 hover:bg-zinc-800"
                >
                  Try again
                </Button>
                <Button
                  onClick={this.handleReload}
                  className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reload
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Simple error fallback for smaller components.
 */
interface ErrorFallbackProps {
  message?: string
  onRetry?: () => void
}

export function ErrorFallback({ 
  message = 'Failed to load', 
  onRetry 
}: ErrorFallbackProps): JSX.Element {
  return (
    <Empty className="border-0 p-6 min-h-0 flex-none">
      <EmptyHeader className="gap-1.5">
        <EmptyMedia variant="icon" className="bg-red-500/10 text-red-400 size-10 rounded-xl [&_svg]:size-5">
          <AlertTriangle />
        </EmptyMedia>
        <EmptyDescription className="text-zinc-400 text-sm">
          {message}
        </EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            Retry
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}

