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
    <textarea
      className="block w-11/12 mx-auto outline-none leading-relaxed text-purple-300 border border-purple-900/40 rounded-lg bg-transparent px-3 py-2 transition-colors duration-300 focus:border-purple-500/70 focus:ring-0 resize-none placeholder:text-purple-800/80 min-h-18 text-xl field-sizing-content"
      placeholder="Add notes…"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(e) => {
        isFocusedRef.current = false;
        onCommit(e.target.value);
      }}
    />
  );
}
