interface Props {
    className?: string;
}

export default function Minus({ className = "h-6 w-6" }: Props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
        </svg>
    );
}
