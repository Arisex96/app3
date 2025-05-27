"use client";

import type React from "react";
import { useState, useEffect, useRef, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Trash,
  Edit,
  Check,
  X,
  Eye,
  Images,
  Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface GeneratedImage {
  id: string;
  url: string;
  blob?: Blob;
  // Store the base64 string directly for permanent storage
  base64Data?: string;
  prompt?: string;
  negativePrompt?: string;
  name?: string;
  timestamp: number;
  jobId?: string;
}

interface EnhancedMiniGalleryProps {
  images: GeneratedImage[];
  onDeleteImage: (id: string) => void;
  onDownloadImage: (image: GeneratedImage) => void;
  onRenameImage: (id: string, newName: string) => void;
  onUpdateImage: (id: string, updates: Partial<GeneratedImage>) => void;
}

// Memoized image component to prevent unnecessary re-renders
const GalleryImage = memo(
  ({
    image,
    onDeleteImage,
    onDownloadImage,
    onRenameImage,
    onUpdateImage,
  }: {
    image: GeneratedImage;
    onDeleteImage: (id: string) => void;
    onDownloadImage: (image: GeneratedImage) => void;
    onRenameImage: (id: string, newName: string) => void;
    onUpdateImage: (id: string, updates: Partial<GeneratedImage>) => void;
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(image.name || "");
    const [imageSrc, setImageSrc] = useState<string>(image.url);
    const [isLoading, setIsLoading] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    // Load image from base64 if available (for revisits)
    useEffect(() => {
      if (image.base64Data && (!imageSrc || imageSrc.includes("ngrok"))) {
        setImageSrc(`data:image/png;base64,${image.base64Data}`);
      }
    }, [image.base64Data, imageSrc]);

    const handleDownload = () => {
      onDownloadImage(image);
    };

    const handleDelete = () => {
      onDeleteImage(image.id);
    };

    const startEditing = () => {
      setIsEditing(true);
    };

    const saveEdit = () => {
      onRenameImage(image.id, newName);
      setIsEditing(false);
    };

    const cancelEdit = () => {
      setNewName(image.name || "");
      setIsEditing(false);
    };

    const handleImageError = () => {
      // If image fails to load from URL, try using base64 if available
      if (image.base64Data) {
        setImageSrc(`data:image/png;base64,${image.base64Data}`);
      }
    };

    return (
      <div className="gallery-item">
        <div className="relative aspect-square overflow-hidden rounded-lg border">
          <img
            ref={imageRef}
            src={imageSrc}
            alt={image.name || "Generated image"}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-2 flex justify-between items-center">
            {isEditing ? (
              <div className="flex gap-1 w-full">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-7 text-xs"
                  placeholder="Image name"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={saveEdit}
                  className="h-7 w-7"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={cancelEdit}
                  className="h-7 w-7"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <div
                  className="text-xs font-medium truncate max-w-[100px]"
                  onClick={startEditing}
                >
                  {image.name ||
                    new Date(image.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleDownload}
                    className="h-6 w-6"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleDelete}
                    className="h-6 w-6"
                  >
                    <Trash className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={startEditing}
                    className="h-6 w-6"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);

GalleryImage.displayName = "GalleryImage";

export function EnhancedMiniGallery({
  images,
  onDeleteImage,
  onDownloadImage,
  onRenameImage,
  onUpdateImage,
}: EnhancedMiniGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onDeleteImage(id);
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
    toast({
      title: "Image Deleted",
      description: "The image has been removed from your gallery",
    });
  };

  const handleDownload = (image: GeneratedImage, event: React.MouseEvent) => {
    event.stopPropagation();
    onDownloadImage(image);
    toast({
      title: "Download Started",
      description: "Your image is being downloaded",
    });
  };

  const ImageWithNgrokHeaders = ({
    url,
    alt,
  }: {
    url: string;
    alt: string;
  }) => {
    const [imageSrc, setImageSrc] = useState<string>("");
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
      // Check if the URL contains "ngrok"
      if (url && url.includes("ngrok")) {
        // Fetch the image with the required headers
        fetch(url, {
          headers: {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
        })
          .then((response) => response.blob())
          .then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            setImageSrc(objectUrl);
          })
          .catch((error) => {
            console.error("Failed to load image:", error);
            // Fallback to direct URL
            setImageSrc(url);
          });
      } else {
        // For non-ngrok URLs, use the URL directly
        setImageSrc(url);
      }
    }, [url]);

    return (
      <img
        ref={imgRef}
        src={imageSrc || "/placeholder.svg"}
        alt={alt}
        className="w-full h-full object-cover"
      />
    );
  };

  if (images.length === 0) {
    return (
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Images className="w-5 h-5" />
            Gallery
            <Badge variant="secondary">0</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Images className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">
              No images generated yet
            </h3>
            <p className="text-sm">Your generated images will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
          {images.map((image) => (
            <div
              key={image.id}
              className="group relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-md"
            >
              <ImageWithNgrokHeaders
                url={image.url}
                alt={image.name || "Generated image"}
              />

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

              {/* Action buttons - show on hover */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSelectedImage(image)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleDownload(image, e)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleDelete(image.id, e)}
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>

              {/* Date overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="text-white text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(image.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Simple Image Preview Modal */}
        {selectedImage && (
          <Dialog
            open={!!selectedImage}
            onOpenChange={() => setSelectedImage(null)}
          >
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Generated Image
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Image */}
                <div className="flex justify-center">
                  <img
                    src={selectedImage.url || "/placeholder.svg"}
                    alt="Generated image"
                    className="max-w-full max-h-[60vh] object-contain rounded-lg border"
                  />
                </div>

                {/* Image Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Prompt
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {selectedImage.prompt || "No prompt available"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">
                      Created
                    </h4>
                    <p className="text-sm bg-muted p-3 rounded-lg">
                      {new Date(selectedImage.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={(e) => handleDownload(selectedImage, e)}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={(e) => handleDelete(selectedImage.id, e)}
                    className="flex items-center gap-2"
                  >
                    <Trash className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

EnhancedMiniGallery.displayName = "EnhancedMiniGallery";
