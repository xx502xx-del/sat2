import React, { useState, useEffect, useRef } from 'react';
import { WMSTileLayer } from 'react-leaflet';

export default function DoubleBufferedWMSTileLayer({ 
  url, 
  layers, 
  time, 
  format = "image/jpeg", 
  transparent = false, 
  maxZoom = 15, 
  zIndex = 10, 
  onLoading, 
  onLoad 
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [time0, setTime0] = useState(time);
  const [time1, setTime1] = useState(time);
  
  const isFirstRender = useRef(true);

  // تحديث الطبقة المخفية بالوقت الجديد
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // إشعار بدء التحميل
    if (onLoading) onLoading();

    if (activeIdx === 0) {
      // الطبقة 0 هي الظاهرة حالياً، نقوم بتحديث الطبقة 1 (المخفية)
      setTime1(time);
    } else {
      // الطبقة 1 هي الظاهرة، نقوم بتحديث الطبقة 0
      setTime0(time);
    }
  }, [time, activeIdx, onLoading]);

  // عند اكتمال تحميل المربعات (Tiles) للطبقة 0
  const handleLoad0 = () => {
    if (time0 === time) {
      setActiveIdx(0);
      if (onLoad) onLoad();
    }
  };

  // عند اكتمال تحميل المربعات للطبقة 1
  const handleLoad1 = () => {
    if (time1 === time) {
      setActiveIdx(1);
      if (onLoad) onLoad();
    }
  };

  return (
    <>
      <WMSTileLayer
        key={`layer-0-${layers}`} // تغيير الطبقة يعيد بناء الكومبوننت، لكن تغير الوقت لا يغير الكي
        url={url}
        params={{ layers, format, transparent, time: time0 }}
        opacity={activeIdx === 0 ? 1 : 0}
        zIndex={activeIdx === 0 ? zIndex : zIndex - 1} // الطبقة المخفية نضعها بالأسفل
        maxZoom={maxZoom}
        className="no-fade-layer"
        eventHandlers={{ load: handleLoad0 }}
      />
      <WMSTileLayer
        key={`layer-1-${layers}`}
        url={url}
        params={{ layers, format, transparent, time: time1 }}
        opacity={activeIdx === 1 ? 1 : 0}
        zIndex={activeIdx === 1 ? zIndex : zIndex - 1}
        maxZoom={maxZoom}
        className="no-fade-layer"
        eventHandlers={{ load: handleLoad1 }}
      />
    </>
  );
}
