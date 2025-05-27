"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Download, Trash2, Eye, Images, Calendar } from "lucide-react"
import { toast } from "@/hooks/use-toast"

export interface GeneratedImage {
  id: string
  url: string
  blob?: Blob
  prompt: string
  timestamp: number
  jobId?: string
}

interface MiniGalleryProps {
  images: GeneratedImage[]
  onDeleteImage: (id: string) => void
  onDownloadImage: (image: GeneratedImage) => void
}

export function MiniGallery({ images, onDeleteImage, onDownloadImage }: MiniGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation()
    onDeleteImage(id)
    if (selectedImage?.id === id) {
      setSelectedImage(null)
    }
    toast({
      title: "Image Deleted",
      description: "The image has been removed from your gallery",
    })
  }

  const handleDownload = (image: GeneratedImage, event: React.MouseEvent) => {
    event.stopPropagation()
    onDownloadImage(image)
  }

  if (images.length === 0) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Images className="w-5 h-5" />
            Gallery
            <Badge variant="secondary">{images.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Images className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No images generated yet</p>
            <p className="text-xs mt-1">Your generated images will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Images className="w-5 h-5" />
          Gallery
          <Badge variant="secondary">{images.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
          {images.map((image) => (
            <Dialog key={image.id}>
              <DialogTrigger asChild>
                <div
                  className="group relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-md"
                  onClick={() => setSelectedImage(image)}
                >
                  <img
                    src={image.url || "/placeholder.svg"}
                    alt={`Generated ${formatDate(image.timestamp)}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => handleDelete(image.id, e)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <div className="text-white text-xs flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(image.timestamp)}
                    </div>
                  </div>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Generated Image
                  </DialogTitle>
                  <DialogDescription>Created on {formatDate(image.timestamp)}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img
                      src={image.url || "/placeholder.svg"}
                      alt="Generated image"
                      className="max-w-full max-h-[60vh] object-contain rounded-lg border"
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground">Prompt</h4>
                      <p className="text-sm bg-muted p-2 rounded">{image.prompt || "No prompt available"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={(e) => handleDownload(image, e)}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={(e) => handleDelete(image.id, e)}
                      className="flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
