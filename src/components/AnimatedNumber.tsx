'use client';

import React, { useState, useEffect } from 'react';
import { animate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
}

export default function AnimatedNumber({ value }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Safely cast value to number or default to 0 if not a number
    const targetValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    
    const controls = animate(0, targetValue, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.floor(latest));
      }
    });
    return () => controls.stop();
  }, [value]);

  return <>{new Intl.NumberFormat('vi-VN').format(displayValue)}</>;
}
