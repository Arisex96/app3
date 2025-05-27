"use client"

import { useState, useCallback } from "react"

interface ImageOptimizationOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: "webp" | "jpeg" | "png"
}

export function useImageOptimization() {
  const [isOptimizing, setIsOptimizing] = useState(false)

  const optimizeImage = useCallback(
    async (file: File, options: ImageOptimizationOptions = {}): Promise<{ blob: Blob; dataUrl: string }> => {
      setIsOptimizing(true)

      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        const img = new Image()

        img.onload = () => {
          const { maxWidth = 1920, maxHeight = 1080, quality = 0.9, format = "webp" } = options

          // Calculate new dimensions
          let { width, height } = img
          const aspectRatio = width / height

          if (width > maxWidth) {
            width = maxWidth
            height = width / aspectRatio
          }
          if (height > maxHeight) {
            height = maxHeight
            width = height * aspectRatio
          }

          canvas.width = width
          canvas.height = height

          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const dataUrl = canvas.toDataURL(`image/${format}`, quality)
                resolve({ blob, dataUrl })
              } else {
                reject(new Error("Failed to optimize image"))
              }
              setIsOptimizing(false)
            },
            `image/${format}`,
            quality,
          )
        }

        img.onerror = () => {
          setIsOptimizing(false)
          reject(new Error("Failed to load image"))
        }

        img.src = URL.createObjectURL(file)
      })
    },
    [],
  )

  return { optimizeImage, isOptimizing }
}
