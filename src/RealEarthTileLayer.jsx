import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * RealEarth Tile Layer — يسحب بلاطات الخريطة مباشرة من RealEarth SSEC
 *
 * رابط الـ tile:
 *   https://realearth.ssec.wisc.edu/api/image?products={PRODUCT_ID}&x={x}&y={y}&z={z}&time={TIME}
 *
 * - المنتجات تتحدث كل ساعة (00:00 UTC pattern)
 * - آخر وقت يُجلب تلقائياً من /api/times
 * - يُحدّث كل 5 دقائق
 */

const REALEARTH_BASE = 'https://realearth.ssec.wisc.edu';

/**
 * جلب آخر وقت متاح لمنتج معين من RealEarth API
 */
async function fetchLatestTime(productId) {
  try {
    const resp = await fetch(`${REALEARTH_BASE}/api/times?products=${productId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const times = data[productId];
    if (!times || times.length === 0) return null;
    return times[times.length - 1]; // آخر وقت
  } catch {
    return null;
  }
}

/**
 * جلب جميع الأوقات المتاحة لمنتج معين
 */
async function fetchAllTimes(productId) {
  try {
    const resp = await fetch(`${REALEARTH_BASE}/api/times?products=${productId}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data[productId] || [];
  } catch {
    return [];
  }
}

/**
 * تحويل وقت RealEarth (YYYYMMDD.HHMMSS) إلى وقت ISO
 */
function realEarthTimeToISO(reTime) {
  // "20260429.110000" → "2026-04-29T11:00:00Z"
  const y = reTime.substring(0, 4);
  const m = reTime.substring(4, 6);
  const d = reTime.substring(6, 8);
  const H = reTime.substring(9, 11);
  const M = reTime.substring(11, 13);
  const S = reTime.substring(13, 15);
  return `${y}-${m}-${d}T${H}:${M}:${S}Z`;
}

/**
 * تحويل ISO إلى وقت RealEarth
 */
function isoToRealEarthTime(isoStr) {
  const dt = new Date(isoStr);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const H = String(dt.getUTCHours()).padStart(2, '0');
  const M = String(dt.getUTCMinutes()).padStart(2, '0');
  const S = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}.${H}${M}${S}`;
}

/**
 * العثور على أقرب وقت متاح في قائمة أوقات RealEarth لوقت ISO المحدد
 */
function findClosestTime(targetISO, availableTimes) {
  if (!availableTimes || availableTimes.length === 0) return null;
  
  const targetDate = new Date(targetISO).getTime();
  let closest = availableTimes[0];
  let minDiff = Infinity;
  
  for (const t of availableTimes) {
    const tDate = new Date(realEarthTimeToISO(t)).getTime();
    const diff = Math.abs(tDate - targetDate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = t;
    }
  }
  
  return closest;
}

export default function RealEarthTileLayer({
  productId,
  timestamp,      // ISO string — الوقت المطلوب من timeline
  opacity = 1.0,
  zIndex = 10,
  onLoading,
  onLoad,
}) {
  const map = useMap();
  const layerRef = useRef(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [currentTime, setCurrentTime] = useState(null);
  const pollRef = useRef(null);

  // جلب الأوقات المتاحة عند تغيير المنتج
  useEffect(() => {
    let cancelled = false;

    const loadTimes = async () => {
      const times = await fetchAllTimes(productId);
      if (!cancelled && times.length > 0) {
        setAvailableTimes(times);
      }
    };

    loadTimes();

    // تحديث الأوقات كل 5 دقائق
    pollRef.current = setInterval(loadTimes, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [productId]);

  // تحديث الوقت الحالي بناءً على timestamp المطلوب والأوقات المتاحة
  useEffect(() => {
    if (availableTimes.length === 0) return;

    if (timestamp) {
      // ابحث عن أقرب وقت متاح
      const closest = findClosestTime(timestamp, availableTimes);
      setCurrentTime(closest);
    } else {
      // استخدم آخر وقت متاح
      setCurrentTime(availableTimes[availableTimes.length - 1]);
    }
  }, [timestamp, availableTimes]);

  // إنشاء/تحديث طبقة الـ tiles
  useEffect(() => {
    if (!currentTime) return;

    // إزالة الطبقة القديمة
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    if (onLoading) onLoading();

    const tileUrl = `${REALEARTH_BASE}/api/image?products=${productId}&x={x}&y={y}&z={z}&time=${currentTime}`;

    const layer = L.tileLayer(tileUrl, {
      tileSize: 256,
      opacity,
      zIndex,
      maxZoom: 7,
      attribution: '',
      crossOrigin: true,
      // retry on error
      errorTileUrl: '',
    });

    // تتبع حالة التحميل
    let loadingCount = 0;

    layer.on('tileloadstart', () => {
      loadingCount++;
    });

    layer.on('tileload', () => {
      loadingCount--;
      if (loadingCount <= 0) {
        loadingCount = 0;
        if (onLoad) onLoad();
      }
    });

    layer.on('tileerror', () => {
      loadingCount--;
      if (loadingCount <= 0) {
        loadingCount = 0;
        if (onLoad) onLoad();
      }
    });

    layer.on('load', () => {
      if (onLoad) onLoad();
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, productId, currentTime, opacity, zIndex]);

  return null;
}

// تصدير أدوات مساعدة للاستخدام في App.jsx
export { fetchLatestTime, fetchAllTimes, realEarthTimeToISO, isoToRealEarthTime, findClosestTime };
