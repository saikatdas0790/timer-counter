interface Props {
    textToDisplay: string;
    onInput: (value: string) => void;
}

export default function TimerLabel({ textToDisplay, onInput }: Props) {
    return (
        <input
            type="text"
            className="block w-3/4 mx-auto outline-none text-2xl text-purple-300 text-center border-b border-transparent bg-transparent transition-colors duration-300 focus:border-purple-600 focus:ring-0"
            maxLength={20}
            defaultValue={textToDisplay}
            onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        />
    );
}
