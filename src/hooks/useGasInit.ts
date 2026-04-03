import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

/**
 * เรียก GAS ping ครั้งเดียวตอน app boot
 * → GAS จะ ensureSheets_() อัตโนมัติ (สร้าง sheet ถ้ายังไม่มี)
 * → ไม่ block UI, ไม่แสดง error ถ้าล้มเหลว (silent)
 */
export function useGasInit() {
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    api.ping()
      .then(() => console.log('[GAS] Connected & sheets ready'))
      .catch((err) => console.warn('[GAS] Ping failed (offline?)', err));
  }, []);
}
