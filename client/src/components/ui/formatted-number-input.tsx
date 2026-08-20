import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface FormattedNumberInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

function formatAsYouType(input: string): string {
  // Remove all non-digit characters except decimal point
  const cleaned = input.replace(/[^\d.]/g, '');
  
  // Handle decimal numbers
  const parts = cleaned.split('.');
  const integerPart = parts[0] || '';
  const decimalPart = parts[1];
  
  // Add commas to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  // Combine with decimal if present
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function FormattedNumberInput({
  value,
  onChange,
  className,
  min,
  max,
  step,
  placeholder,
  "data-testid": dataTestId,
  disabled,
}: FormattedNumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number>(0);

  // Format number with commas (empty string for 0 to allow clearing)
  const formatWithCommas = useCallback((num: number): string => {
    if (num === 0) return "";
    return num.toLocaleString("en-US");
  }, []);

  const [displayValue, setDisplayValue] = useState(formatWithCommas(value));

  // Update display value when external value changes
  useEffect(() => {
    const currentParsed = parseFormattedNumber(displayValue);
    if (currentParsed !== value) {
      setDisplayValue(formatWithCommas(value));
    }
  }, [value, formatWithCommas]);

  // Restore cursor position after formatting
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
    }
  }, [displayValue]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Select all on focus for easy replacement
    setTimeout(() => {
      e.target.select();
    }, 0);
  };

  const handleBlur = () => {
    // Parse the value and update
    const parsed = parseFormattedNumber(displayValue);
    const clamped = clampValue(parsed);
    onChange(clamped);
    setDisplayValue(formatWithCommas(clamped));
  };

  const clampValue = (val: number): number => {
    let result = val;
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const cursorPos = input.selectionStart || 0;
    
    // Format the new value with commas as user types
    const formatted = formatAsYouType(rawValue);
    
    // Calculate new cursor position
    const digitsBeforeCursor = rawValue.slice(0, cursorPos).replace(/[^\d.]/g, '').length;
    let newCursorPos = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== ',') {
        digitCount++;
      }
      if (digitCount === digitsBeforeCursor) {
        newCursorPos = i + 1;
        break;
      }
    }
    if (digitCount < digitsBeforeCursor) {
      newCursorPos = formatted.length;
    }
    
    cursorRef.current = newCursorPos;
    setDisplayValue(formatted);
    
    const parsed = parseFormattedNumber(formatted);
    onChange(parsed);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn("font-mono", className)}
      placeholder={placeholder}
      data-testid={dataTestId}
      disabled={disabled}
    />
  );
}
