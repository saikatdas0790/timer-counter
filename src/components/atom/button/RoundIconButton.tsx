interface Props {
  className?: string;
  onClick: () => void;
  children: React.ReactNode;
}

export default function RoundIconButton({
  className = "",
  onClick,
  children,
}: Props) {
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
