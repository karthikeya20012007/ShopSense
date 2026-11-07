/**
 * ShopSense Product Image Registry & Category Fallback System
 *
 * Provides curated, authentic, high-resolution photography for enterprise retail hardware,
 * smart sensors, POS equipment, and IoT systems, along with verified local static SVG assets
 * and resilient inline SVG category fallbacks.
 */

// Locally bundled static SVG assets located in frontend/public/images/products/
// Served directly by Vite with 100% offline reliability, zero 404 risk, and zero CORS restrictions.
export const CATEGORY_LOCAL_ASSETS: Record<string, string> = {
  'Point of Sale (POS) Terminals': '/images/products/pos-terminal.svg',
  'Barcode & QR Scanners': '/images/products/barcode-scanner.svg',
  'RFID Tags & Smart Readers': '/images/products/rfid-reader.svg',
  'Electronic Shelf Labels (ESL)': '/images/products/electronic-shelf-label.svg',
  'Inventory Counting Scales': '/images/products/counting-scale.svg',
  'Cash Drawers & Receipt Printers': '/images/products/receipt-printer.svg',
  'Footfall & Customer Tracking': '/images/products/footfall-counter.svg',
  'IoT Environmental Sensors': '/images/products/environmental-sensor.svg',
  'Hardware': '/images/products/retail-hardware.svg',
  'Sensors': '/images/products/environmental-sensor.svg',
  'POS Accessories': '/images/products/pos-terminal.svg',
  'Electronics': '/images/products/retail-hardware.svg',
  'Software': '/images/products/retail-hardware.svg',
  'Default': '/images/products/retail-hardware.svg',
};

// Resilient inline SVG Data URIs (used as ultimate fail-safe if network/file requests are blocked)
export const CATEGORY_SVG_FALLBACKS: Record<string, string> = {
  'Barcode & QR Scanners':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><path d="M120 70h160c11 0 20 9 20 20v80c0 11-9 20-20 20H120c-11 0-20-9-20-20V90c0-11 9-20 20-20z" fill="%230f172a"/><rect x="130" y="100" width="8" height="50" fill="%2338bdf8"/><rect x="145" y="100" width="14" height="50" fill="%2338bdf8"/><rect x="166" y="100" width="6" height="50" fill="%2338bdf8"/><rect x="180" y="100" width="20" height="50" fill="%2338bdf8"/><rect x="207" y="100" width="10" height="50" fill="%2338bdf8"/><rect x="224" y="100" width="16" height="50" fill="%2338bdf8"/><rect x="247" y="100" width="8" height="50" fill="%2338bdf8"/><path d="M175 190l-15 65c-2 8 4 15 12 15h56c8 0 14-7 12-15l-15-65h-50z" fill="%23334155"/><line x1="80" y1="125" x2="320" y2="125" stroke="%23ef4444" stroke-width="3" stroke-dasharray="4,4"/><text x="200" y="285" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">2D Optical Laser Imager</text></svg>',

  'IoT Environmental Sensors':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="140" y="60" width="120" height="150" rx="16" fill="%230f172a"/><circle cx="200" cy="115" r="32" fill="%231e293b" stroke="%230ea5e9" stroke-width="3"/><path d="M195 102a10 10 0 0 1 10 10c0 4-2 7-5 9v12h-10v-12c-3-2-5-5-5-9a10 10 0 0 1 10-10z" fill="%230ea5e9"/><path d="M170 170h60" stroke="%23475569" stroke-width="4" stroke-linecap="round"/><circle cx="160" cy="75" r="4" fill="%2310b981"/><path d="M200 60V30M190 30h20" stroke="%2394a3b8" stroke-width="4" stroke-linecap="round"/><text x="200" y="250" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Wireless LoRaWAN / BLE Node</text></svg>',

  'Footfall & Customer Tracking':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="110" y="70" width="180" height="75" rx="14" fill="%230f172a"/><circle cx="160" cy="107" r="22" fill="%231e293b" stroke="%2338bdf8" stroke-width="3"/><circle cx="160" cy="107" r="9" fill="%230284c7"/><circle cx="240" cy="107" r="22" fill="%231e293b" stroke="%2338bdf8" stroke-width="3"/><circle cx="240" cy="107" r="9" fill="%230284c7"/><path d="M140 145l-40 90h200l-40-90z" fill="%230284c7" fill-opacity="0.08"/><path d="M100 235l100-30 100 30" stroke="%230284c7" stroke-width="2" stroke-dasharray="6,4" fill="none"/><text x="200" y="270" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">3D Stereoscopic AI Counter</text></svg>',

  'Electronic Shelf Labels (ESL)':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="100" y="65" width="200" height="135" rx="8" fill="%231e293b" stroke="%23cbd5e1" stroke-width="3"/><rect x="112" y="77" width="176" height="111" rx="4" fill="%23ffffff"/><text x="125" y="105" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="%230f172a">DYNAMIC ESL</text><text x="125" y="125" font-family="system-ui,sans-serif" font-size="10" font-weight="500" fill="%2364748b">SKU: ESL-42-RED</text><text x="125" y="165" font-family="system-ui,sans-serif" font-size="28" font-weight="900" fill="%23dc2626">₹2,499</text><rect x="235" y="130" width="40" height="40" fill="%230f172a"/><circle cx="270" cy="88" r="4" fill="%2310b981"/><text x="200" y="245" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">4.2 inch Tri-Color E-Paper Display</text></svg>',

  'Point of Sale (POS) Terminals':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="110" y="55" width="180" height="120" rx="10" fill="%230f172a"/><rect x="120" y="65" width="160" height="100" rx="6" fill="%230284c7"/><path d="M125 150h150" stroke="%2338bdf8" stroke-width="2"/><circle cx="140" cy="85" r="6" fill="%23ffffff"/><rect x="155" y="81" width="60" height="8" rx="3" fill="%23ffffff"/><path d="M180 175l-10 45h60l-10-45z" fill="%23334155"/><rect x="145" y="220" width="110" height="14" rx="4" fill="%231e293b"/><text x="200" y="265" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Dual-Touch Enterprise Workstation</text></svg>',

  'RFID Tags & Smart Readers':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="130" y="60" width="140" height="140" rx="18" fill="%230f172a"/><path d="M165 130a35 35 0 0 1 70 0" stroke="%2338bdf8" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M175 130a20 20 0 0 1 50 0" stroke="%230284c7" stroke-width="4" stroke-linecap="round" fill="none"/><circle cx="200" cy="130" r="6" fill="%2310b981"/><rect x="188" y="200" width="24" height="40" fill="%23475569"/><rect x="160" y="240" width="80" height="12" rx="4" fill="%231e293b"/><text x="200" y="275" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">UHF RFID Multi-Portal Hub</text></svg>',

  'Cash Drawers & Receipt Printers':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="110" y="110" width="180" height="100" rx="8" fill="%231e293b" stroke="%230f172a" stroke-width="2"/><rect x="125" y="150" width="150" height="45" rx="4" fill="%230f172a"/><circle cx="200" cy="172" r="6" fill="%2394a3b8"/><rect x="145" y="55" width="110" height="65" rx="6" fill="%230f172a"/><rect x="160" y="70" width="80" height="10" fill="%23ffffff"/><line x1="160" y1="65" x2="240" y2="65" stroke="%2310b981" stroke-width="3"/><text x="200" y="245" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Heavy-Duty Thermal POS Printer</text></svg>',

  'Inventory Counting Scales':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="100" y="120" width="200" height="85" rx="10" fill="%231e293b"/><rect x="110" y="100" width="180" height="25" rx="4" fill="%23cbd5e1"/><rect x="135" y="140" width="130" height="40" rx="6" fill="%230f172a"/><text x="200" y="168" font-family="monospace" font-size="20" font-weight="700" fill="%2338bdf8" text-anchor="middle">12.500 kg</text><circle cx="280" cy="160" r="4" fill="%2310b981"/><text x="200" y="240" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">High-Precision Piece-Counting Scale</text></svg>',

  'Hardware':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="120" y="70" width="160" height="130" rx="14" fill="%230f172a"/><circle cx="160" cy="115" r="14" fill="%230284c7"/><circle cx="200" cy="115" r="14" fill="%230ea5e9"/><circle cx="240" cy="115" r="14" fill="%2338bdf8"/><rect x="145" y="155" width="110" height="18" rx="4" fill="%231e293b"/><text x="200" y="245" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Enterprise Retail Hardware Hub</text></svg>',

  'Sensors':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><circle cx="200" cy="125" r="60" fill="%230f172a"/><circle cx="200" cy="125" r="44" fill="%231e293b" stroke="%230284c7" stroke-width="3"/><circle cx="200" cy="125" r="20" fill="%2338bdf8"/><path d="M140 125h120M200 65v120" stroke="%2338bdf8" stroke-width="2" stroke-opacity="0.4"/><text x="200" y="240" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Smart Multi-Sensor Node</text></svg>',

  'POS Accessories':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="130" y="80" width="140" height="110" rx="12" fill="%231e293b"/><path d="M150 135h100" stroke="%2338bdf8" stroke-width="6" stroke-linecap="round"/><circle cx="165" cy="110" r="8" fill="%2310b981"/><circle cx="235" cy="110" r="8" fill="%230284c7"/><text x="200" y="235" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Commercial POS Accessory</text></svg>',

  'Electronics':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="120" y="75" width="160" height="115" rx="8" fill="%23064e3b" stroke="%2310b981" stroke-width="2"/><circle cx="150" cy="105" r="8" fill="%2334d399"/><circle cx="180" cy="105" r="8" fill="%2334d399"/><rect x="205" y="95" width="55" height="40" fill="%230f172a"/><path d="M135 150h130" stroke="%2334d399" stroke-width="2" stroke-dasharray="8,4"/><text x="200" y="235" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Embedded Smart Microcontroller</text></svg>',

  'Software':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="110" y="65" width="180" height="125" rx="8" fill="%230f172a"/><rect x="120" y="75" width="160" height="105" rx="4" fill="%231e293b"/><path d="M135 150l25-30 25 15 35-40 25 25" stroke="%2338bdf8" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="220" cy="95" r="4" fill="%2338bdf8"/><text x="200" y="240" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Cloud Retail Telemetry Suite</text></svg>',

  'Default':
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><rect width="400" height="300" fill="%23f8fafc"/><rect x="120" y="70" width="160" height="120" rx="12" fill="%230f172a"/><circle cx="200" cy="130" r="30" fill="%231e293b" stroke="%230284c7" stroke-width="2"/><text x="200" y="137" font-family="system-ui,sans-serif" font-size="20" font-weight="800" fill="%2338bdf8" text-anchor="middle">ShopSense</text><text x="200" y="240" font-family="system-ui,sans-serif" font-size="12" font-weight="600" fill="%2364748b" text-anchor="middle">Verified Retail Solution</text></svg>'
};

// Verified high-resolution hardware photography returning HTTP 200 image/jpeg
export const CURATED_PRODUCT_PHOTOGRAPHY: Record<string, string> = {
  // Scanners & Imagers
  'scanner': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  'barcode': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  'qr': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  'laser': 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80',
  'imager': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
  
  // IoT & Environmental Sensors
  'sensor': 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
  'temperature': 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80',
  'humidity': 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80',
  'climate': 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80',
  'footfall': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
  'thermal': 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
  'traffic': 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
  'ambient': 'https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=600&q=80',

  // Electronic Shelf Labels (ESL)
  'shelf': 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80',
  'e-paper': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
  'label': 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=600&q=80',
  'gateway': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',

  // Point of Sale (POS) Terminals & Workstations
  // Replaced broken 404 URL with verified 200 POS workstation photos
  'pos': 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=600&q=80',
  'terminal': 'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=600&q=80',
  'touchstation': 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=600&q=80',
  'workstation': 'https://images.unsplash.com/photo-1556740758-90de374c12ad?auto=format&fit=crop&w=600&q=80',
  'checkout': 'https://images.unsplash.com/photo-1556742031-c6961e8560b0?auto=format&fit=crop&w=600&q=80',
  'display': 'https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=600&q=80',

  // RFID Infrastructure & Tags
  'rfid': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  'portal': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
  'antenna': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
  'wand': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',

  // Printers & Cash Drawers
  'printer': 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=600&q=80',
  'receipt': 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80',
  'drawer': 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=600&q=80',

  // Scales & Weighing Equipment
  'scale': 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80',
  'counting': 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80',
  'weighing': 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=600&q=80',

  // Generic Retail Hardware & Systems
  'hardware': 'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=600&q=80',
  'electronics': 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&w=600&q=80',
  'software': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
};

/**
 * Resolves the primary image URL for a product using priority:
 * 1. Product's explicit image_url (if provided by backend)
 * 2. Curated keyword match from verified photography registry
 * 3. Verified local static SVG category asset
 * 4. Resilient inline Vector SVG category fallback
 */
export function getProductImage(product?: {
  id?: string;
  title?: string;
  category?: string;
  sku?: string | null;
  image_url?: string | null;
}): string {
  if (!product) return CATEGORY_LOCAL_ASSETS['Default'] || CATEGORY_SVG_FALLBACKS['Default'];

  // 1. Explicit image URL
  if (product.image_url && typeof product.image_url === 'string' && product.image_url.trim().length > 0) {
    return product.image_url.trim();
  }

  const titleLower = (product.title || '').toLowerCase();
  const catLower = (product.category || '').toLowerCase();
  const skuLower = (product.sku || '').toLowerCase();
  const searchString = `${titleLower} ${catLower} ${skuLower}`;

  // 2. Keyword matching for high-quality retail photography
  const keywords = [
    'scanner', 'barcode', 'qr', 'laser', 'imager',
    'rfid', 'portal', 'antenna', 'wand',
    'shelf', 'esl', 'e-paper', 'label', 'gateway',
    'pos', 'touchstation', 'workstation', 'terminal', 'checkout', 'display',
    'footfall', 'thermal', 'traffic', 'ambient', 'temperature', 'humidity', 'sensor',
    'printer', 'receipt', 'drawer',
    'scale', 'counting', 'weighing',
    'hardware', 'electronics', 'software'
  ];

  for (const kw of keywords) {
    if (searchString.includes(kw) && CURATED_PRODUCT_PHOTOGRAPHY[kw]) {
      return CURATED_PRODUCT_PHOTOGRAPHY[kw];
    }
  }

  // 3. Category fallback to local verified asset
  return getCategoryFallbackImage(product.category);
}

/**
 * Returns a high-contrast category fallback image (local static SVG or inline SVG Data URI)
 */
export function getCategoryFallbackImage(category?: string, useInlineFallback = false): string {
  if (!category) {
    return useInlineFallback
      ? CATEGORY_SVG_FALLBACKS['Default']
      : CATEGORY_LOCAL_ASSETS['Default'] || CATEGORY_SVG_FALLBACKS['Default'];
  }

  const lookupTable = useInlineFallback ? CATEGORY_SVG_FALLBACKS : CATEGORY_LOCAL_ASSETS;

  // Exact match
  if (lookupTable[category]) {
    return lookupTable[category];
  }

  // Fuzzy match
  const c = category.toLowerCase();
  if (c.includes('scanner') || c.includes('barcode') || c.includes('qr')) {
    return lookupTable['Barcode & QR Scanners'] || CATEGORY_SVG_FALLBACKS['Barcode & QR Scanners'];
  }
  if (c.includes('sensor') || c.includes('temperature') || c.includes('environmental') || c.includes('climate')) {
    return lookupTable['IoT Environmental Sensors'] || CATEGORY_SVG_FALLBACKS['IoT Environmental Sensors'];
  }
  if (c.includes('footfall') || c.includes('tracking') || c.includes('counter') || c.includes('traffic')) {
    return lookupTable['Footfall & Customer Tracking'] || CATEGORY_SVG_FALLBACKS['Footfall & Customer Tracking'];
  }
  if (c.includes('shelf') || c.includes('esl') || c.includes('tag') || c.includes('label')) {
    return lookupTable['Electronic Shelf Labels (ESL)'] || CATEGORY_SVG_FALLBACKS['Electronic Shelf Labels (ESL)'];
  }
  if (c.includes('pos') || c.includes('terminal') || c.includes('checkout') || c.includes('workstation')) {
    return lookupTable['Point of Sale (POS) Terminals'] || CATEGORY_SVG_FALLBACKS['Point of Sale (POS) Terminals'];
  }
  if (c.includes('rfid')) {
    return lookupTable['RFID Tags & Smart Readers'] || CATEGORY_SVG_FALLBACKS['RFID Tags & Smart Readers'];
  }
  if (c.includes('printer') || c.includes('drawer') || c.includes('cash')) {
    return lookupTable['Cash Drawers & Receipt Printers'] || CATEGORY_SVG_FALLBACKS['Cash Drawers & Receipt Printers'];
  }
  if (c.includes('scale') || c.includes('weigh') || c.includes('counting')) {
    return lookupTable['Inventory Counting Scales'] || CATEGORY_SVG_FALLBACKS['Inventory Counting Scales'];
  }
  if (c.includes('hardware')) {
    return lookupTable['Hardware'] || CATEGORY_SVG_FALLBACKS['Hardware'];
  }
  if (c.includes('electronic')) {
    return lookupTable['Electronics'] || CATEGORY_SVG_FALLBACKS['Electronics'];
  }
  if (c.includes('software')) {
    return lookupTable['Software'] || CATEGORY_SVG_FALLBACKS['Software'];
  }

  return lookupTable['Default'] || CATEGORY_SVG_FALLBACKS['Default'];
}

/**
 * Returns a short badge emoji/icon for category pills
 */
export function getCategoryIcon(category?: string): string {
  if (!category) return '🏷️';
  const c = category.toLowerCase();
  if (c.includes('scanner') || c.includes('barcode')) return '📷';
  if (c.includes('sensor') || c.includes('temperature') || c.includes('iot')) return '📡';
  if (c.includes('footfall') || c.includes('counter') || c.includes('traffic')) return '👥';
  if (c.includes('shelf') || c.includes('esl') || c.includes('label')) return '🏷️';
  if (c.includes('pos') || c.includes('terminal') || c.includes('workstation')) return '🖥️';
  if (c.includes('rfid')) return '📶';
  if (c.includes('printer') || c.includes('drawer')) return '🖨️';
  if (c.includes('scale') || c.includes('weigh') || c.includes('counting')) return '⚖️';
  if (c.includes('hardware')) return '🔌';
  if (c.includes('software')) return '☁️';
  return '📦';
}
