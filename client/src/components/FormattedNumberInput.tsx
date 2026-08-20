import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface FormattedNumberInputProps {
  value: number | '';
  onChange: (value: number) => void;
  onBlurValue?: (value: number) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  step?: number;
  /** Hard ceiling. A percentage cannot exceed 100, so typing past it is a slip,
   *  not an intent: clamp instead of letting the math run on a nonsense share. */
  max?: number;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

function formatWithCommas(num: number, decimals: number = 0): string {
  if (num === 0) return '';
  if (decimals > 0) {
    // Cap at `decimals`, but don't pad trailing zeros: 3 -> "3", 1.30 -> "1.3".
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }
  return num.toLocaleString('en-US');
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
  onBlurValue,
  onFocus: externalOnFocus,
  onBlur: externalOnBlur,
  step = 1,
  max,
  className = '',
  style,
  placeholder = '',
  disabled,
  'data-testid': testId
}: FormattedNumberInputProps) {
  const decimals = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
  const numValue = value === '' ? 0 : value;
  const [displayValue, setDisplayValue] = useState(() => value === '' || value === 0 ? '' : formatWithCommas(numValue, decimals));
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus in a ref as well as state: state lags a render, and the resync
  // effect below can run before it commits. Defensive; the character-eating
  // bug was the select-on-focus race handled in handleFocus.
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current || isFocused) return;
    const currentParsed = parseFormattedNumber(displayValue);
    if (currentParsed !== numValue) {
      setDisplayValue(value === '' || value === 0 ? '' : formatWithCommas(numValue, decimals));
    }
  }, [value, decimals, numValue, isFocused, displayValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawValue = input.value;
    const cursorPos = input.selectionStart || 0;

    const digitsOnly = rawValue.replace(/[^\d.]/g, '');

    const parts = digitsOnly.split('.');
    const integerPart = parts[0] || '';
    const decimalPart = parts[1];

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = decimalPart !== undefined
      ? `${formattedInteger}.${decimalPart}`
      : formattedInteger;

    const rawDigitsBefore = rawValue.slice(0, cursorPos).replace(/[^\d.]/g, '').length;
    let newCursorPos = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] !== ',') {
        digitCount++;
      }
      if (digitCount === rawDigitsBefore) {
        newCursorPos = i + 1;
        break;
      }
    }
    if (digitCount < rawDigitsBefore) {
      newCursorPos = formatted.length;
    }

    const parsedRaw = parseFormattedNumber(formatted);
    const clamped = max !== undefined && parsedRaw > max;
    setDisplayValue(clamped ? formatWithCommas(max, decimals) : formatted);

    requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });

    onChange(clamped ? max! : parsedRaw);
  }, [onChange, max, decimals]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    setIsFocused(false);
    const raw = parseFormattedNumber(displayValue);
    const parsed = max !== undefined ? Math.min(raw, max) : raw;
    setDisplayValue(parsed === 0 ? '' : formatWithCommas(parsed, decimals));
    if (parsed !== raw) onChange(parsed);
    if (onBlurValue) {
      onBlurValue(parsed);
    }
    if (externalOnBlur) {
      externalOnBlur(e);
    }
  }, [displayValue, decimals, onBlurValue, externalOnBlur, max, onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    setIsFocused(true);
    /**
     * THE FIX. Select-all is deferred a tick so it lands after the browser's
     * own focus handling, which means the user may already have typed by the
     * time it runs. Unguarded, it selected the character they had just typed
     * and the next keystroke replaced it: "42" became "2", "2400" became
     * "400", every numeric field on every screen. Focus never moved, so it
     * looked like nothing was wrong. Only select if the field is untouched.
     */
    const atFocus = e.target.value;
    setTimeout(() => {
      if (inputRef.current && inputRef.current.value === atFocus) inputRef.current.select();
    }, 0);
    if (externalOnFocus) {
      externalOnFocus(e);
    }
  }, [externalOnFocus]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      setDisplayValue(value === '' || value === 0 ? '' : formatWithCommas(numValue, decimals));
      inputRef.current?.blur();
    }
  }, [value, numValue, decimals]);

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      style={style}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={testId}
      autoComplete="off"
    />
  );
}
