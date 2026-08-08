'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface MonthFilterProps {
  options: { value: string; label: string }[];
  selectedMonth: string;
}

export default function MonthFilter({ options, selectedMonth }: MonthFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', newMonth);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-xl">
      <select 
        name="month" 
        value={selectedMonth}
        onChange={handleChange}
        className="bg-transparent text-sm font-medium focus:outline-none p-2 rounded-lg cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
