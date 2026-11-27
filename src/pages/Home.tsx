import { useMemo, useState } from "react";
import LeaderSelector from "@/components/LeaderSelector";
import PieChart from "@/components/PieChart";
import { Leader } from "@/lib/leaders";

export default function Home() {
  const [chartData, setChartData] = useState<
    Array<{ leader: Leader; count: number }>
  >([]);
  // Ordem preferida das fatias (ids). Líderes fora da lista vão para o final.
  const [order, setOrder] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orderedData = useMemo(() => {
    const position = (id: string) => {
      const i = order.indexOf(id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    // sort é estável: quem não tem posição mantém a ordem original
    return [...chartData].sort(
      (a, b) => position(a.leader.id) - position(b.leader.id)
    );
  }, [chartData, order]);

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
