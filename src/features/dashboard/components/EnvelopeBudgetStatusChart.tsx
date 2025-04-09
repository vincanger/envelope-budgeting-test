import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Define the expected data structure for each bar/envelope
interface ChartData {
  name: string; // Envelope name
  spent: number; // Amount spent this month
  remaining: number; // Amount remaining this month
  budgeted: number; // Total budgeted amount
}

interface EnvelopeBudgetStatusChartProps {
  data: ChartData[];
}

// Helper to format currency for tooltip/axis
const formatCurrency = (value: number) => {
    // Basic formatting, consider Intl.NumberFormat for more robustness
    return `$${value.toFixed(2)}`; 
};

export function EnvelopeBudgetStatusChart({ data }: EnvelopeBudgetStatusChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No envelope data to display.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={data}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="name" 
          tickLine={false} 
          axisLine={false} 
          fontSize={12}
          // Optional: shorten long names if needed
          // tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 12)}...` : value}
        />
        <YAxis 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          formatter={(value: number, name: string) => [
            formatCurrency(value), 
            name === 'Spent' ? 'Spent' : 'Remaining'
          ]}
          cursor={{ fill: 'transparent' }}
        />
        <Legend 
          iconType="circle"
          formatter={(value) => value === 'Spent' ? 'Spent' : 'Remaining'}
        />
        {/* Stacked Bars: spent first, then remaining on top */}
        <Bar dataKey="spent" stackId="a" fill="#f87171" radius={[0, 0, 4, 4]} name="Spent" /> {/* Red-300 */}
        <Bar dataKey="remaining" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} name="Remaining" /> {/* Green-500 */}
      </BarChart>
    </ResponsiveContainer>
  );
} 