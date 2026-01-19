import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Minus, RotateCcw, Search } from "lucide-react";
import { Leader, LEADERS, filterLeaders } from "@/lib/leaders";

interface LeaderCount {
  [key: string]: number;
}

interface LeaderSelectorProps {
  onDataChange: (data: Array<{ leader: Leader; count: number }>) => void;
}

export default function LeaderSelector({ onDataChange }: LeaderSelectorProps) {
  const [counts, setCounts] = useState<LeaderCount>(
    LEADERS.reduce((acc, leader) => ({ ...acc, [leader.id]: 0 }), {})
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrar líderes baseado na busca
  const filteredLeaders = useMemo(() => {
    return filterLeaders(searchQuery);
  }, [searchQuery]);

  const handleIncrement = (leaderId: string) => {
    const newCounts = { ...counts, [leaderId]: counts[leaderId] + 1 };
    setCounts(newCounts);
    updateData(newCounts);
  };

  const handleDecrement = (leaderId: string) => {
    const newCounts = {
      ...counts,
      [leaderId]: Math.max(0, counts[leaderId] - 1),
    };
    setCounts(newCounts);
    updateData(newCounts);
  };

  const handleReset = () => {
    const newCounts = LEADERS.reduce(
      (acc, leader) => ({ ...acc, [leader.id]: 0 }),
      {}
    );
    setCounts(newCounts);
    updateData(newCounts);
  };

  const updateData = (newCounts: LeaderCount) => {
    const data = LEADERS.filter((leader) => newCounts[leader.id] > 0).map(
      (leader) => ({
        leader,
        count: newCounts[leader.id],
      })
    );
    onDataChange(data);
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#FFC208]">Seleção de Líderes</h2>
        {totalCount > 0 && (
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por nome ou código..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-2 border-primary/30 focus:border-primary"
        />
      </div>

      {/* Leaders List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {filteredLeaders.length > 0 ? (
          filteredLeaders.map((leader) => (
            <Card
              key={leader.id}
              className={`leader-card p-3 transition-all ${
                counts[leader.id] > 0 ? "selected bg-accent/10" : "bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Leader Image Thumbnail */}
                <div className="flex-shrink-0 w-12 h-16 rounded border-2 border-primary/50 overflow-hidden bg-gray-100">
                  <img
                    src={leader.image}
                    alt={leader.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='64'%3E%3Crect fill='%23ddd' width='48' height='64'/%3E%3C/svg%3E";
                    }}
                  />
                </div>

                {/* Leader Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm leading-tight text-foreground">
                    {leader.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    {leader.code}
                  </p>
                </div>

                {/* Counter Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleDecrement(leader.id)}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={counts[leader.id] === 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-bold text-lg">
                    {counts[leader.id]}
                  </span>
                  <Button
                    onClick={() => handleIncrement(leader.id)}
                    variant="default"
                    size="sm"
                    className="h-8 w-8 p-0 bg-[#FFC208] text-black hover:bg-[#FFC208]"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum líder encontrado para "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Total Count */}
      {totalCount > 0 && (
        <div className="mt-6 p-4 bg-secondary/10 rounded-lg border-2 border-secondary">
          <p className="text-sm text-muted-foreground">Total de Seleções</p>
          <p className="text-3xl font-bold text-secondary">{totalCount}</p>
        </div>
      )}

      {/* Results Info */}
      {searchQuery && (
        <div className="mt-4 text-xs text-muted-foreground text-center">
          {filteredLeaders.length} de {LEADERS.length} líderes encontrados
        </div>
      )}
    </div>
  );
}
