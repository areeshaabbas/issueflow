import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock3,
  Minus,
  X,
} from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { cx, initials } from '../lib/format';
import type { User } from '../types';
export function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return (
    <span title={user.name} className={cx('avatar', small && 'small')}>
      {initials(user.name)}
    </span>
  );
}

export function StatusIcon({ status }: { status: string }) {
  return status === 'Done' ? (
    <CheckCircle2 size={15} className="green" />
  ) : status === 'In Progress' ? (
    <Clock3 size={15} className="purple" />
  ) : (
    <Circle size={15} className="muted" />
  );
}

export function Priority({ value }: { value: string }) {
  return (
    <span className={'priority ' + value.toLowerCase()}>
      <span className="priority-bars" aria-hidden="true">
        {value === 'Critical' ? (
          <AlertCircle size={13} />
        ) : value === 'High' ? (
          <ArrowUp size={13} />
        ) : value === 'Medium' ? (
          <Minus size={13} />
        ) : (
          <ArrowDown size={13} />
        )}
      </span>
      {value}
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,textarea,button,select')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = bodyOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('modal', wide && 'wide')}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="Close dialog" className="icon-btn" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
