import AddNewTimerCounter from "@/components/molecule/timer/AddNewTimerCounter";

interface Props {
  onNewTimer: () => void;
}

export default function EmptyGrid({ onNewTimer }: Props) {
  return (
    <div className="grid place-items-center min-h-screen">
      <AddNewTimerCounter onNewTimer={onNewTimer} />
    </div>
  );
}
