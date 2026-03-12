import { useState } from "react";
import LeaderSelector from "@/components/LeaderSelector";
import PieChart from "@/components/PieChart";
import { Leader } from "@/lib/leaders";

export default function Home() {
  const [chartData, setChartData] = useState<
    Array<{ leader: Leader; count: number }>
  >([]);

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Sidebar - Leader Selector */}
          <div className="lg:col-span-1">
            <LeaderSelector onDataChange={setChartData} />
          </div>

          {/* Right Content - Pie Chart */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg p-6 shadow-md border border-border">
              <PieChart data={chartData} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
