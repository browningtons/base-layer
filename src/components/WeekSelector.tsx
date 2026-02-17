import { weekInputToWeekKey, weekKeyToInputValue } from '../utils/scoring';

interface WeekSelectorProps {
  weekKey: string;
  onChange: (weekKey: string) => void;
}

export default function WeekSelector({ weekKey, onChange }: WeekSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span>Week:</span>
      <input
        type="week"
        value={weekKeyToInputValue(weekKey)}
        onChange={(e) => {
          const nextWeekKey = weekInputToWeekKey(e.target.value);
          if (nextWeekKey) {
            onChange(nextWeekKey);
          }
        }}
        className="border rounded px-2 py-1 text-sm bg-white"
      />
    </div>
  );
}
