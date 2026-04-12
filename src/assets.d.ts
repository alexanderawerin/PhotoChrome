// Type declarations for static asset imports (Vite)

declare module '*.png' {
  const url: string
  export default url
}

declare module '*.jpg' {
  const url: string
  export default url
}

declare module '*.webp' {
  const url: string
  export default url
}
