
import { useState, useRef, useEffect, useMemo } from 'react';

interface Option {
  value: string | number;
  label: string;
  code?: string;
}

interface ComboboxProps {
  options: Option[];
  value: string | number;
  onChange: (val: string | number) => void;
  placeholder?: string;
  className?: string;
}

export default function Combobox({ options, value, onChange, placeholder = 'เลือก...', className = '' }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get selected item's label/code for display when closed
  const selectedItem = options.find(o => o.value === value);
  const displayValue = selectedItem ? (selectedItem.code ? `[${selectedItem.code}] ${selectedItem.label}` : selectedItem.label) : '';

  // Filter options
  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const s = search.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(s) || 
      (o.code && o.code.toLowerCase().includes(s))
    );
  }, [options, search]);

  // Reset search when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setHighlightIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIdx, isOpen]);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx(prev => (prev + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx(prev => (prev - 1 + filtered.length) % filtered.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) handleSelect(filtered[highlightIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={`combobox-container ${className}`} ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger / Display */}
      <div 
        className="form-select" 
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ color: selectedItem ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {displayValue || placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', marginTop: '4px', overflow: 'hidden'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              className="form-input"
              placeholder="ค้นหา (ชื่อ หรือ รหัส)..."
              value={search}
              onChange={e => { setSearch(e.target.value); setHighlightIdx(0); }}
              onKeyDown={handleKeyDown}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            />
          </div>
          <ul ref={listRef} style={{ maxHeight: '200px', overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
            {filtered.length > 0 ? (
              filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: '8px 12px', fontSize: '14px', cursor: 'pointer',
                    background: i === highlightIdx ? '#F0F9FF' : 'transparent',
                    color: i === highlightIdx ? 'var(--primary)' : 'inherit',
                  }}
                  onMouseEnter={() => setHighlightIdx(i)}
                >
                  {opt.code && <span style={{ fontWeight: 600, marginRight: '8px', color: 'var(--primary)' }}>[{opt.code}]</span>}
                  {opt.label}
                </li>
              ))
            ) : (
              <li style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>ไม่พบข้อมูล</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
