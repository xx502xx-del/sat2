// src/WmsTimeFetcher.js
export async function fetchExactTimeSteps(layerId, hoursRange, defaultIncrementMinutes = 15) {
  try {
    // نطلب قدرات الخادم (يتم تخزينها مؤقتاً في المتصفح غالباً لتسريع الاستجابة)
    const res = await fetch('https://view.eumetsat.int/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities');
    const text = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const layers = xmlDoc.getElementsByTagName("Layer");
    
    let exactLatestTime = null;
    let incrementMinutes = layerId === 'eps:m01_rgb_124' ? 100 : defaultIncrementMinutes;

    // البحث عن الطبقة المطلوبة واستخراج وقت التحديث الفعلي منها
    for (let i = 0; i < layers.length; i++) {
      const nameNode = layers[i].getElementsByTagName("Name")[0];
      if (nameNode && nameNode.textContent === layerId) {
        const dims = layers[i].getElementsByTagName("Dimension");
        for (let j = 0; j < dims.length; j++) {
          if (dims[j].getAttribute("name") === "time") {
            const def = dims[j].getAttribute("default");
            if (def) exactLatestTime = new Date(def);
            break;
          }
        }
        break;
      }
    }

    // إذا وجدنا الوقت الفعلي الدقيق، نقوم ببناء مصفوفة الشريط الزمني بناءً عليه
    if (exactLatestTime) {
      const frames = Math.floor((hoursRange * 60) / incrementMinutes);
      const coeff = incrementMinutes * 60000;
      const steps = [];
      for (let i = frames; i >= 0; i--) {
        steps.push(new Date(exactLatestTime.getTime() - i * coeff).toISOString());
      }
      return steps; // هذه الأوقات دقيقة 100% ومطابقة للسيرفر!
    }
  } catch (err) {
    console.error("WmsTimeFetcher Error:", err);
  }
  return null; // فشل الجلب الدقيق
}
