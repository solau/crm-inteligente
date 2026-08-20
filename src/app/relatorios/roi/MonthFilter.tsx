'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';

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
    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3 py-1.5 rounded-xl shadow-md">
      <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <select 
        name="month" 
        value={selectedMonth}
        onChange={handleChange}
        className="bg-zinc-900 text-white font-medium text-sm focus:outline-none cursor-pointer border-none py-1 pr-2 appearance-none"
        style={{ colorScheme: 'dark', backgroundColor: '#18181b', color: '#ffffff' }}
      >
        {options.map(opt => (
          <option 
            key={opt.value} 
            value={opt.value}
            style={{ backgroundColor: '#18181b', color: '#ffffff', padding: '8px' }}
          >
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
