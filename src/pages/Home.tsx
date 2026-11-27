import { useMemo, useState } from "react";
import LeaderSelector from "@/components/LeaderSelector";
import PieChart from "@/components/PieChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Leader, LEADERS } from "@/lib/leaders";

const GROUPED_ID = "__grouped_others__";
const OTHERS_TEMPLATE = LEADERS.find((l) => l.id === "others");

export default function Home() {
  const [chartData, setChartData] = useState<
    Array<{ leader: Leader; count: number }>
  >([]);
  // Ordem preferida das fatias (ids). Líderes fora da lista vão para o final.
  const [order, setOrder] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [groupEnabled, setGroupEnabled] = useState(false);
  const [groupThreshold, setGroupThreshold] = useState(10);

  // Junta em uma fatia "Outros" os líderes com menos de `groupThreshold` unidades.
  // Só agrupa quando há pelo menos 2 líderes abaixo do limite.
  const displayData = useMemo(() => {
    if (!groupEnabled) return chartData;
    const small = chartData.filter((item) => item.count < groupThreshold);
    if (small.length < 2) return chartData;

    const grouped = {
      leader: {
        id: GROUPED_ID,
        code: `${small.length} líderes agrupados`,
        name: "Outros",
        image: OTHERS_TEMPLATE?.image ?? "",
        color: OTHERS_TEMPLATE?.color ?? "#888888",
      } as Leader,
      count: small.reduce((sum, item) => sum + item.count, 0),
    };
    return [
      ...chartData.filter((item) => item.count >= groupThreshold),
      grouped,
    ];
  }, [chartData, groupEnabled, groupThreshold]);

  const orderedData = useMemo(() => {
    const position = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    // sort é estável: quem não tem posição mantém a ordem original
    return [...displayData].sort(
      (a, b) => position(a.leader.id) - position(b.leader.id)
    );
  }, [displayData, order]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Leader Selector */}
          <div className="lg:col-span-1">
            <LeaderSelector
              onDataChange={setChartData}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Right Content - Pie Chart */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg p-6 shadow-md border border-border">
              {chartData.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant={groupEnabled ? "default" : "outline"}
                    onClick={() => setGroupEnabled((v) => !v)}
                    className={
                      groupEnabled
                        ? "bg-[#FFC208] text-black hover:bg-[#FFC208]"
                        : ""
                    }
                  >
                    {groupEnabled ? "Desagrupar" : 'Agrupar em "Outros"'}
                  </Button>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    menos de
                    <Input
                      type="number"
                      min={1}
                      value={groupThreshold}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setGroupThreshold(isNaN(value) ? 1 : Math.max(1, value));
                      }}
                      className="!w-20 !flex-none h-9 text-center font-bold p-1"
                    />
                    unidades
                  </label>
                </div>
              )}
              <PieChart
                data={orderedData}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={setOrder}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
