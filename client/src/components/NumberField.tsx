import { useState, useRef, useCallback, useLayoutEffect } from "react";
import {
  sanitizeNumericDraft,
  parseNumericDraft,
  clampNumber,
  displayValue,
  formatGrouped,
  groupDraft,
  caretForDigits,
} from "@/lib/numberFieldLogic";

export interface NumberFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "min" | "max"
  > {
  value: number;
  onValueChange: (value: number) => void;
  /** Lower bound, applied on blur (commit) only. */
  min?: number;
  /** Upper bound, applied on blur (commit) only. */
  max?: number;
  /** Allow a decimal point. Default true. */
  decimal?: boolean;
}

/**
 * A numeric text input you can actually clear, with live thousand separators.
 *
 * Drop-in replacement for the `<input type="number" value={n} onChange={parseFloat||N}>`
 * pattern, which forces a digit back into the box on every keystroke and so can never be
 * emptied to retype. NumberField keeps the typed text as the source of truth while focused,
 * derives the numeric value from it, groups the draft with commas as you type (restoring the
 * caret so it never jumps), and clamps to [min, max] only on blur.
 */
export function NumberField({
  value,
  onValueChange,
  min,
  max,
  decimal = true,
  onFocus,
  onBlur,
  ...rest
}: NumberFieldProps) {
  // While focused, the typed text (grouped for display) is the source of truth so it can be
  // cleared or partial. While unfocused, the box shows the external value with separators.
  const [draft, setDraft] = useState<string>("");
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  // Numeric characters before the caret at the last keystroke, so we can put the caret back
  // in the same spot after commas shift the string.
  const pendingCaretDigits = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!focused || pendingCaretDigits.current === null || !ref.current) return;
    const pos = caretForDigits(draft, pendingCaretDigits.current);
    ref.current.setSelectionRange(pos, pos);
    pendingCaretDigits.current = null;
  }, [draft, focused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value;
      const caret = e.currentTarget.selectionStart ?? raw.length;
      pendingCaretDigits.current = raw.slice(0, caret).replace(/[^0-9.]/g, "").length;
      const sanitized = sanitizeNumericDraft(raw, { decimal });
      setDraft(groupDraft(sanitized));
      onValueChange(parseNumericDraft(sanitized));
    },
    [decimal, onValueChange],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      setDraft(groupDraft(displayValue(value))); // start editing from the grouped digits
      onFocus?.(e);
    },
    [value, onFocus],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      const committed = clampNumber(parseNumericDraft(sanitizeNumericDraft(draft, { decimal })), min, max);
      if (committed !== value) onValueChange(committed);
      onBlur?.(e);
    },
    [draft, decimal, min, max, value, onValueChange, onBlur],
  );

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={focused ? draft : formatGrouped(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      autoComplete="off"
      {...rest}
    />
  );
}
