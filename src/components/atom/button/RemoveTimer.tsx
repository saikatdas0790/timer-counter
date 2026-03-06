import Trash from "@/components/atom/icon/heroicons/outline/Trash";

interface Props {
    onClick: () => void;
}

export default function RemoveTimer({ onClick }: Props) {
    return (
        <button
            className="flex justify-center items-center gap-2 bg-red-700 w-3/4 mx-auto h-16 rounded-xl hover:bg-red-600 active:bg-red-800 transition-colors duration-200"
            onClick={onClick}
        >
            <Trash className="h-8 w-8 text-red-200" />
            <span className="text-2xl text-red-200">Remove Timer</span>
        </button>
    );
}
