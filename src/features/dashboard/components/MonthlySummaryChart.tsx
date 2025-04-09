import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell, // Import Cell for custom bar colors
} from 'recharts';

// Define the expected data structure
interface SummaryData {
  name: 'Income' | 'Spent' | 'Remaining';
  value: number;
}

interface MonthlySummaryChartProps {
  data: SummaryData[];
}

// Define colors for each category
const COLORS = {
  Income: '#3b82f6', // blue-500
  Spent: '#ef4444', // red-500
  Remaining: '#22c55e', // green-500
};

// Helper to format currency
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

export function MonthlySummaryChart({ data }: MonthlySummaryChartProps) {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No summary data available.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart 
        data={data} 
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        layout="vertical" // Use vertical layout for better label readability
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis 
          type="number" 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <YAxis 
          type="category" 
          dataKey="name" 
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={80} // Give space for labels
        />
        <Tooltip 
          formatter={(value: number) => formatCurrency(value)}
          cursor={{ fill: 'transparent' }}
        />
        <Bar dataKey="value" barSize={40}> 
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
} 