import TimerSkeleton from "@/components/molecule/timer/TimerSkeleton";

interface Props {
    timerSkeletonCount?: number;
}

export default function TimerSkeletonGrid({ timerSkeletonCount = 9 }: Props) {
    return (
        <div
            className="py-8"
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(24rem, 1fr))",
                gap: "1rem",
                justifyItems: "center",
            }}
        >
            {Array.from({ length: timerSkeletonCount }, (_, i) => (
                <TimerSkeleton key={i} />
            ))}
        </div>
    );
}
