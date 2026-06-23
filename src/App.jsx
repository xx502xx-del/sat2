import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Menu, X, Layers, Calendar } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CITIES } from './CitiesData';
import NonTiledWMSLayer from './NonTiledWMSLayer';
import StitchedMeteorLayer from './StitchedMeteorLayer';
import RealEarthTileLayer from './RealEarthTileLayer';

const SATELLITE_URL = 'https://view.eumetsat.int/geoserver/wms';

// ═══════════════════════════════════════════════════════════════════════
// طبقات EUMETSAT — مختبرة بشكل مباشر على خادم EUMETSAT WMS
//
// اكتشاف مهم: msg_fes:rgb_dust/convection ترسل HTTP 502 مع EPSG:3857
// الحل: استخدام msg_iodc + CRS:84 لهذه الطبقات المحددة
// crs84:true ← يستخدم CRS:84 (lon,lat) مع msg_iodc
// crs84:false ← يستخدم EPSG:3857 مع msg_fes (حدود أدق)
// ═══════════════════════════════════════════════════════════════════════

const RGB_COMPOSITES = [
  // ✅ msg_fes + EPSG:3857 — تعمل 24/7
  { id: 'msg_fes:rgb_airmass',         name: 'كتلة الهواء (Airmass)',         crs84: false },
  { id: 'msg_fes:rgb_ash',             name: 'الرماد البركاني (Ash)',          crs84: false },
  { id: 'msg_fes:rgb_fog',             name: 'الضباب / السحب المنخفضة (Fog)',  crs84: false },
  { id: 'msg_fes:rgb_tropicalairmass', name: 'الكتلة الاستوائية (Tropical)',  crs84: false },
  // ✅ msg_iodc + EPSG:3857 — (Fixed alignment)
  { id: 'msg_iodc:rgb_dust',           name: 'الغبار (Dust) ☀️',              crs84: false },
  { id: 'msg_iodc:rgb_convection',     name: 'الحمل الحراري (Convection) ☀️', crs84: false },
  { id: 'msg_iodc:rgb_eview',          name: 'المرئي عالي الدقة (HRV) ☀️',    crs84: false },
  { id: 'msg_iodc:rgb_microphysics',   name: 'الفيزياء الدقيقة ☀️',           crs84: false },
  { id: 'msg_iodc:rgb_naturalenhncd',  name: 'الألوان الطبيعية ☀️',           crs84: false },
];

const CHANNELS = [
  { id: 'msg_fes:ir039',  name: 'أشعة تحت الحمراء 3.9 μm',  crs84: false },
  { id: 'msg_fes:ir108',  name: 'أشعة تحت الحمراء 10.8 μm', crs84: false },
  { id: 'msg_fes:vis006', name: 'مرئي 0.6 μm ☀️',           crs84: false },
  { id: 'msg_fes:wv062',  name: 'بخار الماء 6.2 μm',         crs84: false },
];


// أقمار Meteored (ألوان طبيعية + أشعة تحت حمراء + مرئي)
const METEORED_LAYERS = [
  { id: 'meteored:rgb', name: 'Natural colour' },
  { id: 'meteored:ir',  name: 'Infrared' },
  { id: 'meteored:vi',  name: 'Visible' },
];

// ═══════════════════════════════════════════════════════════════════════
// أقمار RealEarth SSEC — Meteosat 8 و 11 (تتحدث كل ساعة)
// يتم سحب البلاطات مباشرة من خادم RealEarth
// ═══════════════════════════════════════════════════════════════════════
const REALEARTH_MET11 = [
  { id: 're:Met11-SEVIRI-FD-BAND01',     productId: 'Met11-SEVIRI-FD-BAND01',     name: 'مرئي 0.6μm (VIS)' },
  { id: 're:Met11-SEVIRI-FD-BAND02',     productId: 'Met11-SEVIRI-FD-BAND02',     name: 'مرئي 0.8μm (VIS)' },
  { id: 're:Met11-SEVIRI-FD-BAND03',     productId: 'Met11-SEVIRI-FD-BAND03',     name: 'قريب الأشعة تحت الحمراء 1.6μm' },
  { id: 're:Met11-SEVIRI-FD-BAND04',     productId: 'Met11-SEVIRI-FD-BAND04',     name: 'أشعة تحت حمراء - حرائق 3.9μm' },
  { id: 're:Met11-SEVIRI-FD-BAND05',     productId: 'Met11-SEVIRI-FD-BAND05',     name: 'بخار الماء العالي 6.2μm' },
  { id: 're:Met11-SEVIRI-FD-BAND05-enh', productId: 'Met11-SEVIRI-FD-BAND05-enh', name: 'بخار الماء العالي 6.2μm (محسّن)' },
  { id: 're:Met11-SEVIRI-FD-BAND06',     productId: 'Met11-SEVIRI-FD-BAND06',     name: 'بخار الماء المتوسط 7.3μm' },
  { id: 're:Met11-SEVIRI-FD-BAND07',     productId: 'Met11-SEVIRI-FD-BAND07',     name: 'أشعة تحت حمراء - طور 8.7μm' },
  { id: 're:Met11-SEVIRI-FD-BAND08',     productId: 'Met11-SEVIRI-FD-BAND08',     name: 'أشعة تحت حمراء - أوزون 9.7μm' },
  { id: 're:Met11-SEVIRI-FD-BAND09',     productId: 'Met11-SEVIRI-FD-BAND09',     name: 'أشعة تحت حمراء نظيف 10.8μm' },
  { id: 're:Met11-SEVIRI-FD-BAND09-enh', productId: 'Met11-SEVIRI-FD-BAND09-enh', name: 'أشعة تحت حمراء 10.8μm (محسّن)' },
  { id: 're:Met11-SEVIRI-FD-BAND11',     productId: 'Met11-SEVIRI-FD-BAND11',     name: 'أشعة تحت حمراء - CO2 13.4μm' },
];

const REALEARTH_MET8 = [
  { id: 're:Met8-SEVIRI-FD-BAND01',     productId: 'Met8-SEVIRI-FD-BAND01',     name: 'مرئي 0.6μm (VIS)' },
  { id: 're:Met8-SEVIRI-FD-BAND02',     productId: 'Met8-SEVIRI-FD-BAND02',     name: 'مرئي 0.8μm (VIS)' },
  { id: 're:Met8-SEVIRI-FD-BAND03',     productId: 'Met8-SEVIRI-FD-BAND03',     name: 'قريب الأشعة تحت الحمراء 1.6μm' },
  { id: 're:Met8-SEVIRI-FD-BAND04',     productId: 'Met8-SEVIRI-FD-BAND04',     name: 'أشعة تحت حمراء - حرائق 3.9μm' },
  { id: 're:Met8-SEVIRI-FD-BAND05',     productId: 'Met8-SEVIRI-FD-BAND05',     name: 'بخار الماء العالي 6.2μm' },
  { id: 're:Met8-SEVIRI-FD-BAND05-enh', productId: 'Met8-SEVIRI-FD-BAND05-enh', name: 'بخار الماء العالي 6.2μm (محسّن)' },
  { id: 're:Met8-SEVIRI-FD-BAND06',     productId: 'Met8-SEVIRI-FD-BAND06',     name: 'بخار الماء المتوسط 7.3μm' },
  { id: 're:Met8-SEVIRI-FD-BAND07',     productId: 'Met8-SEVIRI-FD-BAND07',     name: 'أشعة تحت حمراء - طور 8.7μm' },
  { id: 're:Met8-SEVIRI-FD-BAND08',     productId: 'Met8-SEVIRI-FD-BAND08',     name: 'أشعة تحت حمراء - أوزون 9.7μm' },
  { id: 're:Met8-SEVIRI-FD-BAND09',     productId: 'Met8-SEVIRI-FD-BAND09',     name: 'أشعة تحت حمراء نظيف 10.8μm' },
  { id: 're:Met8-SEVIRI-FD-BAND09-enh', productId: 'Met8-SEVIRI-FD-BAND09-enh', name: 'أشعة تحت حمراء 10.8μm (محسّن)' },
  { id: 're:Met8-SEVIRI-FD-BAND10',     productId: 'Met8-SEVIRI-FD-BAND10',     name: 'أشعة تحت حمراء متسخ 12.0μm' },
  { id: 're:Met8-SEVIRI-FD-BAND11',     productId: 'Met8-SEVIRI-FD-BAND11',     name: 'أشعة تحت حمراء - CO2 13.4μm' },
  { id: 're:Met8-SEVIRI-HRV-BAND12',    productId: 'Met8-SEVIRI-HRV-BAND12',    name: 'مرئي عالي الدقة HRV 0.7μm' },
];

/**
 * توليد الإطارات الزمنية
 * التأخير: 7 دقائق مضمون أن EUMETSAT نشر الصورة
 */
function generateTimeSteps(hours = 9, incrementMinutes = 15) {
  const steps = [];
  const now = new Date();
  now.setMinutes(now.getMinutes() - 7);
  const coeff = 1000 * 60 * incrementMinutes;
  const roundedNow = new Date(Math.floor(now.getTime() / coeff) * coeff);
  for (let i = hours * (60 / incrementMinutes); i >= 0; i--) {
    steps.push(new Date(roundedNow.getTime() - i * incrementMinutes * 60000).toISOString());
  }
  return steps;
}

/** إطار واحد فقط (الأحدث) — للتحميل الفوري */
function generateLatestStep(incrementMinutes = 15) {
  const now = new Date();
  now.setMinutes(now.getMinutes() - 7);
  const coeff = 1000 * 60 * incrementMinutes;
  return [new Date(Math.floor(now.getTime() / coeff) * coeff).toISOString()];
}

/** هل الجهاز جوال (لتحسين دقة WMS) */
const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768;

// ═══════════════════════════════════════════════════════════
// عواصم جميع دول العالم الموجودة في نطاق الخريطة
// من موريتانيا غرباً إلى كوريا شرقاً
// ═══════════════════════════════════════════════════════════
const CAPITALS = [
  // ───── أفريقيا الغربية ─────
  { name: 'موريتانيا',     lat: 18.07,  lon: -15.96 }, // نواكشوط
  { name: 'السنغال',       lat: 14.72,  lon: -17.47 }, // داكار
  { name: 'غامبيا',        lat: 13.45,  lon: -16.57 }, // بانجول
  { name: 'غينيا بيساو',   lat: 11.86,  lon: -15.60 }, // بيساو
  { name: 'غينيا',         lat: 9.54,   lon: -13.68 }, // كوناكري
  { name: 'سيراليون',      lat: 8.48,   lon: -13.23 }, // فريتاون
  { name: 'ليبيريا',       lat: 6.30,   lon: -10.80 }, // مونروفيا
  { name: 'كوت ديفوار',    lat: 6.82,   lon: -5.28  }, // ياموسوكرو
  { name: 'غانا',          lat: 5.56,   lon: -0.20  }, // أكرا
  { name: 'توغو',          lat: 6.14,   lon: 1.22   }, // لومي
  { name: 'بنين',          lat: 6.37,   lon: 2.38   }, // بورتو نوفو
  { name: 'بوركينا فاسو',  lat: 12.37,  lon: -1.53  }, // واغادوغو
  { name: 'مالي',          lat: 12.65,  lon: -8.00  }, // باماكو
  { name: 'النيجر',        lat: 13.51,  lon: 2.11   }, // نيامي
  { name: 'نيجيريا',       lat: 9.07,   lon: 7.40   }, // أبوجا
  // ───── أفريقيا الشمالية ─────
  { name: 'المغرب',        lat: 34.02,  lon: -6.85  }, // الرباط
  { name: 'الجزائر',       lat: 36.74,  lon: 3.06   }, // الجزائر
  { name: 'تونس',          lat: 36.82,  lon: 10.17  }, // تونس
  { name: 'ليبيا',         lat: 32.89,  lon: 13.18  }, // طرابلس
  { name: 'مصر',           lat: 30.06,  lon: 31.24  }, // القاهرة
  // ───── أفريقيا الوسطى ─────
  { name: 'تشاد',          lat: 12.11,  lon: 15.04  }, // نجامينا
  { name: 'الكاميرون',     lat: 3.87,   lon: 11.52  }, // ياوندي
  { name: 'غينيا الاستوائية', lat: 3.75, lon: 8.79  }, // مالابو
  { name: 'الغابون',       lat: 0.39,   lon: 9.45   }, // ليبرفيل
  { name: 'الكونغو',       lat: 4.27,   lon: 15.29  }, // برازافيل
  { name: 'الكونغو الد.',  lat: -4.32,  lon: 15.32  }, // كينشاسا
  { name: 'أفريقيا الوسطى', lat: 4.36,  lon: 18.56  }, // بانغي
  { name: 'أنغولا',        lat: -8.84,  lon: 13.23  }, // لواندا
  // ───── أفريقيا الشرقية ─────
  { name: 'السودان',       lat: 15.55,  lon: 32.53  }, // الخرطوم
  { name: 'جنوب السودان',  lat: 4.85,   lon: 31.61  }, // جوبا
  { name: 'إثيوبيا',      lat: 9.02,   lon: 38.74  }, // أديس أبابا
  { name: 'إريتريا',      lat: 15.33,  lon: 38.93  }, // أسمرة
  { name: 'جيبوتي',       lat: 11.59,  lon: 43.15  }, // جيبوتي
  { name: 'الصومال',      lat: 2.05,   lon: 45.34  }, // مقديشو
  { name: 'أوغندا',       lat: 0.34,   lon: 32.58  }, // كمبالا
  { name: 'كينيا',        lat: -1.28,  lon: 36.82  }, // نيروبي
  { name: 'رواندا',       lat: -1.95,  lon: 30.06  }, // كيغالي
  { name: 'بوروندي',      lat: -3.38,  lon: 29.36  }, // بوجومبورا
  { name: 'تنزانيا',      lat: -6.16,  lon: 35.75  }, // دودوما
  { name: 'مالاوي',       lat: -13.97, lon: 33.79  }, // ليلونغوي
  { name: 'زامبيا',       lat: -15.42, lon: 28.29  }, // لوساكا
  // ───── الشرق الأوسط وأوروبا المتوسطية ─────
  { name: 'اليونان',      lat: 37.97,  lon: 23.73  }, // أثينا
  { name: 'قبرص',         lat: 35.17,  lon: 33.37  }, // نيقوسيا
  { name: 'تركيا',        lat: 39.93,  lon: 32.86  }, // أنقرة
  { name: 'جورجيا',       lat: 41.69,  lon: 44.83  }, // تبليسي
  { name: 'أرمينيا',      lat: 40.18,  lon: 44.51  }, // يريفان
  { name: 'أذربيجان',     lat: 40.41,  lon: 49.87  }, // باكو
  { name: 'سوريا',        lat: 33.51,  lon: 36.29  }, // دمشق
  { name: 'لبنان',        lat: 33.89,  lon: 35.50  }, // بيروت
  { name: 'فلسطين',       lat: 31.78,  lon: 35.22  }, // القدس
  { name: 'الأردن',       lat: 31.95,  lon: 35.93  }, // عمان
  { name: 'العراق',       lat: 33.34,  lon: 44.40  }, // بغداد
  { name: 'إيران',        lat: 35.69,  lon: 51.42  }, // طهران
  { name: 'الكويت',       lat: 29.37,  lon: 47.98  }, // الكويت
  { name: 'اليمن',        lat: 15.35,  lon: 44.21  }, // صنعاء
  // ───── آسيا الوسطى ─────
  { name: 'تركمانستان',   lat: 37.95,  lon: 58.38  }, // عشق آباد
  { name: 'أوزبكستان',    lat: 41.30,  lon: 69.27  }, // طشقند
  { name: 'طاجيكستان',    lat: 38.56,  lon: 68.77  }, // دوشنبه
  { name: 'قيرغيزستان',   lat: 42.87,  lon: 74.59  }, // بيشكيك
  { name: 'كازاخستان',    lat: 51.18,  lon: 71.45  }, // نور سلطان
  { name: 'أفغانستان',    lat: 34.52,  lon: 69.18  }, // كابول
  // ───── جنوب آسيا ─────
  { name: 'باكستان',      lat: 33.72,  lon: 73.04  }, // إسلام آباد
  { name: 'الهند',        lat: 28.61,  lon: 77.21  }, // نيودلهي
  { name: 'نيبال',        lat: 27.70,  lon: 85.32  }, // كاتماندو
  { name: 'بوتان',        lat: 27.47,  lon: 89.64  }, // تيمفو
  { name: 'بنغلاديش',     lat: 23.72,  lon: 90.41  }, // دكا
  { name: 'سريلانكا',     lat: 7.87,   lon: 80.77  }, // سري جاياواردينا
  // ───── جنوب شرق آسيا ─────
  { name: 'ميانمار',      lat: 19.76,  lon: 96.08  }, // نيبيداو
  { name: 'لاوس',         lat: 17.97,  lon: 102.63 }, // فيينتيان
  { name: 'تايلاند',      lat: 13.75,  lon: 100.52 }, // بانكوك
  { name: 'كمبوديا',      lat: 11.56,  lon: 104.92 }, // بنوم بنه
  { name: 'فيتنام',       lat: 21.03,  lon: 105.85 }, // هانوي
  { name: 'ماليزيا',      lat: 3.15,   lon: 101.69 }, // كوالالمبور
  { name: 'سنغافورة',     lat: 1.29,   lon: 103.82 }, // سنغافورة
  { name: 'بروناي',       lat: 4.94,   lon: 114.94 }, // بندر سري
  { name: 'إندونيسيا',    lat: -6.21,  lon: 106.85 }, // جاكرتا
  { name: 'الفلبين',      lat: 14.60,  lon: 120.97 }, // مانيلا
  // ───── شرق آسيا ─────
  { name: 'الصين',        lat: 39.92,  lon: 116.39 }, // بكين
  { name: 'منغوليا',      lat: 47.92,  lon: 106.92 }, // أولان باتور
  { name: 'كوريا الشمالية', lat: 39.02, lon: 125.75 }, // بيونغ يانغ
  { name: 'كوريا الجنوبية', lat: 37.57, lon: 126.98 }, // سيول
];


// أيقونة المدن السعودية — نقطة بيضاء
const createCityIcon = (name) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:8px;height:8px;">
        <div style="
          position:absolute;inset:0;
          background:rgba(255,255,255,0.95);
          border:1.5px solid #000;
          border-radius:50%;
          box-shadow:0 0 3px rgba(0,0,0,0.8), 0 0 1px rgba(0,0,0,0.9);
        "></div>
        <div style="
          position:absolute;
          left:-46px;
          top:11px;
          width:100px;
          text-align:center;
          font-size:9px;
          font-weight:700;
          line-height:1.2;
          color:rgba(255,255,255,0.95);
          text-shadow:0 1px 3px #000, 0 0 6px rgba(0,0,0,0.9),
                      1px 0 0 rgba(0,0,0,0.5), -1px 0 0 rgba(0,0,0,0.5);
          font-family:system-ui,-apple-system,Arial,sans-serif;
          white-space:nowrap;
          pointer-events:none;
          letter-spacing:0.01em;
        ">${name}</div>
      </div>
    `,
    iconSize:   [8, 8],
    iconAnchor: [4, 4],
  });

// أيقونة عواصم الدول — نقطة ذهبية أكبر قليلاً لتمييزها عن المدن
const createCapitalIcon = (name) =>
  L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:10px;height:10px;">
        <div style="
          position:absolute;inset:0;
          background:rgba(255,210,0,0.95);
          border:1.5px solid #000;
          border-radius:50%;
          box-shadow:0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1);
        "></div>
        <div style="
          position:absolute;
          left:-45px;
          top:13px;
          width:100px;
          text-align:center;
          font-size:10px;
          font-weight:800;
          line-height:1.2;
          color:rgba(255,255,180,0.98);
          text-shadow:0 1px 4px #000, 0 0 8px rgba(0,0,0,1),
                      1px 0 0 rgba(0,0,0,0.8), -1px 0 0 rgba(0,0,0,0.8);
          font-family:system-ui,-apple-system,Arial,sans-serif;
          white-space:nowrap;
          pointer-events:none;
          letter-spacing:0.02em;
        ">${name}</div>
      </div>
    `,
    iconSize:   [10, 10],
    iconAnchor: [5, 5],
  });



// الحدود الجغرافية: من موريتانيا غرباً (~18°W) إلى الصين شرقاً (~135°E)
// جنوباً: ~15°S (وسط أفريقيا)، شمالاً: ~58°N (وسط آسيا)
const middleEastBounds = [[-15.0, -20.0], [58.0, 138.0]];

function MapEventsHandler() {
  const map = useMapEvents({
    zoom: () => document.documentElement.style.setProperty('--map-zoom', map.getZoom()),
  });
  useEffect(() => {
    document.documentElement.style.setProperty('--map-zoom', map.getZoom());
  }, [map]);
  return null;
}

/* ─────────────────────────────────────────────── */
export default function App() {
  const [activeLayer, setActiveLayer] = useState(RGB_COMPOSITES[0].id); // كتلة الهواء — تعمل 24/7
  const [isPlaying,    setIsPlaying]  = useState(false);
  const [loadingTiles, setLoadingTiles] = useState(false);
  const [animSpeed,    setAnimSpeed]  = useState(1000);
  const mapRef = useRef(null);

  // الطبقة النشطة مع معلوماتها (crs84 flag)
  const ALL_LAYERS = [...RGB_COMPOSITES, ...CHANNELS];
  const ALL_REALEARTH = [...REALEARTH_MET11, ...REALEARTH_MET8];
  const activeDef  = ALL_LAYERS.find(l => l.id === activeLayer);
  const activeRealEarth = ALL_REALEARTH.find(l => l.id === activeLayer);

  const [timeRange, setTimeRange]   = useState(12);

  // ✨ lazy load — إطار واحد فقط عند الفتح، التاريخ عند الطلب
  const [timeSteps,     setTimeSteps]     = useState(() => generateLatestStep());
  const [timeIndex,     setTimeIndex]     = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);

  // ref لتجنب مشكلة closure في useEffect
  const historyRef  = useRef(false);
  const timeRangeRef = useRef(12);
  useEffect(() => { historyRef.current  = historyLoaded; }, [historyLoaded]);
  useEffect(() => { timeRangeRef.current = timeRange;    }, [timeRange]);

  /** تحميل كل التاريخ عند أول تفاعل مع الشريط (lazy) */
  const loadHistory = (range = timeRangeRef.current) => {
    if (historyRef.current) return; // تم تحميله بالفعل
    const allSteps = generateTimeSteps(range);
    setTimeSteps(allSteps);
    setTimeIndex(allSteps.length - 1);
    setHistoryLoaded(true);
    historyRef.current = true;
  };

  // تحديث تلقائي كل دقيقة
  useEffect(() => {
    const timer = setInterval(() => {
      // استخدم ref.current لتجنب stale closure
      if (historyRef.current) {
        // وضع التاريخ: أضف أحدث إطار في نهاية القائمة
        const allNew = generateTimeSteps(timeRangeRef.current);
        setTimeSteps(prev => {
          if (allNew[allNew.length - 1] !== prev[prev.length - 1]) {
            setTimeIndex(pi => pi === prev.length - 1 ? allNew.length - 1 : pi);
            return allNew;
          }
          return prev;
        });
      } else {
        // وضع إطار واحد: حدّث الإطار الأخير فقط
        const fresh = generateLatestStep();
        setTimeSteps(prev => {
          if (fresh[0] !== prev[0]) { setTimeIndex(0); return fresh; }
          return prev;
        });
      }
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []); // [] — يعمل مرة واحدة، يستخدم refs للقيم المتغيرة

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    const iv = setInterval(
      () => setTimeIndex(p => (p >= timeSteps.length - 1 ? 0 : p + 1)),
      animSpeed
    );
    return () => clearInterval(iv);
  }, [isPlaying, timeSteps.length, animSpeed]);

  const selectLayer = (id) => {
    setLoadingTiles(true);
    setActiveLayer(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const TEAL   = 'bg-gradient-to-r from-blue-500/20 to-teal-500/20 border border-teal-500/50 text-teal-300';
  const ORANGE = 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/50 text-orange-300';
  const INACTIVE = 'bg-white/5 border border-transparent text-slate-300 hover:bg-white/10 hover:text-white';

  const LayerBtn = ({ layer, activeGrad, dir: d }) => (
    <button
      key={layer.id}
      onClick={() => selectLayer(layer.id)}
      className={`flex items-center w-full text-right justify-between p-2 md:p-2.5 rounded-lg
        text-[11px] md:text-xs font-medium transition-all
        ${activeLayer === layer.id ? activeGrad : INACTIVE}`}
    >
      <span className="flex-1 whitespace-normal leading-tight ml-2 text-right" dir={d}>{layer.name}</span>
      {activeLayer === layer.id && (
        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
      )}
    </button>
  );

  /* ── render ── */
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-900 text-slate-100 font-sans"
         dir="rtl" onContextMenu={e => e.preventDefault()}>

      {/* ═══ الخريطة ═══ */}
      <div id="map-container" className="absolute inset-0 z-0 bg-slate-900 overflow-hidden">
        {loadingTiles && (
          <div className="absolute inset-x-0 top-0 h-1 z-50">
            <div className="h-full bg-teal-400 animate-pulse w-full" />
          </div>
        )}

        <MapContainer
          ref={mapRef}
          center={[24.5, 45.0]} zoom={5} minZoom={3} maxZoom={13}
          maxBounds={middleEastBounds} maxBoundsViscosity={0.8}
          className="w-full h-full outline-none"
          zoomControl={false} attributionControl={false}
        >
          <MapEventsHandler />

          {/* خلفية داكنة */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            attribution="" zIndex={1} opacity={0.3}
          />

          {/* ═══ طبقة القمر الصناعي ═══ */}
          {activeLayer.startsWith('re:') && activeRealEarth ? (
            // RealEarth SSEC — Meteosat 8/11 tiles
            <RealEarthTileLayer
              key={`realearth-${activeLayer}`}
              productId={activeRealEarth.productId}
              timestamp={timeSteps[timeIndex]}
              opacity={1.0}
              zIndex={10}
              onLoading={() => setLoadingTiles(true)}
              onLoad={() => setLoadingTiles(false)}
            />
          ) : activeLayer.startsWith('meteored:') ? (
            // Meteored — صور مربعات مجمّعة
            <StitchedMeteorLayer
              key={`meteored-${activeLayer}`}
              layerType={activeLayer.split(':')[1]}
              timestamp={Math.floor(new Date(timeSteps[timeIndex]).getTime() / 1000)}
              opacity={1.0}
              zIndex={10}
              onLoading={() => setLoadingTiles(true)}
              onLoad={() => setLoadingTiles(false)}
            />
          ) : (
            // EUMETSAT WMS — صورة كاملة
            // useMercator = !crs84: طبقات msg_fes تحتاج EPSG:3857، msg_iodc تحتاج CRS:84
            <NonTiledWMSLayer
              key={`eumetsat-${activeLayer}`}
              url={SATELLITE_URL}
              layers={activeLayer}
              format="image/jpeg"
              transparent={false}
              time={timeSteps[timeIndex]}
              opacity={1.0}
              zIndex={10}
              useMercator={!activeDef?.crs84}
              onLoading={() => setLoadingTiles(true)}
              onLoad={() => setLoadingTiles(false)}
            />
          )}

          {/* ═══ طبقة الحدود — EPSG:3857 متطابق مع EUMETSAT ═══ */}
          <NonTiledWMSLayer
            key="boundaries"
            url={SATELLITE_URL}
            layers="ne_10m_coastline,ne_boundary_lines_land,ne_10m_admin_1_states_provinces_lines"
            format="image/png"
            transparent={true}
            opacity={1.0}
            zIndex={100}
            useMercator={true}
          />

          {/* نقاط المدن السعودية — بيضاء */}
          {CITIES.map((city, i) => (
            <Marker key={`city-${i}`} position={[city.lat, city.lon]}
                    icon={createCityIcon(city.name)} interactive={false} />
          ))}

          {/* عواصم الدول — ذهبية مع اسم الدولة */}
          {CAPITALS.map((cap, i) => (
            <Marker key={`cap-${i}`} position={[cap.lat, cap.lon]}
                    icon={createCapitalIcon(cap.name)} interactive={false} />
          ))}
        </MapContainer>
      </div>

      {/* ═══ Header ═══ */}
      <header className="absolute top-0 left-0 right-0 z-50 pt-10 px-2 md:p-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-end items-start md:items-center
                        pointer-events-auto gap-2">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="flex items-center gap-2 p-2 md:py-2.5 md:px-4
                       backdrop-blur-xl bg-slate-900/80 border border-white/20
                       rounded-lg md:rounded-xl text-white hover:bg-teal-500/40
                       transition-colors shadow-lg"
          >
            <span className="hidden md:block font-bold text-sm tracking-wide">
              {sidebarOpen ? 'إغلاق القائمة' : 'قائمة الأقمار'}
            </span>
            {sidebarOpen ? <X className="w-4 h-4 md:w-5 md:h-5" /> : <Menu className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        </div>
      </header>

      {/* ═══ Sidebar ═══ */}
      <aside className={`absolute top-20 right-3 bottom-28 z-40
                         w-[70vw] max-w-[280px] md:w-72 lg:w-80
                         backdrop-blur-2xl bg-slate-900/90 border border-white/10
                         rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
                         flex flex-col transition-transform duration-500 ease-in-out overflow-hidden
                         ${sidebarOpen ? 'translate-x-0' : 'translate-x-[120%]'}`}>
        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Layers size={20} className="text-blue-400" />
            طبقات القمر الصناعي
          </h2>

          <div className="space-y-5">

            {/* مركبات RGB */}
            <div>
              <h3 className="text-xs font-bold text-teal-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">مركبات RGB — MSG-FES</h3>
              <div className="grid gap-1.5">
                {RGB_COMPOSITES.map(l => <LayerBtn key={l.id} layer={l} activeGrad={TEAL} />)}
              </div>
            </div>

            {/* القنوات الأساسية */}
            <div>
              <h3 className="text-xs font-bold text-blue-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">القنوات الأساسية — MSG-FES</h3>
              <div className="grid gap-1.5">
                {CHANNELS.map(l => <LayerBtn key={l.id} layer={l} activeGrad={TEAL} />)}
              </div>
            </div>

            {/* Meteosat 11 — RealEarth */}
            <div>
              <h3 className="text-xs font-bold text-emerald-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">🛰️ Meteosat 11 — RealEarth</h3>
              <div className="grid gap-1.5">
                {REALEARTH_MET11.map(l => (
                  <LayerBtn key={l.id} layer={l} activeGrad="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/50 text-emerald-300" />
                ))}
              </div>
            </div>

            {/* Meteosat 8 — RealEarth */}
            <div>
              <h3 className="text-xs font-bold text-purple-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">🛰️ Meteosat 8 — RealEarth</h3>
              <div className="grid gap-1.5">
                {REALEARTH_MET8.map(l => (
                  <LayerBtn key={l.id} layer={l} activeGrad="bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-purple-500/50 text-purple-300" />
                ))}
              </div>
            </div>

            {/* Meteored */}
            <div>
              <h3 className="text-xs font-bold text-orange-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">أقمار Meteored</h3>
              <div className="grid gap-1.5">
                {METEORED_LAYERS.map(l => (
                  <LayerBtn key={l.id} layer={l} activeGrad={ORANGE} dir="ltr" />
                ))}
              </div>
            </div>

            {/* سرعة التشغيل */}
            <div>
              <h3 className="text-xs font-bold text-slate-400/80 mb-2 uppercase tracking-widest
                             border-b border-white/5 pb-1">سرعة التشغيل</h3>
              <div className="flex gap-1.5">
                {[{label:'بطيء',ms:2000},{label:'متوسط',ms:1000},{label:'سريع',ms:400}].map(s => (
                  <button key={s.ms} onClick={() => setAnimSpeed(s.ms)}
                    className={`flex-1 p-1.5 rounded-lg text-[10px] md:text-xs font-medium
                                transition-all border ${
                      animSpeed === s.ms
                        ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
                        : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      </aside>

      {/* ═══ Timeline ═══ */}
      <div className="absolute bottom-4 md:bottom-8 left-0 right-0 z-30 px-3 md:px-8">
        <div className="max-w-3xl mx-auto backdrop-blur-xl bg-slate-900/80 border border-white/10
                        rounded-2xl md:rounded-[20px] shadow-2xl p-2 md:p-3
                        flex flex-col gap-1.5 md:gap-2 pb-3 md:pb-5">

          {/* نطاق الوقت — يُحمّل التاريخ عند أول استخدام */}
          <div className="flex justify-center items-center gap-1 mb-1 md:mb-0">
            {[12, 24, 48].map(h => (
              <button key={h}
                onClick={() => {
                  // حمّل التاريخ أولاً ثم غيّر النطاق
                  const allSteps = generateTimeSteps(h);
                  setTimeRange(h);
                  setTimeSteps(allSteps);
                  setTimeIndex(allSteps.length - 1);
                  setHistoryLoaded(true);
                  setLoadingTiles(true);
                  setIsPlaying(false);
                }}
                className={`px-2 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[11px] font-bold
                            rounded-full border transition-all ${
                  timeRange === h && historyLoaded
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/50 shadow-[0_0_10px_rgba(20,184,166,0.3)]'
                    : 'bg-transparent text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}>
                {h} ساعات
              </button>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3">

            {/* زر التشغيل */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => {
                  loadHistory(); // حمّل التاريخ عند أول ضغط على تشغيل
                  setIsPlaying(p => !p);
                }}
                className="p-2 md:p-2.5 shrink-0 bg-gradient-to-r from-blue-600 to-teal-500
                           rounded-full text-white hover:scale-105 transition-transform
                           shadow-lg shadow-blue-500/30">
                {isPlaying
                  ? <Pause size={16} className="md:w-5 md:h-5" fill="currentColor" />
                  : <Play  size={16} className="md:w-5 md:h-5" fill="currentColor" />}
              </button>

              {/* Mobile time — GMT فقط */}
              <div className="md:hidden flex-1 backdrop-blur-md bg-white/5 border border-white/10
                              rounded-lg py-1.5 px-3 flex justify-between items-center">
                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Calendar size={12} /> GMT
                </div>
                <div className="text-[12px] font-bold text-teal-300 font-mono" dir="ltr">
                  {new Date(timeSteps[timeIndex]).toLocaleString('en-GB',{
                    hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}
                </div>
              </div>
            </div>

            {/* Slider — تحميل التاريخ lazy عند أول تحريك */}
            <div className="w-full flex-1 px-1 md:px-2 relative">
              {!historyLoaded && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px]
                                text-slate-500 whitespace-nowrap pointer-events-none">
                  ◄ اسحب لتحميل الصور السابقة
                </div>
              )}
              <input type="range" min="0" max={timeSteps.length - 1} value={timeIndex}
                onMouseDown={() => loadHistory()}
                onTouchStart={() => loadHistory()}
                onChange={e => {
                  setLoadingTiles(true);
                  setTimeIndex(+e.target.value);
                  setIsPlaying(false);
                }}
                className="w-full h-1.5 md:h-2 bg-slate-700 rounded-lg appearance-none
                           cursor-pointer accent-teal-400" />
            </div>

            {/* Desktop time — GMT فقط */}
            <div className="hidden md:block min-w-[120px] text-center backdrop-blur-md
                            bg-white/5 border border-white/10 rounded-lg py-1.5 px-3">
              <div className="text-[9px] text-slate-400 font-medium mb-0.5">GMT</div>
              <div className="text-[13px] font-bold text-teal-300 font-mono" dir="ltr">
                {new Date(timeSteps[timeIndex]).toLocaleString('en-GB',{
                  hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}
              </div>
            </div>

          </div>

          <div className="flex justify-between items-center text-[10px] md:text-xs
                          text-slate-400 px-1 md:px-16 font-mono">
            <span>-{timeRange}h</span>
            <span>-{timeRange/2}h</span>
            <span>الآن</span>
          </div>
        </div>
      </div>

    </div>
  );
}
