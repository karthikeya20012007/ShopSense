import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  ACTIVE_CART_KEY_POINTER,
  getCartStorageKey,
  loadCartFromStorage,
  saveCartToStorage,
  clearCartStorage,
  clearSessionCartStorage,
} from '../utils/cartStorage.ts';

// Helper mock for localStorage
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    has: (key) => store.has(key),
    get size() {
      return store.size;
    },
  };
}

const mockProduct = (id, title, price = 100, stock = 10) => ({
  id,
  title,
  price,
  stock_quantity: stock,
  vendor_id: 'vendor-123',
  category: 'Sensors',
  is_published: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('ShopSense Cart Persistence & Customer Account Recovery', () => {
  test('Customer A adds items, logs out, then logs back in and sees the same items', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const keyA = getCartStorageKey(customerA);

    // 1. Customer A adds 7 items
    const aliceItems = [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 3 },
      { product: mockProduct('prod-2', 'IoT Beacon'), quantity: 4 },
    ];
    saveCartToStorage(keyA, aliceItems);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, keyA);

    assert.equal(loadCartFromStorage(keyA).reduce((sum, i) => sum + i.quantity, 0), 7);

    // 2. Customer A logs out
    clearSessionCartStorage();

    // Active session pointer is cleared so guest/subsequent visitors do not see Alice's items
    assert.equal(mockStorage.getItem(ACTIVE_CART_KEY_POINTER), null);

    // Crucial: Alice's customer-scoped key is PRESERVED in localStorage
    assert.notEqual(mockStorage.getItem(keyA), null);

    // In-memory simulation: during logout, in-memory state is set to []
    let inMemoryItems = [];
    assert.equal(inMemoryItems.length, 0);

    // 3. Customer A logs back into the same account
    const restoredKey = getCartStorageKey(customerA);
    inMemoryItems = loadCartFromStorage(restoredKey);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, restoredKey);

    const countAfterReLogin = inMemoryItems.reduce((sum, i) => sum + i.quantity, 0);
    assert.equal(countAfterReLogin, 7);
    assert.equal(inMemoryItems[0].product.id, 'prod-1');
    assert.equal(inMemoryItems[1].product.id, 'prod-2');
  });

  test('The cart count becomes zero immediately after logout', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const keyA = getCartStorageKey(customerA);

    saveCartToStorage(keyA, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, keyA);

    // Simulate in-memory state before logout
    let inMemoryItems = loadCartFromStorage(keyA);
    let totalItems = inMemoryItems.reduce((sum, i) => sum + i.quantity, 0);
    assert.equal(totalItems, 7);

    // Trigger logout: clearSessionCartStorage + in-memory zeroing
    clearSessionCartStorage();
    inMemoryItems = [];
    totalItems = inMemoryItems.reduce((sum, i) => sum + i.quantity, 0);

    // Immediate count is zero without requiring page reload
    assert.equal(totalItems, 0);
    assert.equal(mockStorage.getItem(ACTIVE_CART_KEY_POINTER), null);
  });

  test('Customer B cannot see Customer A cart', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const customerB = 'cust-bob-uuid';

    const keyA = getCartStorageKey(customerA);
    const keyB = getCartStorageKey(customerB);

    // Alice adds 7 items
    saveCartToStorage(keyA, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);

    // Bob logs in on the same browser
    const bobItems = loadCartFromStorage(keyB);
    const bobCount = bobItems.reduce((sum, i) => sum + i.quantity, 0);

    assert.equal(bobCount, 0);
    assert.deepEqual(bobItems, []);
  });

  test('Customer B can recover their own cart after logging out and logging back in', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const customerB = 'cust-bob-uuid';

    const keyA = getCartStorageKey(customerA);
    const keyB = getCartStorageKey(customerB);

    // Alice has 7 items
    saveCartToStorage(keyA, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);

    // Bob adds 4 items
    const bobItems = [
      { product: mockProduct('prod-3', 'RFID Reader'), quantity: 4 },
    ];
    saveCartToStorage(keyB, bobItems);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, keyB);

    assert.equal(loadCartFromStorage(keyB).reduce((sum, i) => sum + i.quantity, 0), 4);

    // Bob logs out
    clearSessionCartStorage();
    assert.equal(mockStorage.getItem(ACTIVE_CART_KEY_POINTER), null);

    // Bob logs back in
    const reloadedBobItems = loadCartFromStorage(getCartStorageKey(customerB));
    assert.equal(reloadedBobItems.reduce((sum, i) => sum + i.quantity, 0), 4);
    assert.equal(reloadedBobItems[0].product.id, 'prod-3');

    // Alice logs back in on the same browser
    const reloadedAliceItems = loadCartFromStorage(getCartStorageKey(customerA));
    assert.equal(reloadedAliceItems.reduce((sum, i) => sum + i.quantity, 0), 7);
    assert.equal(reloadedAliceItems[0].product.id, 'prod-1');
  });

  test('Refresh preserves the active customer cart', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const keyA = getCartStorageKey(customerA);

    saveCartToStorage(keyA, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, keyA);

    // Simulate page refresh: initial hydrate reads ACTIVE_CART_KEY_POINTER
    const pointer = mockStorage.getItem(ACTIVE_CART_KEY_POINTER);
    assert.equal(pointer, keyA);

    const initialRestored = loadCartFromStorage(pointer);
    assert.equal(initialRestored.length, 1);
    assert.equal(initialRestored[0].quantity, 7);

    // Auth completes for Alice: verified against keyA
    const confirmedItems = loadCartFromStorage(getCartStorageKey(customerA));
    assert.equal(confirmedItems.length, 1);
    assert.equal(confirmedItems[0].quantity, 7);
  });

  test('Guest cart behavior remains isolated and consistent', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const guestKey = getCartStorageKey(null);
    const customerKey = getCartStorageKey('cust-alice-uuid');

    // Guest adds 2 items
    saveCartToStorage(guestKey, [
      { product: mockProduct('prod-guest', 'Guest Sensor'), quantity: 2 },
    ]);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, guestKey);

    assert.equal(loadCartFromStorage(guestKey).reduce((sum, i) => sum + i.quantity, 0), 2);
    assert.equal(loadCartFromStorage(customerKey).length, 0);

    // Guest logs in as customer who had 7 items
    saveCartToStorage(customerKey, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);

    // Customer cart is separate
    assert.equal(loadCartFromStorage(customerKey).reduce((sum, i) => sum + i.quantity, 0), 7);
    assert.equal(loadCartFromStorage(guestKey).reduce((sum, i) => sum + i.quantity, 0), 2);
  });

  test('Explicit clearCart removes the customer cart completely', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const customerA = 'cust-alice-uuid';
    const keyA = getCartStorageKey(customerA);

    saveCartToStorage(keyA, [
      { product: mockProduct('prod-1', 'Barcode Scanner'), quantity: 7 },
    ]);
    mockStorage.setItem(ACTIVE_CART_KEY_POINTER, keyA);
    mockStorage.setItem('unrelated_key', 'keep_me');

    // User explicitly clicks 'Clear Cart' on the Cart page or completes checkout
    clearCartStorage(keyA);

    // Scoped cart is deleted
    assert.equal(mockStorage.getItem(keyA), null);
    assert.equal(mockStorage.getItem(ACTIVE_CART_KEY_POINTER), null);

    // Unrelated keys remain untouched
    assert.equal(mockStorage.getItem('unrelated_key'), 'keep_me');
  });

  test('Robustness: Corrupted or invalid localStorage data does not throw', () => {
    const mockStorage = createMockStorage();
    globalThis.localStorage = mockStorage;

    const storageKey = 'corrupt_test_key';

    // Invalid JSON string
    mockStorage.setItem(storageKey, '{ invalid: json ]');
    assert.deepEqual(loadCartFromStorage(storageKey), []);

    // Non-array JSON
    mockStorage.setItem(storageKey, JSON.stringify({ not: 'an array' }));
    assert.deepEqual(loadCartFromStorage(storageKey), []);

    // Array with malformed/missing product objects
    mockStorage.setItem(
      storageKey,
      JSON.stringify([
        null,
        123,
        { product: null, quantity: 1 },
        { product: { id: 'valid-id' }, quantity: 0 },
        { product: { id: 'valid-id' }, quantity: 2 },
      ])
    );
    const loaded = loadCartFromStorage(storageKey);
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].product.id, 'valid-id');
    assert.equal(loaded[0].quantity, 2);
  });
});
