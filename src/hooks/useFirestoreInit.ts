import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

/**
 * เรียก Firestore ping ครั้งเดียวตอน app boot
 * → ใช้เช็คว่าฐานข้อมูลเข้าถึงได้
 * → ไม่ block UI, ไม่แสดง error ถ้าล้มเหลว (silent)
 */
export function useFirestoreInit() {
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    api.ping()
      .then(() => console.log('[Firestore] Connected'))
      .catch((err) => console.warn('[Firestore] Ping failed', err));
  }, []);
}
