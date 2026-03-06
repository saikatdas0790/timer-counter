import type { TimerInterval } from "@/components/molecule/timer/timer-counter/TimerCounter";

interface Props {
    individualInterval: TimerInterval;
    onClick: () => void;
}

export default function Duration({ individualInterval, onClick }: Props) {
    return (
        <button
            onClick={onClick}
            className="text-teal-200 border-2 border-teal-300 rounded-full text-2xl w-20 h-20"
        >
            {individualInterval.label}
        </button>
    );
}
