import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORY_LOCAL_ASSETS,
  CATEGORY_SVG_FALLBACKS,
  CURATED_PRODUCT_PHOTOGRAPHY,
  getProductImage,
  getCategoryFallbackImage,
  getCategoryIcon,
} from '../utils/productImages.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');

test('ShopSense Product Image Registry & Fallback System', async (t) => {
  const supportedCategories = [
    'Point of Sale (POS) Terminals',
    'Barcode & QR Scanners',
    'Inventory Counting Scales',
    'Footfall & Customer Tracking',
    'IoT Environmental Sensors',
    'Electronic Shelf Labels (ESL)',
    'RFID Tags & Smart Readers',
    'Cash Drawers & Receipt Printers',
  ];

  await t.test('1. Category Local Assets Coverage & Integrity', () => {
    for (const cat of supportedCategories) {
      assert.ok(
        CATEGORY_LOCAL_ASSETS[cat],
        `Category '${cat}' must have a local asset mapping in CATEGORY_LOCAL_ASSETS`
      );
      assert.ok(
        CATEGORY_LOCAL_ASSETS[cat].startsWith('/images/products/'),
        `Asset path for '${cat}' must be located in /images/products/`
      );

      // Verify file exists on disk in public folder
      const diskPath = path.join(publicDir, CATEGORY_LOCAL_ASSETS[cat].replace(/^\//, ''));
      assert.ok(
        fs.existsSync(diskPath),
        `Asset file must exist on disk at: ${diskPath}`
      );

      const content = fs.readFileSync(diskPath, 'utf8');
      assert.ok(content.length > 50, `Asset file at ${diskPath} must be non-empty`);
      assert.ok(content.includes('<svg'), `Asset file at ${diskPath} must contain valid <svg> markup`);
      assert.ok(content.includes('</svg>'), `Asset file at ${diskPath} must close with </svg>`);
    }
  });

  await t.test('2. Resilient Inline SVG Fallbacks Coverage', () => {
    for (const cat of supportedCategories) {
      assert.ok(
        CATEGORY_SVG_FALLBACKS[cat],
        `Category '${cat}' must have an inline fallback in CATEGORY_SVG_FALLBACKS`
      );
      assert.ok(
        CATEGORY_SVG_FALLBACKS[cat].startsWith('data:image/svg+xml;'),
        `Fallback for '${cat}' must be a valid SVG Data URI`
      );
    }
    assert.ok(
      CATEGORY_SVG_FALLBACKS['Default'],
      "CATEGORY_SVG_FALLBACKS must provide a 'Default' entry"
    );
  });

  await t.test('3. Curated Product Photography Registry', () => {
    // Verify essential equipment keywords exist
    const essentialKeywords = [
      'scanner', 'barcode', 'qr',
      'rfid', 'portal',
      'shelf', 'e-paper', 'label',
      'pos', 'terminal', 'touchstation', 'workstation',
      'scale', 'counting',
      'printer', 'receipt', 'drawer',
      'sensor', 'temperature', 'humidity', 'footfall'
    ];

    for (const kw of essentialKeywords) {
      assert.ok(
        CURATED_PRODUCT_PHOTOGRAPHY[kw],
        `Photography registry must contain mapping for keyword '${kw}'`
      );
      assert.ok(
        CURATED_PRODUCT_PHOTOGRAPHY[kw].startsWith('https://images.unsplash.com/'),
        `URL for '${kw}' must be a secure Unsplash CDN image URL`
      );
    }
  });

  await t.test('4. Priority Resolution in getProductImage', () => {
    // Priority 1: Explicit image_url
    const withExplicit = getProductImage({
      id: 'p-1',
      title: 'POS Terminal Workstation',
      image_url: 'https://cdn.vendor.com/custom-pos.png',
      category: 'Point of Sale (POS) Terminals',
    });
    assert.equal(withExplicit, 'https://cdn.vendor.com/custom-pos.png');

    // Priority 2: Keyword match in title
    const withKeyword = getProductImage({
      id: 'p-2',
      title: 'Handheld Bluetooth Barcode Scanner',
      category: 'Barcode & QR Scanners',
    });
    assert.equal(withKeyword, CURATED_PRODUCT_PHOTOGRAPHY['scanner']);

    // Priority 2: POS Touchstation keyword
    const withPos = getProductImage({
      id: 'p-3',
      title: 'Enterprise Touchstation Dual-Display',
      category: 'Point of Sale (POS) Terminals',
    });
    assert.equal(withPos, CURATED_PRODUCT_PHOTOGRAPHY['touchstation']);

    // Priority 3: Fallback to category asset when title and category have no curated keyword match
    const withCustomCategory = getProductImage({
      id: 'p-4',
      title: 'Custom Brand Device',
      category: 'Custom Retail Module',
    });
    assert.equal(withCustomCategory, CATEGORY_LOCAL_ASSETS['Default']);

    // Priority 4: Fallback to default when no category or title
    const emptyProduct = getProductImage();
    assert.equal(emptyProduct, CATEGORY_LOCAL_ASSETS['Default']);
  });

  await t.test('5. Category Fallback Resolution & Fuzzy Matching', () => {
    // Exact match
    const exact = getCategoryFallbackImage('Point of Sale (POS) Terminals');
    assert.equal(exact, '/images/products/pos-terminal.svg');

    // Fuzzy match
    const fuzzyScanner = getCategoryFallbackImage('Industrial Scanners and Optics');
    assert.equal(fuzzyScanner, '/images/products/barcode-scanner.svg');

    const fuzzySensor = getCategoryFallbackImage('Climate & Temperature Nodes');
    assert.equal(fuzzySensor, '/images/products/environmental-sensor.svg');

    // Inline fallback mode
    const inline = getCategoryFallbackImage('Point of Sale (POS) Terminals', true);
    assert.ok(inline.startsWith('data:image/svg+xml;'));
  });

  await t.test('6. Category Emoji Icon Helper', () => {
    assert.equal(getCategoryIcon('Barcode & QR Scanners'), '📷');
    assert.equal(getCategoryIcon('Point of Sale (POS) Terminals'), '🖥️');
    assert.equal(getCategoryIcon('RFID Tags & Smart Readers'), '📶');
    assert.equal(getCategoryIcon('Inventory Counting Scales'), '⚖️');
    assert.equal(getCategoryIcon('Cash Drawers & Receipt Printers'), '🖨️');
    assert.equal(getCategoryIcon('IoT Environmental Sensors'), '📡');
  });
});
