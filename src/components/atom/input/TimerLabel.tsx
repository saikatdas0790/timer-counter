import { useEffect, useRef, useState } from "react";

interface Props {
  textToDisplay: string;
  onCommit: (value: string) => void;
}

export default function TimerLabel({ textToDisplay, onCommit }: Props) {
  const [localValue, setLocalValue] = useState(textToDisplay);
  const isFocusedRef = useRef(false);

  // Sync from machine (remote update) only when the field isn't being typed in
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(textToDisplay);
    }
  }, [textToDisplay]);

  return (
    <input
      type="text"
      className="block w-3/4 mx-auto outline-none text-2xl text-purple-300 text-center border-b border-transparent bg-transparent transition-colors duration-300 focus:border-purple-600 focus:ring-0"
      maxLength={20}
      value={localValue}
      onChange={(e) => setLocalValue((e.target as HTMLInputElement).value)}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        onCommit((e.target as HTMLInputElement).value);
      }}
    />
  );
}
