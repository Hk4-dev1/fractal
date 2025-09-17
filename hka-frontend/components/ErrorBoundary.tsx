import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { RefreshCw, AlertTriangle, Home, Bug } from 'lucide-react';

// Define process for browser environment
declare const process: {
  env: {
    NODE_ENV: string;
  };
};

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });

    // Log to analytics service in production
    if (process.env.NODE_ENV === 'production') {
      // Analytics.logError(error, errorInfo);
    }
  }

  handleRefresh = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
          <Card className="w-full max-w-lg md:max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-3 text-lg md:text-xl">
                <div className="p-2 bg-dex-danger/20 rounded-full">
                  <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-dex-danger" />
                </div>
                Oops! Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
              <Alert className="border-dex-danger bg-red-50 dark:bg-red-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  The HKA-DEX application encountered an unexpected error. Our team has been notified and is working on a fix.
                </AlertDescription>
              </Alert>

              <div className="space-y-3 md:space-y-4">
                <p className="text-muted-foreground text-sm md:text-base text-center">
                  Don&apos;t worry, your funds and trading positions are safe. This is just a display issue.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={this.handleRefresh}
                    className="bg-dex-blue hover:bg-dex-blue/90 w-full sm:w-auto touch-target"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Page
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={this.handleGoHome}
                    className="w-full sm:w-auto touch-target"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Go to Homepage
                  </Button>

                  <Button 
                    variant="outline"
                    onClick={() => window.location.href = 'mailto:support@hka-dex.com'}
                    className="w-full sm:w-auto touch-target"
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    Report Issue
                  </Button>
                </div>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Show Error Details (Development Only)
                  </summary>
                  <div className="mt-3 p-4 bg-muted rounded-lg overflow-auto">
                    <div className="text-sm">
                      <strong>Error:</strong>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-dex-danger">
                        {this.state.error.toString()}
                      </pre>
                      
                      {this.state.errorInfo && (
                        <>
                          <strong className="block mt-4">Component Stack:</strong>
                          <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </>
                      )}
                    </div>
                  </div>
                </details>
              )}

              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Need help? Contact us at{' '}
                  <a 
                    href="mailto:support@hka-dex.com" 
                    className="text-dex-blue hover:underline"
                  >
                    support@hka-dex.com
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping individual components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}