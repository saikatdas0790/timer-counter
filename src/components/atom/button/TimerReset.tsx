import Close from "@/components/atom/icon/material-symbols/Close";

interface Props {
    onClick: () => void;
}

export default function TimerReset({ onClick }: Props) {
    return (
        <button
            type="button"
            className="inline-flex items-center justify-center p-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-600"
            onClick={onClick}
        >
            <span className="sr-only">Reset timer</span>
            <Close className="h-20 w-20 text-red-300" />
        </button>
    );
}
