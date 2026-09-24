import React from 'react';
import Link from 'next/link';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'buy' | 'sell' | 'add' | 'default';
  icon?: string;
  children: React.ReactNode;
  href?: string;
}

export function ActionButton({
  variant = 'default',
  icon,
  children,
  className = '',
  href,
  disabled,
  title,
  ...props
}: ActionButtonProps) {
  let bgClass = 'bg-primary-gradient text-white shadow-blue-500/20';
  let defaultIcon = '';

  switch (variant) {
    case 'sell':
      bgClass = 'bg-brand-red hover:bg-brand-red/90 text-white shadow-red-500/20';
      defaultIcon = 'fa-tag';
      break;
    case 'buy':
      bgClass = 'bg-brand-green hover:bg-brand-green/90 text-white shadow-emerald-500/20';
      defaultIcon = 'fa-cart-shopping';
      break;
    case 'add':
      bgClass = 'bg-brand-blue hover:bg-brand-blue/90 text-white shadow-blue-500/20';
      defaultIcon = 'fa-plus';
      break;
    case 'default':
      bgClass = 'bg-brand-blue hover:bg-brand-blue/90 text-white shadow-blue-500/20';
      defaultIcon = '';
      break;
  }

  const finalIcon = icon !== undefined ? icon : defaultIcon;

  // Provide a base size class if className doesn't include py- or px-
  const hasPadding = className.includes('py-') || className.includes('px-') || className.includes('p-');
  const basePadding = hasPadding ? '' : 'w-full py-3 px-4';
  
  // Provide a base text size if className doesn't include text-
  const hasTextSize = className.includes('text-');
  const baseTextSize = hasTextSize ? '' : 'text-[14px]';

  const combinedClassName = `${basePadding} ${baseTextSize} font-extrabold tracking-wide rounded shadow-md flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer transition-all ${bgClass} ${className}`;
  
  const content = (
    <>
      {finalIcon && <i className={`fa-solid ${finalIcon}`}></i>}
      <span>{children}</span>
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={combinedClassName} title={title} {...(props as any)}>
        {content}
      </Link>
    );
  }

  if (href && disabled) {
    return (
      <div title={title} className={`${combinedClassName} cursor-not-allowed opacity-50 active:scale-100`} aria-disabled="true" {...(props as any)}>
         {content}
      </div>
    )
  }

  return (
    <button
      disabled={disabled}
      title={title}
      {...props}
      className={combinedClassName}
    >
      {content}
    </button>
  );
}
