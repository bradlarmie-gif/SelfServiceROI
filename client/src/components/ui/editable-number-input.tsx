import { useState, useEffect, useRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface EditableNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number | string;
  "data-testid"?: string;
  disabled?: boolean;
}

export function EditableNumberInput({
  value,
  onChange,
  className,
  min,
  max,
  step,
  "data-testid": dataTestId,
  disabled,
}: EditableNumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(value === 0 ? "" : String(value));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value === 0 ? "" : String(value));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value === 0 ? "" : String(value));
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(displayValue) || 0;
    let clamped = parsed;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    onChange(clamped);
    setDisplayValue(clamped === 0 ? "" : String(clamped));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^-?\d*\.?\d*$/.test(raw)) {
      setDisplayValue(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(parsed);
      }
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("font-mono", className)}
      data-testid={dataTestId}
      disabled={disabled}
    />
  );
}
