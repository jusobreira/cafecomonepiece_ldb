import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Leader } from "@/lib/leaders";
import cafeComOnePieceBadge from "@/assets/cafecomonepiece.png";

interface PieChartItem {
  leader: Leader;
  count: number;
}

interface PieChartProps {
  /** Dados já na ordem em que as fatias devem aparecer. */
  data: PieChartItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onReorder?: (ids: string[]) => void;
}

interface ImageAdjustment {
  offsetX: number;
  offsetY: number;
  scale: number;
  /** false = enquadramento automático; true = ajustado pelo usuário. */
  manual: boolean;
}

interface Slice {
  item: PieChartItem;
  start: number;
  end: number;
  mid: number;
  angle: number;
}

const SIZE = 1000;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 40;
const HOLE_RADIUS = 30;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
// Em uma carta (retrato), o centro da arte fica um pouco acima do centro da imagem.
const ART_CENTER_OFFSET = 0.08;
const DRAG_THRESHOLD_PX = 5;

const clampScale = (s: number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));

function layoutSlices(data: PieChartItem[]): Slice[] {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let current = -Math.PI / 2;
  return data.map((item) => {
    const angle = total > 0 ? (item.count / total) * 2 * Math.PI : 0;
    const slice = {
      item,
      start: current,
      end: current + angle,
      mid: current + angle / 2,
      angle,
    };
    current += angle;
    return slice;
  });
}

function baseDims(img: HTMLImageElement) {
  const aspect = img.naturalWidth / img.naturalHeight;
  const base = RADIUS * 2;
  return aspect > 1
    ? { w: base * aspect, h: base, aspect }
    : { w: base, h: base / aspect, aspect };
}

/** Enquadramento automático: leva o centro da arte para o centro da fatia. */
function autoAdjustment(
  img: HTMLImageElement | null | undefined,
  slice: Slice
): ImageAdjustment {
  const a = slice.angle;
  const full = a >= 2 * Math.PI - 1e-6;
  const distance = full || a <= 0 ? 0 : (4 * RADIUS * Math.sin(a / 2)) / (3 * a);
  const scale =
    a <= 0
      ? 1
      : Math.min(2.2, Math.max(1, 1 + ((2 * Math.PI) / a - 1) * 0.18));

  let artShift = 0;
  if (img && img.naturalHeight > 0) {
    const dims = baseDims(img);
    if (dims.aspect < 1) artShift = ART_CENTER_OFFSET * dims.h * scale;
  }

  return {
    offsetX: distance * Math.cos(slice.mid),
    offsetY: distance * Math.sin(slice.mid) + artShift,
    scale,
    manual: false,
  };
}

const resolveCanvasImageUrl = (url: string) => {
  if (!import.meta.env.PROD) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith(window.location.origin)) return url;
  const sanitized = url.replace(/^https?:\/\//, "");
  return `https://images.weserv.nl/?url=${encodeURIComponent(sanitized)}`;
};

export default function PieChart({
  data,
  selectedId = null,
  onSelect,
  onReorder,
}: PieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const badgeRef = useRef<HTMLImageElement | null>(null);
  const [imgVersion, setImgVersion] = useState(0);

  const [adjustments, setAdjustments] = useState<Map<string, ImageAdjustment>>(
    new Map()
  );
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragLegendId, setDragLegendId] = useState<string | null>(null);

  const slices = layoutSlices(data);
  const slicesRef = useRef<Slice[]>(slices);
  slicesRef.current = slices;

  const highlightId = hoverId ?? selectedId;

  // Interação com ponteiro (mouse / toque)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{
    id: string | null;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{ id: string; dist: number } | null>(null);

  // Carrega as imagens uma única vez (cache entre renderizações)
  useEffect(() => {
    data.forEach((item) => {
      const id = item.leader.id;
      if (imagesRef.current.has(id)) return;
      imagesRef.current.set(id, null);
      const url = resolveCanvasImageUrl(item.leader.image);

      const load = (retry: boolean) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imagesRef.current.set(id, img);
          setImgVersion((v) => v + 1);
        };
        img.onerror = () => {
          if (retry) load(false);
        };
        img.src = url;
      };
      load(true);
    });
  }, [data]);

  useEffect(() => {
    const badge = new Image();
    badge.onload = () => {
      badgeRef.current = badge;
      setImgVersion((v) => v + 1);
    };
    badge.src = cafeComOnePieceBadge;
  }, []);

  const getAdjustment = (slice: Slice): ImageAdjustment => {
    const stored = adjustments.get(slice.item.leader.id);
    if (stored && stored.manual) return stored;
    return autoAdjustment(imagesRef.current.get(slice.item.leader.id), slice);
  };

  const render = (highlight: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== SIZE * dpr) {
      canvas.width = SIZE * dpr;
      canvas.height = SIZE * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Imagens em cada fatia
    slices.forEach((slice) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.arc(CENTER, CENTER, RADIUS, slice.start, slice.end);
      ctx.closePath();
      ctx.clip();

      // Cor de fundo (aparece se a imagem não cobrir tudo ou falhar)
      ctx.fillStyle = slice.item.leader.color;
      ctx.fill();

      const img = imagesRef.current.get(slice.item.leader.id);
      if (img && img.complete && img.naturalHeight !== 0) {
        const adj = getAdjustment(slice);
        const dims = baseDims(img);
        const drawWidth = dims.w * adj.scale;
        const drawHeight = dims.h * adj.scale;
        ctx.drawImage(
          img,
          CENTER + adj.offsetX - drawWidth / 2,
          CENTER + adj.offsetY - drawHeight / 2,
          drawWidth,
          drawHeight
        );
      }
      ctx.restore();
    });

    // Divisórias entre as fatias
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    slices.forEach((slice) => {
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.lineTo(
        CENTER + Math.cos(slice.start) * RADIUS,
        CENTER + Math.sin(slice.start) * RADIUS
      );
      ctx.stroke();
    });

    // Borda externa
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Destaque da fatia selecionada / sob o mouse (não vai para o download)
    const highlighted = highlight
      ? slices.find((s) => s.item.leader.id === highlight)
      : undefined;
    if (highlighted) {
      ctx.save();
      ctx.strokeStyle = "#FFC208";
      ctx.lineWidth = 12;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(CENTER, CENTER);
      ctx.arc(CENTER, CENTER, RADIUS - 6, highlighted.start, highlighted.end);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Círculo central
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Selo no canto superior direito do anel externo
    const badgeImage = badgeRef.current;
    if (badgeImage && badgeImage.naturalHeight !== 0) {
      const badgeAngle = -Math.PI / 6;
      const badgeRadius = RADIUS - 9;
      const badgeSize = 150;
      const badgeX = CENTER + Math.cos(badgeAngle) * badgeRadius;
      const badgeY = CENTER + Math.sin(badgeAngle) * badgeRadius;

      ctx.save();
      ctx.translate(badgeX, badgeY);
      ctx.rotate(badgeAngle + Math.PI / 2);
      const aspect = badgeImage.width / badgeImage.height || 1;
      let w = badgeSize;
      let h = badgeSize;
      if (aspect > 1) h = badgeSize / aspect;
      else w = badgeSize * aspect;
      ctx.drawImage(badgeImage, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  };

  useEffect(() => {
    render(highlightId);
  }, [data, adjustments, imgVersion, highlightId]);

  // Converte a posição do ponteiro para as coordenadas do gráfico (0..SIZE)
  const toChart = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SIZE,
      y: ((clientY - rect.top) / rect.height) * SIZE,
      rect,
    };
  };

  const hitSlice = (x: number, y: number): Slice | null => {
    const dx = x - CENTER;
    const dy = y - CENTER;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= HOLE_RADIUS || distance >= RADIUS) return null;

    const angle = Math.atan2(dy, dx);
    for (const slice of slicesRef.current) {
      let a = angle;
      while (a < slice.start) a += 2 * Math.PI;
      while (a >= slice.start + 2 * Math.PI) a -= 2 * Math.PI;
      if (a < slice.end) return slice;
    }
    return null;
  };

  const updateAdjustment = (
    id: string,
    fn: (current: ImageAdjustment) => ImageAdjustment
  ) => {
    setAdjustments((prev) => {
      const slice = slicesRef.current.find((s) => s.item.leader.id === id);
      if (!slice) return prev;
      const stored = prev.get(id);
      const current =
        stored && stored.manual
          ? stored
          : autoAdjustment(imagesRef.current.get(id), slice);
      const next = new Map(prev);
      next.set(id, { ...fn(current), manual: true });
      return next;
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      const { x, y } = toChart(e.clientX, e.clientY);
      const slice = hitSlice(x, y);
      dragRef.current = {
        id: slice ? slice.item.leader.id : null,
        lastX: e.clientX,
        lastY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
    } else if (pointersRef.current.size === 2) {
      // Pinça: zoom na fatia em que o primeiro dedo tocou
      const drag = dragRef.current;
      const [p1, p2] = Array.from(pointersRef.current.values());
      if (drag && drag.id) {
        drag.moved = true;
        pinchRef.current = {
          id: drag.id,
          dist: Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1,
        };
      }
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinça
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const ratio = dist / pinchRef.current.dist;
      pinchRef.current.dist = dist;
      updateAdjustment(pinchRef.current.id, (a) => ({
        ...a,
        scale: clampScale(a.scale * ratio),
      }));
      return;
    }

    const drag = dragRef.current;
    if (drag && pointersRef.current.size === 1) {
      if (
        !drag.moved &&
        Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >
          DRAG_THRESHOLD_PX
      ) {
        drag.moved = true;
      }

      if (drag.moved && drag.id) {
        const rect = canvasRef.current.getBoundingClientRect();
        const dx = ((e.clientX - drag.lastX) / rect.width) * SIZE;
        const dy = ((e.clientY - drag.lastY) / rect.height) * SIZE;
        updateAdjustment(drag.id, (a) => ({
          ...a,
          offsetX: a.offsetX + dx,
          offsetY: a.offsetY + dy,
        }));
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      return;
    }

    // Sem arrastar: só destaca a fatia sob o mouse
    if (e.pointerType === "mouse") {
      const { x, y } = toChart(e.clientX, e.clientY);
      const slice = hitSlice(x, y);
      const id = slice ? slice.item.leader.id : null;
      setHoverId((prev) => (prev === id ? prev : id));
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current = null;

    if (pointersRef.current.size > 0) {
      // Sobrou um dedo depois da pinça: não trata como clique
      dragRef.current = null;
      return;
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved && e.type === "pointerup") {
      onSelect?.(drag.id);
    }
  };

  const handlePointerLeave = () => setHoverId(null);

  // Zoom com o scroll sobre a fatia (sem precisar segurar o clique).
  // Listener nativo porque o do React é passivo e não deixa chamar preventDefault.
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    if (!canvasRef.current) return;
    const { x, y } = toChart(e.clientX, e.clientY);
    const slice = hitSlice(x, y);
    if (!slice) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    updateAdjustment(slice.item.leader.id, (a) => ({
      ...a,
      scale: clampScale(a.scale * factor),
    }));
  };

  const hasData = data.length > 0;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const listener = (e: WheelEvent) => wheelRef.current(e);
    canvas.addEventListener("wheel", listener, { passive: false });
    return () => canvas.removeEventListener("wheel", listener);
  }, [hasData]);

  const resetAdjustment = (leaderId: string) => {
    setAdjustments((prev) => {
      const next = new Map(prev);
      next.delete(leaderId);
      return next;
    });
  };

  const resetAllAdjustments = () => setAdjustments(new Map());

  const hasManualAdjustments = data.some(
    (item) => adjustments.get(item.leader.id)?.manual
  );

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Redesenha sem o destaque amarelo para exportar a imagem limpa
    render(null);
    const link = document.createElement("a");
    try {
      link.href = canvas.toDataURL("image/png");
    } catch (error) {
      console.error("Failed to export canvas image", error);
      alert(
        "Não foi possível exportar a imagem. Verifique se as imagens permitem uso com CORS."
      );
      return;
    } finally {
      render(highlightId);
    }
    link.download = "grafico.png";
    link.click();
  };

  // Reordenação das fatias
  const moveItem = (from: number, to: number) => {
    if (!onReorder || from === to || to < 0 || to >= data.length) return;
    const ids = data.map((item) => item.leader.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  };

  const sortByCount = () => {
    onReorder?.(
      [...data].sort((a, b) => b.count - a.count).map((i) => i.leader.id)
    );
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

  const total = data.reduce((s, i) => s + i.count, 0);

  return (
    <div className="flex flex-col items-center justify-center w-full gap-8">
      <div className="relative w-full max-w-2xl">
        <canvas
          ref={canvasRef}
          className="w-full h-auto border-4 border-gray-300 rounded-lg cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={handlePointerLeave}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            Clique numa fatia para selecioná-la · arraste para mover a imagem ·
            scroll (ou pinça) para zoom
          </p>
          <div className="flex gap-2">
            {hasManualAdjustments && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetAllAdjustments}
                className="gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reenquadrar todos
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleDownload}
              className="w-32 bg-[#FFC208] text-black hover:bg-[#FFC208]"
            >
              Baixar
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full max-w-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Arraste pela alça ou use as setas para reordenar as fatias
          </p>
          <Button size="sm" variant="outline" onClick={sortByCount}>
            Ordenar por quantidade
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map((item, index) => {
            const id = item.leader.id;
            const adjustment = adjustments.get(id);
            const isSelected = selectedId === id;
            const isHover = hoverId === id;

            return (
              <div
                key={id}
                draggable={!!onReorder}
                onDragStart={(e) => {
                  setDragLegendId(id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", id);
                }}
                onDragOver={(e) => {
                  if (dragLegendId) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragLegendId) return;
                  const from = data.findIndex(
                    (i) => i.leader.id === dragLegendId
                  );
                  moveItem(from, index);
                  setDragLegendId(null);
                }}
                onDragEnd={() => setDragLegendId(null)}
                onClick={() => onSelect?.(isSelected ? null : id)}
                onMouseEnter={() => setHoverId(id)}
                onMouseLeave={() => setHoverId(null)}
                className={`flex items-center gap-2 p-3 rounded border-2 transition-all cursor-pointer ${
                  isSelected || isHover
                    ? "border-primary bg-primary/10"
                    : "border-gray-200 bg-white"
                } ${dragLegendId === id ? "opacity-50" : ""}`}
              >
                {onReorder && (
                  <GripVertical
                    className="h-4 w-4 flex-shrink-0 text-gray-400 cursor-grab"
                    aria-hidden
                  />
                )}
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
                    <p className="text-lg font-bold text-[#FFC208]">
                      {item.count}
                    </p>
                    <p className="text-xs font-semibold text-gray-600">
                      {((item.count / total) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {adjustment?.manual && (
                      <button
                        onClick={() => resetAdjustment(id)}
                        title="Voltar ao enquadramento automático"
                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
                      >
                        Reenquadrar
                      </button>
                    )}
                    {onReorder && (
                      <>
                        <button
                          onClick={() => moveItem(index, index - 1)}
                          disabled={index === 0}
                          title="Mover fatia para antes"
                          className="p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors disabled:opacity-40"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => moveItem(index, index + 1)}
                          disabled={index === data.length - 1}
                          title="Mover fatia para depois"
                          className="p-1 bg-gray-200 hover:bg-gray-300 rounded transition-colors disabled:opacity-40"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
