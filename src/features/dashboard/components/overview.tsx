import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { useQuery, getIncomeExpenseSummary } from 'wasp/client/operations'

export function Overview() {
  const { data: monthlySummary, isLoading, error } = useQuery(getIncomeExpenseSummary);

  if (isLoading) return <div>Loading chart data...</div>;
  if (error) return <div>Error loading chart data: {error.message}</div>;
  if (!monthlySummary || monthlySummary.length === 0) return <div>No transaction data available for the chart.</div>;

  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={monthlySummary}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #ccc', borderRadius: '4px' }}
          formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <Bar
          dataKey='income'
          fill='#4ade80'
          radius={[4, 4, 0, 0]}
          name="Income"
        />
        <Bar
          dataKey='expense'
          fill='#f87171'
          radius={[4, 4, 0, 0]}
          name="Expense"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
