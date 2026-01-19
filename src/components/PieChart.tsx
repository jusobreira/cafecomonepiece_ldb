import { useEffect, useRef, useState } from "react";
import type { MouseEvent, WheelEvent } from "react";
import { Leader } from "@/lib/leaders";

interface PieChartProps {
  data: Array<{ leader: Leader; count: number }>;
}

interface ImageAdjustment {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export default function PieChart({ data }: PieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageAdjustments, setImageAdjustments] = useState<
    Map<string, ImageAdjustment>
  >(new Map());
  const [draggingLeader, setDraggingLeader] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );

  // Initialize adjustments for each leader
  useEffect(() => {
    const newAdjustments = new Map<string, ImageAdjustment>();
    data.forEach((item) => {
      if (!imageAdjustments.has(item.leader.id)) {
        newAdjustments.set(item.leader.id, {
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        });
      }
    });
    if (newAdjustments.size > 0) {
      setImageAdjustments(
        new Map([...imageAdjustments, ...newAdjustments])
      );
    }
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const size = 1000;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 40;

    // Calculate total
    const total = data.reduce((sum, item) => sum + item.count, 0);

    // Preload all images
    const imageMap = new Map<string, HTMLImageElement>();

    const drawChart = () => {
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Draw images in each slice
      let currentAngle = -Math.PI / 2;

      data.forEach((item) => {
        const sliceAngle = (item.count / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;

        ctx.save();

        // Create clipping region for the slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.clip();

        const img = imageMap.get(item.leader.id);
        const adjustment = imageAdjustments.get(item.leader.id) || {
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        };

        if (img && img.complete && img.naturalHeight !== 0) {
          // Calculate image position and size
          const imgAspect = img.width / img.height;
          let drawWidth, drawHeight;

          // Base size that fills the slice
          const baseSize = radius * 2;
          if (imgAspect > 1) {
            drawHeight = baseSize;
            drawWidth = drawHeight * imgAspect;
          } else {
            drawWidth = baseSize;
            drawHeight = drawWidth / imgAspect;
          }

          // Apply user adjustments
          drawWidth *= adjustment.scale;
          drawHeight *= adjustment.scale;

          ctx.drawImage(
            img,
            centerX + adjustment.offsetX - drawWidth / 2,
            centerY + adjustment.offsetY - drawHeight / 2,
            drawWidth,
            drawHeight
          );
        } else {
          // Fallback color if image fails
          ctx.fillStyle = item.leader.color;
          ctx.fill();
        }

        ctx.restore();
        currentAngle = endAngle;
      });

      // Draw borders between slices
      currentAngle = -Math.PI / 2;
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";

      data.forEach((item) => {
        const sliceAngle = (item.count / total) * 2 * Math.PI;
        const endAngle = currentAngle + sliceAngle;

        // Draw line from center to edge
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + Math.cos(currentAngle) * radius,
          centerY + Math.sin(currentAngle) * radius
        );
        ctx.stroke();

        currentAngle = endAngle;
      });

      // Draw outer circle border
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw center circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();

      // Draw a small white dot in the very center
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
    };

    // Load all images
    let imagesLoaded = 0;
    const leadersToLoad = data.filter((item) => item.count > 0);

    if (leadersToLoad.length === 0) return;

    leadersToLoad.forEach((item) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      const onImageLoad = () => {
        imagesLoaded++;
        imageMap.set(item.leader.id, img);
        if (imagesLoaded === leadersToLoad.length) {
          drawChart();
        }
      };

      const onImageError = () => {
        const retryImg = new Image();
        retryImg.onload = () => {
          imagesLoaded++;
          imageMap.set(item.leader.id, retryImg);
          if (imagesLoaded === leadersToLoad.length) {
            drawChart();
          }
        };
        retryImg.onerror = () => {
          imagesLoaded++;
          if (imagesLoaded === leadersToLoad.length) {
            drawChart();
          }
        };
        retryImg.src = item.leader.image;
      };

      img.onload = onImageLoad;
      img.onerror = onImageError;
      img.src = item.leader.image;
    });

    drawChart();
  }, [data, imageAdjustments]);

  const handleCanvasMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale to canvas coordinates
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    const centerX = canvasRef.current.width / 2;
    const centerY = canvasRef.current.height / 2;

    // Find which slice was clicked
    const dx = canvasX - centerX;
    const dy = canvasY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const radius = canvasRef.current.width / 2 - 40;
    if (distance > 30 && distance < radius) {
      const total = data.reduce((sum, item) => sum + item.count, 0);
      let currentAngle = -Math.PI / 2;

      for (const item of data) {
        const sliceAngle = (item.count / total) * 2 * Math.PI;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;

        let normalizedAngle = angle;
        if (normalizedAngle < startAngle) normalizedAngle += 2 * Math.PI;

        if (normalizedAngle >= startAngle && normalizedAngle < endAngle) {
          setDraggingLeader(item.leader.id);
          setDragStart({ x: canvasX, y: canvasY });
          break;
        }

        currentAngle = endAngle;
      }
    }
  };

  const handleCanvasMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!draggingLeader || !dragStart || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;

    const deltaX = canvasX - dragStart.x;
    const deltaY = canvasY - dragStart.y;

    const currentAdjustment = imageAdjustments.get(draggingLeader) || {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    };

    const newAdjustments = new Map(imageAdjustments);
    newAdjustments.set(draggingLeader, {
      ...currentAdjustment,
      offsetX: currentAdjustment.offsetX + deltaX * 0.5,
      offsetY: currentAdjustment.offsetY + deltaY * 0.5,
    });

    setImageAdjustments(newAdjustments);
    setDragStart({ x: canvasX, y: canvasY });
  };

  const handleCanvasMouseUp = () => {
    setDraggingLeader(null);
    setDragStart(null);
  };

  const handleWheel = (e: WheelEvent<HTMLCanvasElement>) => {
    if (!draggingLeader) return;
    e.preventDefault();

    const currentAdjustment = imageAdjustments.get(draggingLeader) || {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    };

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(3, currentAdjustment.scale + delta));

    const newAdjustments = new Map(imageAdjustments);
    newAdjustments.set(draggingLeader, {
      ...currentAdjustment,
      scale: newScale,
    });

    setImageAdjustments(newAdjustments);
  };

  const resetAdjustment = (leaderId: string) => {
    const newAdjustments = new Map(imageAdjustments);
    newAdjustments.set(leaderId, {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
    });
    setImageAdjustments(newAdjustments);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-96">
        <p className="text-lg text-muted-foreground text-center">
          Selecione pelo menos um líder para visualizar o gráfico
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full gap-8">
      <div className="relative w-full max-w-2xl">
        <canvas
          ref={canvasRef}
          className="w-full h-auto border-4 border-gray-300 rounded-lg cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
        />
        <p className="text-xs text-gray-500 text-center mt-2">
          Clique em uma fatia, arraste para mover a imagem, use scroll para zoom
        </p>
      </div>

      {/* Legend */}
      <div className="w-full max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data
            .sort((a, b) => b.count - a.count)
            .map((item) => {
              const adjustment = imageAdjustments.get(item.leader.id);
              const isSelected = draggingLeader === item.leader.id;

              return (
                <div
                  key={item.leader.id}
                  className={`flex items-center gap-3 p-3 rounded border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex-shrink-0 w-10 h-14 rounded border border-gray-300 overflow-hidden">
                    <img
                      src={item.leader.image}
                      alt={item.leader.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {item.leader.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.leader.code}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-baseline gap-2">
                      <p className="text-lg font-bold text-primary">
                        {item.count}
                      </p>
                      <p className="text-xs font-semibold text-gray-600">
                        {((item.count / data.reduce((s, i) => s + i.count, 0)) * 100).toFixed(1)}%
                      </p>
                    </div>
                    {adjustment && (adjustment.offsetX !== 0 || adjustment.offsetY !== 0 || adjustment.scale !== 1) && (
                      <button
                        onClick={() => resetAdjustment(item.leader.id)}
                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
