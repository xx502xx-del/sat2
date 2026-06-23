/**
 * NonTiledWMSLayer — طبقة WMS كاملة (non-tiled)
 *
 * إصلاح الجوال — Debouncing:
 *   - على iOS، تُطلَق أحداث moveend/zoomend/resize 3-4 مرات عند التهيئة
 *   - كل حدث يلغي طلب WMS السابق → الصورة لا تُكمل التحميل أبداً
 *   - الحل: debounce 300ms → يُجمّع جميع الأحداث في طلب واحد فقط
 *
 * إصلاح CORS:
 *   - لا crossOrigin='anonymous' → يعمل مع جميع طبقات EUMETSAT
 *
 * إصلاح الإسقاط:
 *   - Spherical Mercator مباشر بدل L.Projection.Mercator
 */
import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** EPSG:3857 Spherical Mercator — المعادلة الدقيقة بالأمتار */
function toSM(latlng) {
  const R = 6378137;
  const x = latlng.lng * Math.PI * R / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (latlng.lat * Math.PI / 180) / 2));
  return { x, y };
}

export default function NonTiledWMSLayer({
  url,
  layers,
  format = 'image/jpeg',
  transparent = false,
  time,
  opacity = 1.0,
  zIndex = 10,
  useMercator = false,
  onLoad,
  onLoading,
}) {
  const map         = useMap();
  const overlayRef  = useRef(null);
  const pendingRef  = useRef(null);
  const mountedRef  = useRef(true);
  const debounceRef = useRef(null);   // ← للـ debouncing

  const buildWmsUrl = useCallback(() => {
    const bounds = map.getBounds();
    const size   = map.getSize();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // حماية من size=0 — قد يحدث على الجوال قبل اكتمال الرسم
    const width  = Math.max(Math.round(size.x), 64);
    const height = Math.max(Math.round(size.y), 64);

    const params = new URLSearchParams({
      SERVICE:     'WMS',
      VERSION:     '1.3.0',
      REQUEST:     'GetMap',
      LAYERS:      layers,
      FORMAT:      format,
      TRANSPARENT: transparent ? 'TRUE' : 'FALSE',
      WIDTH:       width,
      HEIGHT:      height,
      STYLES:      '',
    });

    if (useMercator) {
      // Spherical Mercator (EPSG:3857) — تطابق دقيق مع EUMETSAT وLeaflet tiles
      const swM = toSM(sw);
      const neM = toSM(ne);
      params.set('CRS',  'EPSG:3857');
      params.set('BBOX', `${swM.x},${swM.y},${neM.x},${neM.y}`);
    } else {
      params.set('CRS',  'CRS:84');
      params.set('BBOX', `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`);
    }

    if (time) params.set('TIME', time);
    return `${url}?${params.toString()}`;
  }, [map, url, layers, format, transparent, time, useMercator]);

  const updateOverlay = useCallback(() => {
    if (!mountedRef.current) return;

    const bounds = map.getBounds();
    const wmsUrl = buildWmsUrl();

    if (onLoading) onLoading();

    // إلغاء الطلب السابق
    if (pendingRef.current) {
      pendingRef.current.onload  = null;
      pendingRef.current.onerror = null;
      pendingRef.current = null;
    }

    const newImg = new Image();
    // لا crossOrigin — يُحمّل الصورة كـ img عادي بدون CORS preflight
    pendingRef.current = newImg;

    newImg.onload = () => {
      if (!mountedRef.current || pendingRef.current !== newImg) return;
      if (overlayRef.current) {
        overlayRef.current.setBounds(bounds);
        overlayRef.current.setUrl(newImg.src);
        overlayRef.current.setOpacity(opacity);
      }
      if (onLoad) onLoad();
      pendingRef.current = null;
    };

    newImg.onerror = () => {
      if (!mountedRef.current) return;
      if (onLoad) onLoad();
      pendingRef.current = null;
    };

    newImg.src = wmsUrl;
  }, [map, buildWmsUrl, opacity, onLoad, onLoading]);

  /**
   * scheduleUpdate — نسخة debounced من updateOverlay للأحداث (300ms)
   *
   * السبب: على الجوال (iOS Safari خاصةً) تُطلَق أحداث:
   *   moveend → zoomend → resize → resize (مرة ثانية)
   * كل هذه الأحداث تُطلق في أقل من 100ms من بعضها.
   * بدون debounce: 4 طلبات WMS ← 3 منها ملغاة = الصورة لا تظهر
   * مع  debounce: 1 طلب WMS واحد بعد 300ms من آخر حدث = الصورة تظهر
   */
  const scheduleUpdate = useCallback(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mountedRef.current) updateOverlay();
    }, 300);
  }, [updateOverlay]);

  // تهيئة الـ overlay — الطلب الأول فوري (لا debounce) لأسرع عرض ممكن
  useEffect(() => {
    mountedRef.current = true;
    if (!overlayRef.current) {
      overlayRef.current = L.imageOverlay(TRANSPARENT_PIXEL, map.getBounds(), {
        opacity:     0,
        zIndex,
        interactive: false,
        className:   'non-tiled-wms-overlay',
      }).addTo(map);
    }
    updateOverlay();  // ← فوري لبدء التحميل قبل أي أحداث

    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تحديث عند تغيير الوقت أو الطبقة — فوري (المستخدم اختار طبقة جديدة)
  useEffect(() => {
    if (overlayRef.current) updateOverlay();
  }, [time, layers, updateOverlay]);

  // تحديث عند تحريك/تكبير/resize — مع debounce لمنع التكرار على الجوال
  useMapEvents({
    moveend: scheduleUpdate,
    zoomend: scheduleUpdate,
    resize:  scheduleUpdate,
  });

  // تنظيف عند unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearTimeout(debounceRef.current);
      if (pendingRef.current) {
        pendingRef.current.onload  = null;
        pendingRef.current.onerror = null;
      }
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, []);

  return null;
}
