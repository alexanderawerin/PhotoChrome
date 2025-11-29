import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

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
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-white">
                Что-то пошло не так
              </h1>
              <p className="text-sm text-zinc-400">
                Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-zinc-900 rounded-lg p-4 text-left">
                <p className="text-xs text-zinc-500 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={this.handleReset}
                className="gap-2"
              >
                Попробовать снова
              </Button>
              <Button
                onClick={this.handleReload}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Перезагрузить
              </Button>
            </div>
          </div>
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
  message = 'Ошибка загрузки', 
  onRetry 
}: ErrorFallbackProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-4 text-center">
      <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
      <p className="text-sm text-zinc-400">{message}</p>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="mt-2"
        >
          Повторить
        </Button>
      )}
    </div>
  )
}

