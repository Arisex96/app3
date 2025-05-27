"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  EnhancedMiniGallery,
  type GeneratedImage,
} from "@/components/enhanced-mini-gallery";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useImageOptimization } from "@/hooks/use-image-optimization";
import {
  Upload,
  Download,
  Eraser,
  Paintbrush,
  RotateCcw,
  Loader2,
  Undo2,
  ImageIcon,
  Wifi,
  WifiOff,
  Clock,
  Users,
  StopCircle,
  ListOrdered,
  Palette,
  Zap,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface FooocusRequest {
  prompt: string;
  negative_prompt: string;
  style_selections: string[];
  performance_selection: string;
  aspect_ratios_selection: string;
  image_number: number;
  image_seed: number;
  sharpness: number;
  guidance_scale: number;
  base_model_name: string;
  refiner_model_name: string;
  refiner_switch: number;
  loras: Array<{
    enabled: boolean;
    model_name: string;
    weight: number;
  }>;
  advanced_params: {
    inpaint_strength: number;
    inpaint_engine: string;
    [key: string]: any;
  };
  save_meta: boolean;
  meta_scheme: string;
  save_extension: string;
  save_name: string;
  read_wildcards_in_order: boolean;
  require_base64: boolean;
  async_process: boolean;
  webhook_url: string;
  input_image: string;
  input_mask: string;
  inpaint_additional_prompt: string;
  outpaint_selections: string[];
  outpaint_distance_left: number;
  outpaint_distance_right: number;
  outpaint_distance_top: number;
  outpaint_distance_bottom: number;
  image_prompts: any[];
}

interface QueueStatus {
  running_size: number;
  finished_size: number;
  last_job_id: string;
}

interface JobHistory {
  queue: Array<{
    job_id: string;
    is_finished: boolean;
  }>;
  history: Array<{
    job_id: string;
    is_finished: boolean;
  }>;
}

interface JobResult {
  job_id: string;
  job_type: string;
  job_stage: string;
  job_progress: number;
  job_status: string;
  job_step_preview: string | null;
  job_result: Array<{
    base64: string | null;
    url: string;
    seed: number;
    finish_reason: string;
  }> | null;
}

interface SessionState {
  inputImage: string;
  prompt: string;
  negativePrompt: string;
  apiUrl: string;
  maskHistory: string[];
}

export default function FooocusInpaintingApp() {
  // Persistent state
  const [sessionState, setSessionState] = useLocalStorage<SessionState>(
    "fooocus-session",
    {
      inputImage: "",
      prompt: "",
      negativePrompt: "",
      apiUrl: "http://127.0.0.1:8888",
      maskHistory: [],
    }
  );

  const [generatedImages, setGeneratedImages] = useLocalStorage<
    GeneratedImage[]
  >("fooocus-gallery", []);

  // Local state
  const [resultImage, setResultImage] = useState<string>("");
  const [resultImageBlob, setResultImageBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [drawMode, setDrawMode] = useState<"paint" | "erase">("paint");
  const [apiStatus, setApiStatus] = useState<"online" | "offline" | "checking">(
    "offline"
  );
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [jobHistory, setJobHistory] = useState<JobHistory | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string>("");
  const [currentJobResult, setCurrentJobResult] = useState<JobResult | null>(
    null
  );
  const [checkingApi, setCheckingApi] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Form state
  // const [prompt, setPrompt] = useState("")
  // const [negativePrompt, setNegativePrompt] = useState("")
  // const [apiUrl, setApiUrl] = useState("http://127.0.0.1:8888")
  const [inpaintStrength, setInpaintStrength] = useState(1.0);
  const [guidanceScale, setGuidanceScale] = useState(4.0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const brushIndicatorRef = useRef<HTMLDivElement>(null);

  // Image Optimization
  const { optimizeImage, isOptimizing } = useImageOptimization();

  // Update session state helpers
  const updateSessionState = useCallback(
    (updates: Partial<SessionState>) => {
      setSessionState((prev) => ({ ...prev, ...updates }));
    },
    [setSessionState]
  );

  // Calculate queue position and estimated time
  const calculateQueueInfo = () => {
    if (!jobHistory || !currentJobId) return { position: 0, estimatedTime: 0 };

    const queueIndex = jobHistory.queue.findIndex(
      (job) => job.job_id === currentJobId
    );
    const position = queueIndex + 1;
    const estimatedTime = (queueIndex + (queueStatus?.running_size || 0)) * 2;

    return { position, estimatedTime };
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const { dataUrl } = await optimizeImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.9,
        });
        updateSessionState({
          inputImage: dataUrl,
          maskHistory: [],
        });
        setResultImage("");
        setResultImageBlob(null);
      } catch (error) {
        // Fallback to original file
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          updateSessionState({
            inputImage: result,
            maskHistory: [],
          });
          setResultImage("");
          setResultImageBlob(null);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const setupCanvas = () => {
    if (!canvasRef.current || !maskCanvasRef.current || !imageRef.current)
      return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = imageRef.current;

    if (img.naturalWidth === 0 || img.naturalHeight === 0) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;

    const container = img.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const maxWidth = Math.min(600, containerRect.width - 32);
    const maxHeight = 600;

    const scale = Math.min(
      maxWidth / img.naturalWidth,
      maxHeight / img.naturalHeight
    );
    const displayWidth = img.naturalWidth * scale;
    const displayHeight = img.naturalHeight * scale;

    img.style.width = `${displayWidth}px`;
    img.style.height = `${displayHeight}px`;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    maskCanvas.style.width = `${displayWidth}px`;
    maskCanvas.style.height = `${displayHeight}px`;

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    maskCanvas.style.position = "absolute";
    maskCanvas.style.top = "0";
    maskCanvas.style.left = "0";

    const maskCtx = maskCanvas.getContext("2d");
    if (maskCtx) {
      maskCtx.fillStyle = "black";
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      saveMaskState();
    }
  };

  const saveMaskState = () => {
    if (!maskCanvasRef.current) return;
    const maskData = maskCanvasRef.current.toDataURL();
    updateSessionState({
      maskHistory: [...sessionState.maskHistory.slice(-9), maskData],
    });
  };

  const undoMask = () => {
    if (sessionState.maskHistory.length <= 1 || !maskCanvasRef.current) return;

    const newHistory = sessionState.maskHistory.slice(0, -1);
    const previousState = newHistory[newHistory.length - 1];

    const img = new Image();
    img.onload = () => {
      const ctx = maskCanvasRef.current?.getContext("2d");
      if (ctx) {
        ctx.clearRect(
          0,
          0,
          maskCanvasRef.current!.width,
          maskCanvasRef.current!.height
        );
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = previousState;
    updateSessionState({ maskHistory: newHistory });
  };

  // Restore mask from session state
  const restoreMask = () => {
    if (sessionState.maskHistory.length > 0 && maskCanvasRef.current) {
      const lastMask =
        sessionState.maskHistory[sessionState.maskHistory.length - 1];
      const img = new Image();
      img.onload = () => {
        const ctx = maskCanvasRef.current?.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            maskCanvasRef.current!.width,
            maskCanvasRef.current!.height
          );
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = lastMask;
    }
  };

  useEffect(() => {
    if (sessionState.inputImage && imageRef.current) {
      const img = imageRef.current;
      img.onload = () => {
        setupCanvas();
        // Restore mask after canvas is set up
        setTimeout(restoreMask, 100);
      };
    }
  }, [sessionState.inputImage]);

  const updateCursorPosition = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !brushIndicatorRef.current) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ("touches" in event) {
      clientX = event.touches[0]?.clientX || 0;
      clientY = event.touches[0]?.clientY || 0;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCursorPosition({ x, y });

    // Update brush indicator position
    const indicator = brushIndicatorRef.current;
    const scale = rect.width / canvas.width;
    const displayBrushSize = brushSize * scale;

    indicator.style.left = `${x - displayBrushSize}px`;
    indicator.style.top = `${y - displayBrushSize}px`;
    indicator.style.width = `${displayBrushSize * 2}px`;
    indicator.style.height = `${displayBrushSize * 2}px`;
    indicator.style.display = "block";
  };

  const hideCursor = () => {
    setCursorPosition(null);
    if (brushIndicatorRef.current) {
      brushIndicatorRef.current.style.display = "none";
    }
  };

  const getCanvasCoordinates = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ("touches" in event) {
      clientX = event.touches[0]?.clientX || 0;
      clientY = event.touches[0]?.clientY || 0;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y)),
    };
  };

  const startDrawing = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    event.preventDefault();
    setIsDrawing(true);
    draw(event);
  };

  const draw = (
    event:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>
  ) => {
    updateCursorPosition(event);

    if (!isDrawing || !maskCanvasRef.current) return;

    const { x, y } = getCanvasCoordinates(event);
    const ctx = maskCanvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = drawMode === "paint" ? "white" : "black";
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, 2 * Math.PI);
    ctx.fill();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveMaskState();
    }
  };

  const clearMask = () => {
    if (!maskCanvasRef.current) return;
    const ctx = maskCanvasRef.current.getContext("2d");
    if (ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "black";
      ctx.fillRect(
        0,
        0,
        maskCanvasRef.current.width,
        maskCanvasRef.current.height
      );
      saveMaskState();
    }
  };

  // API Functions
  const checkApiStatus = async () => {
    setCheckingApi(true);
    setApiStatus("checking");

    try {
      const pingResponse = await fetch(`${sessionState.apiUrl}/ping`, {
        method: "GET",
        headers: {
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "FooocusInpaintingApp/1.0",
        },
      });

      if (pingResponse.ok) {
        setApiStatus("online");
        await fetchQueueStatus();
        await fetchJobHistory();

        toast({
          title: "API Online",
          description: "Fooocus API is running and ready",
        });
      } else {
        setApiStatus("offline");
        toast({
          title: "API Offline",
          description: "Could not connect to Fooocus API",
          variant: "destructive",
        });
      }
    } catch (error) {
      setApiStatus("offline");
      toast({
        title: "API Offline",
        description: "Could not connect to Fooocus API",
        variant: "destructive",
      });
    } finally {
      setCheckingApi(false);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch(
        `${sessionState.apiUrl}/v1/generation/job-queue`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setQueueStatus(data);
      }
    } catch (error) {
      console.log("Queue status unavailable");
    }
  };

  const fetchJobHistory = async () => {
    try {
      const response = await fetch(
        `${sessionState.apiUrl}/v1/generation/job-history`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setJobHistory(data);
      }
    } catch (error) {
      console.log("Job history unavailable");
    }
  };

  // Modify the queryJobStatus function to store base64 data and avoid UI refreshes
  const queryJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(
        `${sessionState.apiUrl}/v1/generation/query-job?job_id=${jobId}&require_step_preview=false`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setCurrentJobResult(data);

        if (data.job_status === "Finished" && data.job_result?.[0]?.url) {
          let imageUrl = data.job_result[0].url;
          imageUrl = imageUrl.replace(
            "http://127.0.0.1:8888",
            sessionState.apiUrl
          );

          try {
            // Fetch the image with proper headers to bypass ngrok warning
            const imageResponse = await fetch(imageUrl, {
              headers: {
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "FooocusInpaintingApp/1.0",
              },
            });
            const blob = await imageResponse.blob();

            // Create a FileReader to get base64 data for permanent storage
            const reader = new FileReader();
            reader.onloadend = () => {
              // Get base64 data by removing the data URL prefix
              const base64Data = (reader.result as string).split(",")[1];

              // Create a unique ID
              const id = `${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`;

              // Create object URL for temporary display
              const objectUrl = URL.createObjectURL(blob);
              setResultImage(objectUrl);
              setResultImageBlob(blob);

              // Create new image with both blob (for immediate use) and base64 (for storage)
              const newImage: GeneratedImage = {
                id,
                url: objectUrl,
                blob,
                base64Data,
                prompt: sessionState.prompt,
                negativePrompt: sessionState.negativePrompt,
                timestamp: Date.now(),
                jobId,
              };

              // Add to gallery only once when finished
              if (data.job_status === "Finished") {
                setGeneratedImages((prev) => {
                  // Check if this image is already in the gallery by ID or very recent timestamp
                  const isDuplicate = prev.some(
                    (img) =>
                      img.jobId === jobId ||
                      (img.prompt === sessionState.prompt &&
                        Math.abs(img.timestamp - newImage.timestamp) < 5000)
                  );

                  return isDuplicate ? prev : [newImage, ...prev];
                });

                setIsLoading(false);
                setCurrentJobId("");
                toast({
                  title: "Success",
                  description: "Image generated successfully!",
                });
              }
            };
            reader.readAsDataURL(blob);
          } catch (error) {
            console.error("Failed to fetch image blob:", error);
            // Fallback to direct URL if blob fetch fails
            setResultImage(imageUrl);
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      console.log("Query job status failed");
    }
  };

  const stopGeneration = async () => {
    try {
      const response = await fetch(
        `${sessionState.apiUrl}/v1/generation/stop`,
        {
          method: "POST",
          headers: {
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
        }
      );
      if (response.ok) {
        setIsLoading(false);
        setCurrentJobId("");
        setCurrentJobResult(null);
        toast({
          title: "Stopped",
          description: "Generation stopped successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to stop generation",
        variant: "destructive",
      });
    }
  };

  // Auto-check API status when URL changes
  useEffect(() => {
    if (sessionState.apiUrl) {
      const timeoutId = setTimeout(() => {
        checkApiStatus();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [sessionState.apiUrl]);

  // Poll job status when generation is running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentJobId && isLoading) {
      interval = setInterval(() => {
        queryJobStatus(currentJobId);
        fetchQueueStatus();
        fetchJobHistory();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [currentJobId, isLoading]);

  const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
    return canvas.toDataURL("image/png").split(",")[1];
  };

  const imageToBase64 = (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png").split(",")[1]);
        }
      };
      img.src = imageUrl;
    });
  };

  const generateImage = async () => {
    if (!sessionState.inputImage || !maskCanvasRef.current) {
      toast({
        title: "Error",
        description: "Please upload an image and create a mask",
        variant: "destructive",
      });
      return;
    }

    if (apiStatus !== "online") {
      toast({
        title: "API Offline",
        description: "Please check your API connection",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const inputImageBase64 = await imageToBase64(sessionState.inputImage);
      const maskBase64 = canvasToBase64(maskCanvasRef.current);

      const requestBody: FooocusRequest = {
        prompt: sessionState.prompt,
        negative_prompt: sessionState.negativePrompt,
        style_selections: ["Fooocus V2", "Fooocus Enhance", "Fooocus Sharp"],
        performance_selection: "Speed",
        aspect_ratios_selection: "1152*896",
        image_number: 1,
        image_seed: -1,
        sharpness: 2,
        guidance_scale: guidanceScale,
        base_model_name: "juggernautXL_v8Rundiffusion.safetensors",
        refiner_model_name: "None",
        refiner_switch: 0.5,
        loras: [
          {
            enabled: true,
            model_name: "sd_xl_offset_example-lora_1.0.safetensors",
            weight: 0.1,
          },
          {
            enabled: true,
            model_name: "None",
            weight: 1,
          },
          {
            enabled: true,
            model_name: "None",
            weight: 1,
          },
          {
            enabled: true,
            model_name: "None",
            weight: 1,
          },
          {
            enabled: true,
            model_name: "None",
            weight: 1,
          },
        ],
        advanced_params: {
          adaptive_cfg: 7,
          adm_scaler_end: 0.3,
          adm_scaler_negative: 0.8,
          adm_scaler_positive: 1.5,
          black_out_nsfw: false,
          canny_high_threshold: 128,
          canny_low_threshold: 64,
          clip_skip: 2,
          controlnet_softness: 0.25,
          debugging_cn_preprocessor: false,
          debugging_dino: false,
          debugging_enhance_masks_checkbox: false,
          debugging_inpaint_preprocessor: false,
          dino_erode_or_dilate: 0,
          disable_intermediate_results: false,
          disable_preview: false,
          disable_seed_increment: false,
          freeu_b1: 1.01,
          freeu_b2: 1.02,
          freeu_enabled: false,
          freeu_s1: 0.99,
          freeu_s2: 0.95,
          inpaint_advanced_masking_checkbox: true,
          inpaint_disable_initial_latent: false,
          inpaint_engine: "v2.6",
          inpaint_erode_or_dilate: 0,
          inpaint_respective_field: 1,
          inpaint_strength: inpaintStrength,
          invert_mask_checkbox: false,
          mixing_image_prompt_and_inpaint: false,
          mixing_image_prompt_and_vary_upscale: false,
          overwrite_height: -1,
          overwrite_step: -1,
          overwrite_switch: -1,
          overwrite_upscale_strength: -1,
          overwrite_vary_strength: -1,
          overwrite_width: -1,
          refiner_swap_method: "joint",
          sampler_name: "dpmpp_2m_sde_gpu",
          scheduler_name: "karras",
          skipping_cn_preprocessor: false,
          vae_name: "Default (model)",
        },
        save_meta: true,
        meta_scheme: "fooocus",
        save_extension: "png",
        save_name: "",
        read_wildcards_in_order: false,
        require_base64: false,
        async_process: true,
        webhook_url: "",
        input_image: inputImageBase64,
        input_mask: maskBase64,
        inpaint_additional_prompt: "",
        outpaint_selections: [],
        outpaint_distance_left: -1,
        outpaint_distance_right: -1,
        outpaint_distance_top: -1,
        outpaint_distance_bottom: -1,
        image_prompts: [],
      };

      const response = await fetch(
        `${sessionState.apiUrl}/v2/generation/image-inpaint-outpaint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
            "User-Agent": "FooocusInpaintingApp/1.0",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.job_id) {
        setCurrentJobId(result.job_id);
        toast({
          title: "Job Started",
          description: `Generation started with job ID: ${result.job_id}`,
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      toast({
        title: "Error",
        description:
          "Failed to start generation. Please check your API connection.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  // Update the downloadImage function to use the stored base64 when available
  const downloadImage = (image: GeneratedImage) => {
    try {
      if (image.blob) {
        // Use blob for download (preferred method for current session)
        const url = URL.createObjectURL(image.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `inpainted_image_${image.name || image.timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (image.base64Data) {
        // Use base64 data if blob is not available (after page refresh)
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${image.base64Data}`;
        link.download = `inpainted_image_${image.name || image.timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (image.url) {
        // Fallback to URL (least reliable)
        const link = document.createElement("a");
        link.href = image.url;
        link.download = `inpainted_image_${image.name || image.timestamp}.png`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: "Download Started",
        description: "Your image is being downloaded",
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description: "Could not download the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteImage = (id: string) => {
    setGeneratedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const downloadResult = () => {
    if (resultImageBlob || resultImage) {
      const currentImage: GeneratedImage = {
        id: `current-${Date.now()}`,
        url: resultImage,
        blob: resultImageBlob || undefined,
        prompt: sessionState.prompt,
        timestamp: Date.now(),
      };
      downloadImage(currentImage);
    } else {
      toast({
        title: "Error",
        description: "No image available for download",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = () => {
    switch (apiStatus) {
      case "online":
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case "offline":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "checking":
        return <Loader2 className="w-4 h-4 animate-spin text-amber-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (apiStatus) {
      case "online":
        return (
          <Badge
            variant="default"
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Online
          </Badge>
        );
      case "offline":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" />
            Offline
          </Badge>
        );
      case "checking":
        return (
          <Badge variant="secondary">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Checking...
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const { position, estimatedTime } = calculateQueueInfo();

  const handleRenameImage = (id: string, newName: string) => {
    setGeneratedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, name: newName } : img))
    );
  };

  const handleUpdateImage = (id: string, updates: Partial<GeneratedImage>) => {
    setGeneratedImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
    );
  };

  // Add this to your cleanup logic or component unmount
  useEffect(() => {
    return () => {
      // Clean up object URLs when component unmounts
      generatedImages.forEach((image) => {
        if (image.url && image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 transition-colors duration-300">
      <div className="container mx-auto max-w-7xl p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent mb-2">
              AI Inpainting Studio
            </h1>
            <p className="text-muted-foreground text-lg">
              Transform your images with AI-powered inpainting
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left Panel - Controls */}
          <div className="xl:col-span-4 space-y-6">
            {/* API Configuration */}
            <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-3">
                  {getStatusIcon()}
                  API Connection
                  {getStatusBadge()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="api-url" className="text-sm font-medium">
                    API URL
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="api-url"
                      value={sessionState.apiUrl}
                      onChange={(e) =>
                        updateSessionState({ apiUrl: e.target.value })
                      }
                      placeholder="http://127.0.0.1:8888"
                      className="flex-1"
                    />
                    <Button
                      onClick={checkApiStatus}
                      disabled={checkingApi}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      {checkingApi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wifi className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Queue Status */}
                {queueStatus && apiStatus === "online" && (
                  <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                      <Users className="w-4 h-4" />
                      Queue Status
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Running: {queueStatus.running_size}
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Finished: {queueStatus.finished_size}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image Upload */}
            <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isOptimizing}
                  variant="outline"
                  className="w-full h-20 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center gap-2">
                    {isOptimizing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="text-sm font-medium">
                      {isOptimizing ? "Optimizing..." : "Choose Image"}
                    </span>
                  </div>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Image Editor and Results */}
          <div className="xl:col-span-8 space-y-6">
            {/* Mask Editor */}
            {sessionState.inputImage && (
              <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Mask Editor</CardTitle>
                  <CardDescription>
                    Draw white areas where you want changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Brush Controls */}
                    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-xl border">
                      <div className="flex gap-2">
                        <Button
                          variant={drawMode === "paint" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDrawMode("paint")}
                          className="flex items-center gap-2"
                        >
                          <Paintbrush className="w-4 h-4" />
                          <span className="hidden sm:inline">Paint</span>
                        </Button>
                        <Button
                          variant={drawMode === "erase" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setDrawMode("erase")}
                          className="flex items-center gap-2"
                        >
                          <Eraser className="w-4 h-4" />
                          <span className="hidden sm:inline">Erase</span>
                        </Button>
                      </div>

                      <div className="flex-1 min-w-40">
                        <Label className="text-sm font-medium">
                          Brush Size: {brushSize}px
                        </Label>
                        <Slider
                          value={[brushSize]}
                          onValueChange={(value) => setBrushSize(value[0])}
                          min={5}
                          max={100}
                          step={5}
                          className="mt-1"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={undoMask}
                          disabled={sessionState.maskHistory.length <= 1}
                          className="flex items-center gap-2"
                        >
                          <Undo2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Undo</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearMask}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">Clear</span>
                        </Button>
                      </div>
                    </div>

                    {/* Canvas Container */}
                    <div className="flex justify-center">
                      <div className="relative border-2 border-border rounded-xl overflow-hidden bg-card shadow-inner inline-block">
                        <div className="relative">
                          <img
                            ref={imageRef}
                            src={sessionState.inputImage || "/placeholder.svg"}
                            alt="Input"
                            className="block object-contain opacity-70"
                            style={{ maxWidth: "100%", maxHeight: "600px" }}
                          />
                          <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 pointer-events-none"
                          />
                          <canvas
                            ref={maskCanvasRef}
                            className="absolute top-0 left-0 touch-none"
                            style={{
                              mixBlendMode: "screen",
                              cursor: "none",
                            }}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={hideCursor}
                            onMouseEnter={updateCursorPosition}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                          />
                          {/* Brush Indicator */}
                          <div
                            ref={brushIndicatorRef}
                            className="absolute pointer-events-none border-2 border-primary rounded-full opacity-60"
                            style={{
                              display: "none",
                              borderStyle:
                                drawMode === "paint" ? "solid" : "dashed",
                              borderColor:
                                drawMode === "paint"
                                  ? "hsl(var(--primary))"
                                  : "hsl(var(--destructive))",
                              backgroundColor:
                                drawMode === "paint"
                                  ? "hsla(var(--primary), 0.1)"
                                  : "hsla(var(--destructive), 0.1)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Prompts */}
            <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Prompts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt" className="text-sm font-medium">
                    What to generate
                  </Label>
                  <Textarea
                    id="prompt"
                    value={sessionState.prompt}
                    onChange={(e) =>
                      updateSessionState({ prompt: e.target.value })
                    }
                    placeholder="Describe what you want to generate in the masked area..."
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="negative-prompt"
                    className="text-sm font-medium"
                  >
                    What to avoid
                  </Label>
                  <Textarea
                    id="negative-prompt"
                    value={sessionState.negativePrompt}
                    onChange={(e) =>
                      updateSessionState({ negativePrompt: e.target.value })
                    }
                    placeholder="Describe what you don't want..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={generateImage}
              disabled={
                !sessionState.inputImage ||
                !sessionState.prompt ||
                isLoading ||
                apiStatus !== "online"
              }
              className="w-full h-14 text-lg bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2" />
                  Generate Inpainted Image
                </>
              )}
            </Button>

            {/* Queue Information */}
            {currentJobId && isLoading && (
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListOrdered className="w-5 h-5" />
                    Generation Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentJobResult && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Progress</span>
                        <span className="text-sm text-muted-foreground">
                          {currentJobResult.job_progress}%
                        </span>
                      </div>
                      <Progress
                        value={currentJobResult.job_progress}
                        className="w-full h-2"
                      />
                      <div className="text-xs text-muted-foreground">
                        Status: {currentJobResult.job_status} • Stage:{" "}
                        {currentJobResult.job_stage}
                      </div>
                    </div>
                  )}

                  {position > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 rounded-lg">
                      <div className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                        Queue Position #{position}
                      </div>
                      {estimatedTime > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-400">
                          Estimated wait: ~{Math.ceil(estimatedTime)} minutes
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={stopGeneration}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <StopCircle className="w-4 h-4 mr-2" />
                    Stop Generation
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {resultImage && (
              <Card className="border-2 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Generated Result
                  </CardTitle>
                  <CardDescription>
                    Your AI-generated inpainted image
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="border-2 border-border rounded-xl overflow-hidden shadow-lg">
                        <img
                          src={resultImage || "/placeholder.svg"}
                          alt="Generated Result"
                          className="max-w-full max-h-96 object-contain"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={downloadResult}
                      variant="outline"
                      className="w-full h-12 hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Result
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Enhanced Mini Gallery - moved to end of workflow */}
            <EnhancedMiniGallery
              images={generatedImages}
              onDeleteImage={deleteImage}
              onDownloadImage={downloadImage}
              onRenameImage={handleRenameImage}
              onUpdateImage={handleUpdateImage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
