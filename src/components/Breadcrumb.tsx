'use client';

import React from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="tht-breadcrumb-container" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="tht-breadcrumb-separator">/</span>}
            {isLast ? (
              <span className="tht-breadcrumb-current">{item.label}</span>
            ) : item.href ? (
              <Link href={item.href} onClick={item.onClick} className="tht-breadcrumb-item">
                {item.label}
              </Link>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="tht-breadcrumb-item bg-transparent border-0 p-0 cursor-pointer text-left"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-slate-600 font-bold">{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
