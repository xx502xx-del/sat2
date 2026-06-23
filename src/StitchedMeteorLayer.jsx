/**
 * StitchedMeteorLayer - نسخة مصلحة
 * يجمع مربعات Meteored في canvas واحد ويعرضها كصورة واحدة
 * الإصلاح: استخدام useRef للـ callbacks لتفادي infinite re-render loop
 */
import { useEffect, useRef, useCallback } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

function tileToLatLng(tileX, tileY, zoom) {
  const n = Math.pow(2, zoom);
  const lng = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

export default function StitchedMeteorLayer({ layerType, timestamp, opacity = 1.0, zIndex = 10, onLoad, onLoading }) {
  const map = useMap();
  const overlayRef = useRef(null);
  const mountedRef = useRef(true);
  const pendingTokenRef = useRef(null);

  // ✅ الإصلاح: استخدام refs للـ callbacks لتجنب إعادة إنشاء updateOverlay عند كل render
  const onLoadRef = useRef(onLoad);
  const onLoadingRef = useRef(onLoading);
  useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);
  useEffect(() => { onLoadingRef.current = onLoading; }, [onLoading]);

  const updateOverlay = useCallback(async () => {
    if (!mountedRef.current) return;

    // إلغاء أي طلب سابق
    if (pendingTokenRef.current) pendingTokenRef.current.cancelled = true;
    const token = { cancelled: false };
    pendingTokenRef.current = token;

    if (onLoadingRef.current) onLoadingRef.current();

    const bounds = map.getBounds();
    const zoom = Math.min(Math.max(Math.round(map.getZoom()), 3), 7);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const tileMin = latLngToTile(ne.lat, sw.lng, zoom);
    const tileMax = latLngToTile(sw.lat, ne.lng, zoom);
    const tilesX = tileMax.x - tileMin.x + 1;
    const tilesY = tileMax.y - tileMin.y + 1;

    const TILE_SIZE = 256;
    const canvas = document.createElement('canvas');
    canvas.width = tilesX * TILE_SIZE;
    canvas.height = tilesY * TILE_SIZE;
    const ctx = canvas.getContext('2d');

    // جلب جميع المربعات بشكل متوازٍ
    const tilePromises = [];
    for (let tx = tileMin.x; tx <= tileMax.x; tx++) {
      for (let ty = tileMin.y; ty <= tileMax.y; ty++) {
        tilePromises.push(new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ img, tx, ty });
          img.onerror = () => resolve(null);
          img.src = `https://services-a.meteored.com/img/tiles/viewer/satellite/${zoom}/${tx}/${ty}/${timestamp}_${layerType}.jpg`;
        }));
      }
    }

    const results = await Promise.all(tilePromises);
    if (token.cancelled || !mountedRef.current) return;

    results.forEach((result) => {
      if (!result) return;
      const { img, tx, ty } = result;
      ctx.drawImage(img, (tx - tileMin.x) * TILE_SIZE, (ty - tileMin.y) * TILE_SIZE);
    });

    // الحدود الجغرافية الدقيقة للصورة (تتوافق مع نظام Mercator الذي تستخدمه Leaflet)
    const nw = tileToLatLng(tileMin.x, tileMin.y, zoom);
    const se = tileToLatLng(tileMax.x + 1, tileMax.y + 1, zoom);
    const imageBounds = L.latLngBounds([se.lat, nw.lng], [nw.lat, se.lng]);

    let dataUrl;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      // CORS issue - silently fail and stop spinner
      if (onLoadRef.current) onLoadRef.current();
      pendingTokenRef.current = null;
      return;
    }

    if (overlayRef.current) {
      overlayRef.current.setUrl(dataUrl);
      overlayRef.current.setBounds(imageBounds);
      overlayRef.current.setOpacity(opacity);
    } else {
      overlayRef.current = L.imageOverlay(dataUrl, imageBounds, {
        opacity, zIndex, interactive: false,
        className: 'stitched-meteor-overlay',
      }).addTo(map);
    }

    if (onLoadRef.current) onLoadRef.current();
    pendingTokenRef.current = null;
  // ✅ لا يوجد onLoad/onLoading في deps - نستخدم الـ refs بدلاً منها
  }, [map, layerType, timestamp, opacity, zIndex]);

  useEffect(() => {
    mountedRef.current = true;
    updateOverlay();
    return () => {};
  }, []);

  useEffect(() => {
    updateOverlay();
  }, [layerType, timestamp, updateOverlay]);

  useMapEvents({ moveend: updateOverlay, zoomend: updateOverlay, resize: updateOverlay });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pendingTokenRef.current) pendingTokenRef.current.cancelled = true;
      if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null; }
    };
  }, []);

  return null;
}
