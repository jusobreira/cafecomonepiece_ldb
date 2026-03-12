import { useState, useMemo, useEffect, useRef } from 'react';
import { CHARACTERS, TIER_COLORS, TierKey } from '@/lib/characters';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Download, RotateCcw, Search, Check } from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';

interface TierListItem {
  characterId: string;
  tier: TierKey;
}

interface TierLabel {
  [key: string]: string;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
}

export default function Home() {
  const [tierList, setTierList] = useState<TierListItem[]>([]);
  const [draggedCharacter, setDraggedCharacter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierLabels, setTierLabels] = useState<TierLabel>({
    S: 'S',
    A: 'A',
    B: 'B',
    C: 'C',
    F: 'F'
  });
  const [editingTier, setEditingTier] = useState<TierKey | null>(null);
  const [tierListWidth, setTierListWidth] = useState(65);
  const [isResizing, setIsResizing] = useState(false);
  const [unrankedWidth, setUnrankedWidth] = useState(35);
  const [tierColumnsCount, setTierColumnsCount] = useState(2);
  const [unrankedColumnsCount, setUnrankedColumnsCount] = useState(2);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const dragStateRef = useRef<DragState>({ isDragging: false, startX: 0, startY: 0 });

  // Calcular número de colunas baseado na largura disponível
  useEffect(() => {
    const calculateColumns = (width: number) => {
      const availableWidth = width - 120;
      const columnWidth = 100;
      const cols = Math.max(2, Math.floor(availableWidth / (columnWidth + 8)));
      return cols;
    };

    const handleResize = () => {
      const tierListElement = document.getElementById('tier-list-container');
      const unrankedElement = document.getElementById('unranked-container');
      
      if (tierListElement) {
        const tierWidth = tierListElement.offsetWidth;
        setTierColumnsCount(calculateColumns(tierWidth));
      }
      
      if (unrankedElement) {
        const unrankedWidth = unrankedElement.offsetWidth;
        setUnrankedColumnsCount(calculateColumns(unrankedWidth));
      }
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    
    const tierListElement = document.getElementById('tier-list-container');
    const unrankedElement = document.getElementById('unranked-container');
    
    if (tierListElement) resizeObserver.observe(tierListElement);
    if (unrankedElement) resizeObserver.observe(unrankedElement);

    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, characterId: string) => {
    dragStateRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY };
    setDraggedCharacter(characterId);
  };

  const handleDragEnd = () => {
    // Usar um pequeno delay para garantir que o drop foi processado
    setTimeout(() => {
      dragStateRef.current = { isDragging: false, startX: 0, startY: 0 };
    }, 100);
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isResizing) return;

    const container = e.currentTarget as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    const newTierListWidth = ((e.clientX - rect.left) / rect.width) * 100;

    if (newTierListWidth > 30 && newTierListWidth < 85) {
      setTierListWidth(newTierListWidth);
      setUnrankedWidth(100 - newTierListWidth);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnTier = (tier: TierKey) => {
    if (!draggedCharacter) return;

    const filtered = tierList.filter(item => item.characterId !== draggedCharacter);
    setTierList([...filtered, { characterId: draggedCharacter, tier }]);
    setDraggedCharacter(null);
    
    // Resetar o estado de drag imediatamente após o drop
    dragStateRef.current = { isDragging: false, startX: 0, startY: 0 };
  };

  const handleRemoveFromTier = (characterId: string) => {
    setTierList(tierList.filter(item => item.characterId !== characterId));
  };

  const handleReset = () => {
    setTierList([]);
  };

  const handleCardClick = (e: React.MouseEvent, characterId: string) => {
    // Evitar abrir modal se estiver arrastando
    if (dragStateRef.current.isDragging) return;
    
    // Abrir modal com um pequeno delay para garantir que não é um drag
    setTimeout(() => {
      if (!dragStateRef.current.isDragging) {
        setSelectedCharacterId(characterId);
      }
    }, 50);
  };

  const handleAddToTierFromModal = (tier: TierKey) => {
    if (!selectedCharacterId) return;
    
    const filtered = tierList.filter(item => item.characterId !== selectedCharacterId);
    setTierList([...filtered, { characterId: selectedCharacterId, tier }]);
    setSelectedCharacterId(null);
  };

  const handleDownloadTierList = async () => {
    const tierListElement = document.getElementById('tier-list-card');
    if (!tierListElement) return;

    try {
      // Usar html2canvas para lidar com imagens cross-origin
      const canvas = await html2canvas(tierListElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1e293b',
        logging: false,
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tier-list-${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      // Fallback simples
      try {
        const dataUrl = await toPng(tierListElement, { cacheBust: true, pixelRatio: 2 });
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `tier-list-${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        alert('Erro ao gerar o download. Por favor, tente novamente.');
      }
    }
  };

  const getCharactersByTier = (tier: TierKey) => {
    return tierList
      .filter(item => item.tier === tier)
      .map(item => CHARACTERS.find(c => c.id === item.characterId))
      .filter(Boolean);
  };

  const unrankedCharacters = useMemo(() => {
    return CHARACTERS.filter(
      char => !tierList.find(item => item.characterId === char.id)
    );
  }, [tierList]);

  const filteredCharacters = useMemo(() => {
    return unrankedCharacters.filter(char => {
      const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           char.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [unrankedCharacters, searchQuery]);

  const selectedCharacter = CHARACTERS.find(c => c.id === selectedCharacterId);

  const tiers: TierKey[] = ['S', 'A', 'B', 'C', 'F'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm px-6 py-6">
        <h1 className="text-4xl font-bold text-white mb-2">
          One Piece Leader Tier List
        </h1>
        <p className="text-slate-400">
          Drag and drop cards to rank your favorite leaders
        </p>
      </div>

      {/* Main Content - Full Width */}
      <div 
        className="flex-1 flex gap-0 relative overflow-hidden" 
        onMouseMove={handleMouseMove} 
        onMouseUp={() => {
          handleMouseUp();
          // Garantir que o estado de drag seja resetado ao soltar o mouse
          dragStateRef.current = { isDragging: false, startX: 0, startY: 0 };
        }} 
        onMouseLeave={() => {
          handleMouseUp();
          dragStateRef.current = { isDragging: false, startX: 0, startY: 0 };
        }}
      >
        {/* Tier List */}
        <div 
          id="tier-list-container"
          style={{ width: `${tierListWidth}%`, transition: isResizing ? 'none' : 'width 0.2s' }}
          className={`flex flex-col overflow-hidden ${isResizing ? 'no-select' : ''}`}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <Card id="tier-list-card" className="p-6 bg-slate-800 border-slate-700 shadow-xl flex flex-col overflow-hidden h-fit max-w-full">
              <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-2xl font-bold text-white">Your Tier List</h2>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownloadTierList}
                    variant="outline"
                    size="sm"
                    className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    <Download size={16} className="mr-2" />
                    PNG
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="text-slate-300 border-slate-600 hover:bg-slate-700"
                  >
                    <RotateCcw size={16} className="mr-2" />
                    Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {tiers.map(tier => (
                  <div key={tier} className="flex gap-4">
                    {/* Tier Label */}
                    <div
                      className="w-20 flex items-center justify-center rounded font-bold text-white text-xl flex-shrink-0 relative group cursor-pointer"
                      style={{ backgroundColor: TIER_COLORS[tier].bg }}
                      onClick={() => setEditingTier(tier)}
                    >
                      {editingTier === tier ? (
                        <input
                          autoFocus
                          type="text"
                          value={tierLabels[tier]}
                          onChange={(e) => setTierLabels({ ...tierLabels, [tier]: e.target.value })}
                          onBlur={() => setEditingTier(null)}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingTier(null)}
                          className="w-full text-center bg-slate-900 text-white border border-slate-500 rounded px-2 py-1"
                          maxLength={10}
                        />
                      ) : (
                        <span>{tierLabels[tier]}</span>
                      )}
                    </div>

                    {/* Tier Drop Zone */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnTier(tier)}
                      className="flex-1 bg-slate-700 rounded-lg border-2 border-dashed border-slate-600 hover:border-slate-500 transition-colors p-3 min-h-[140px] flex flex-wrap gap-2 items-start content-start"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${tierColumnsCount}, minmax(0, 1fr))`,
                        alignContent: 'start'
                      }}
                    >
                      {getCharactersByTier(tier).length === 0 ? (
                        <div className="col-span-full w-full h-full flex items-center justify-center text-slate-500 text-sm">
                          Drop cards here
                        </div>
                      ) : (
                        getCharactersByTier(tier).map(character => (
                          <div
                            key={character!.id}
                            className="relative group flex-shrink-0 w-full cursor-pointer"
                            draggable
                            onDragStart={(e) => handleDragStart(e, character!.id)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handleCardClick(e, character!.id)}
                          >
                            <div className="relative w-full h-[140px] overflow-hidden rounded-md border-2 border-slate-600 hover:border-slate-400 transition-all cursor-grab active:cursor-grabbing shadow-lg hover:shadow-xl hover:scale-105">
                              <img
                                src={character!.image}
                                alt={character!.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140"%3E%3Crect fill="%23374151" width="100" height="140"/%3E%3C/svg%3E';
                                }}
                              />
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromTier(character!.id);
                              }}
                              className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                              <X size={14} />
                            </button>
                            <div className="text-xs text-slate-300 mt-1 text-center truncate leading-tight">
                              {character!.name}
                            </div>
                            <div className="text-xs text-slate-500 text-center leading-tight">
                              {character!.code}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-slate-700 hover:bg-slate-500 cursor-col-resize transition-colors flex-shrink-0"
        />

        {/* Unranked Characters */}
        <div 
          id="unranked-container"
          style={{ width: `${unrankedWidth}%`, transition: isResizing ? 'none' : 'width 0.2s' }}
          className="flex flex-col overflow-hidden"
        >
          <Card className="p-6 bg-slate-800 border-slate-700 shadow-xl m-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-col gap-4 mb-6 flex-shrink-0">
              <h2 className="text-2xl font-bold text-white">Available Leaders</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search leaders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto pr-2 custom-scrollbar"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${unrankedColumnsCount}, minmax(0, 1fr))`,
                gap: '12px',
                alignContent: 'start'
              }}
            >
              {filteredCharacters.map(character => (
                <div
                  key={character.id}
                  className="relative group cursor-pointer"
                  draggable
                  onDragStart={(e) => handleDragStart(e, character.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => handleCardClick(e, character.id)}
                >
                  <div className="relative w-full h-[140px] overflow-hidden rounded-md border-2 border-slate-600 hover:border-slate-400 transition-all cursor-grab active:cursor-grabbing shadow-lg hover:shadow-xl hover:scale-105">
                    <img
                      src={character.image}
                      alt={character.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="140"%3E%3Crect fill="%23374151" width="100" height="140"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-300 mt-1 text-center truncate leading-tight">
                    {character.name}
                  </div>
                  <div className="text-xs text-slate-500 text-center leading-tight">
                    {character.code}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal for tier selection */}
      {selectedCharacter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedCharacterId(null)}>
          <Card className="bg-slate-800 border-slate-700 p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedCharacter.image}
                alt={selectedCharacter.name}
                className="w-24 h-32 object-contain rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="130"%3E%3Crect fill="%23374151" width="100" height="130"/%3E%3C/svg%3E';
                }}
              />
              <div>
                <h3 className="text-xl font-bold text-white">{selectedCharacter.name}</h3>
                <p className="text-slate-400">{selectedCharacter.code}</p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {tiers.map(tier => (
                <Button
                  key={tier}
                  onClick={() => handleAddToTierFromModal(tier)}
                  className="w-full justify-start"
                  style={{
                    backgroundColor: TIER_COLORS[tier].bg,
                    color: 'white'
                  }}
                >
                  {tierLabels[tier]} Tier
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setSelectedCharacterId(null)}
              variant="outline"
              className="w-full text-slate-300 border-slate-600 hover:bg-slate-700"
            >
              Cancel
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
