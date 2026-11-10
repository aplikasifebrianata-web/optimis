import React, { useEffect, useState } from 'react';
import { animate } from 'motion/react';
import { formatNumber, formatRupiah, formatRupiahCompact } from '../../utils/formatters';

interface AnimatedCounterProps {
  value: number;
  format?: 'number' | 'rupiah' | 'rupiah-compact' | 'percent';
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  format = 'number',
  duration = 0.85,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
    });
    return () => controls.stop();
  }, [value, duration]);

  const formattedText = (() => {
    if (format === 'rupiah-compact') {
      return formatRupiahCompact(Math.round(displayValue));
    }
    if (format === 'rupiah') {
      return formatRupiah(Math.round(displayValue));
    }
    if (format === 'percent') {
      return `${displayValue.toFixed(1).replace('.', ',')}%`;
    }
    return formatNumber(Math.round(displayValue));
  })();

  return <span className={`tabular-nums ${className}`}>{formattedText}</span>;
};
