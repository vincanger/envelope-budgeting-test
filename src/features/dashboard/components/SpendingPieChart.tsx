import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useQuery, getSpendingByEnvelope } from 'wasp/client/operations';

// Define some colors for the pie chart slices
// (Consider a more sophisticated color generation if you have many envelopes)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919', '#197BFF', '#FDBA19'];

export function SpendingPieChart() {
  const { data: spendingData, isLoading, error } = useQuery(getSpendingByEnvelope);

  if (isLoading) return <div>Loading spending data...</div>;
  if (error) return <div>Error loading spending data: {error.message}</div>;
  if (!spendingData || spendingData.length === 0) {
    return <div>No spending data available for the current month.</div>;
  }

  // Calculate total spending for percentage calculation in tooltip
  const totalSpending = spendingData.reduce((sum, entry) => sum + entry.value, 0);

  const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={spendingData}
          cx="50%"
          cy="50%"
          labelLine={false}
          // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
          outerRadius={100} // Adjust size as needed
          fill="#8884d8"
          dataKey="value" // Key from our SpendingSummary type
          nameKey="name"    // Key from our SpendingSummary type
        >
          {spendingData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value: number, name: string) => {
             const percentage = totalSpending > 0 ? ((value / totalSpending) * 100).toFixed(1) : 0;
             return [`${formatCurrency(value)} (${percentage}%)`, name];
          }}
          contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }}/>
      </PieChart>
    </ResponsiveContainer>
  );
} 