"use client"

import { useEffect, useState } from "react"

export function LabBeakerLoader() {
  const [bubbles, setBubbles] = useState<{ id: number; size: number; delay: number }[]>([])

  useEffect(() => {
    // Generate random bubbles
    const initialBubbles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.random() * 8 + 4, // 4-12px
      delay: Math.random() * 2, // 0-2s delay
    }))
    setBubbles(initialBubbles)

    // Add new bubbles periodically
    const interval = setInterval(() => {
      setBubbles(prev => {
        const newBubble = {
          id: Date.now(),
          size: Math.random() * 8 + 4,
          delay: 0,
        }
        // Keep only last 12 bubbles
        return [...prev.slice(-11), newBubble]
      })
    }, 800)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] relative">
      {/* Lab Beaker SVG */}
      <div className="relative">
        <svg
          width="120"
          height="160"
          viewBox="0 0 120 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          {/* Beaker outline */}
          <path
            d="M30 40 L30 120 Q30 140 50 140 L70 140 Q90 140 90 120 L90 40"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-primary"
          />

          {/* Beaker neck */}
          <path
            d="M30 40 L25 30 L95 30 L90 40"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            className="text-primary"
          />

          {/* Measurement lines */}
          <line x1="35" y1="60" x2="45" y2="60" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
          <line x1="35" y1="80" x2="45" y2="80" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
          <line x1="35" y1="100" x2="45" y2="100" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
          <line x1="35" y1="120" x2="45" y2="120" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />

          {/* Liquid with gradient and animation */}
          <defs>
            <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.6">
                <animate
                  attributeName="stop-color"
                  values="rgb(59, 130, 246);rgb(99, 102, 241);rgb(139, 92, 246);rgb(59, 130, 246)"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0.8">
                <animate
                  attributeName="stop-color"
                  values="rgb(99, 102, 241);rgb(139, 92, 246);rgb(59, 130, 246);rgb(99, 102, 241)"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>

            <mask id="liquidMask">
              <rect x="0" y="0" width="120" height="160" fill="white" />
              <path
                d="M33 70 L33 120 Q33 137 50 137 L70 137 Q87 137 87 120 L87 70"
                fill="white"
              />
            </mask>
          </defs>

          {/* Liquid */}
          <g mask="url(#liquidMask)">
            <rect x="33" y="70" width="54" height="70" fill="url(#liquidGradient)">
              {/* Liquid wave animation */}
              <animate
                attributeName="y"
                values="70;75;70"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>

            {/* Surface wave */}
            <ellipse cx="60" cy="70" rx="27" ry="3" fill="url(#liquidGradient)" opacity="0.9">
              <animate
                attributeName="ry"
                values="3;5;3"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="cy"
                values="70;75;70"
                dur="2s"
                repeatCount="indefinite"
              />
            </ellipse>
          </g>
        </svg>

        {/* Animated bubbles */}
        <div className="absolute inset-0 pointer-events-none">
          {bubbles.map(bubble => (
            <div
              key={bubble.id}
              className="absolute rounded-full bg-blue-400/40 animate-bubble"
              style={{
                width: `${bubble.size}px`,
                height: `${bubble.size}px`,
                left: `${45 + Math.random() * 30}px`,
                bottom: '20px',
                animationDelay: `${bubble.delay}s`,
                '--bubble-offset-x': `${(Math.random() - 0.5) * 20}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      {/* Status Text */}
      <div className="mt-8 text-center space-y-2">
        <h3 className="text-lg font-semibold">Initializing Project Environment</h3>
        <p className="text-sm text-muted-foreground">Setting up sandbox and installing dependencies...</p>

        {/* Progress steps */}
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>Creating sandbox environment</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse animation-delay-150" />
            <span>Cloning repository</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse animation-delay-300" />
            <span>Installing dependencies</span>
          </div>
        </div>
      </div>
    </div>
  )
}
