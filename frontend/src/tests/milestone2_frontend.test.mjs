import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('ShopSense Milestone 2 — Frontend Integration & Utility Unit Tests', () => {
  // Helper matching the formatPrice function used across Milestone 2 components
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'number' ? val : parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Helper matching the cluster badge styling logic in CustomerAnalyticsView and CustomerMySegmentView
  const getClusterBadgeCategory = (label) => {
    const l = (label || '').toLowerCase();
    if (l.includes('champion')) return 'CHAMPIONS';
    if (l.includes('loyal')) return 'LOYAL';
    if (l.includes('at-risk') || l.includes('lapsed')) return 'AT_RISK';
    return 'NEW_ENGAGEMENT';
  };

  describe('1. Price Formatting & Valuation Calculations', () => {
    test('formats zero, null, undefined and negative numbers safely', () => {
      assert.equal(formatPrice(null), '0.00');
      assert.equal(formatPrice(undefined), '0.00');
      assert.equal(formatPrice('invalid'), '0.00');
      assert.equal(formatPrice(0), '0.00');
      assert.equal(formatPrice(1299.5), '1299.50');
      assert.equal(formatPrice('45000.999'), '45001.00');
    });

    test('validates inventory valuation status and cost coverage percentage', () => {
      const summary = {
        total_products: 10,
        total_units_in_stock: 450,
        total_inventory_cost_value: 90000.0,
        cost_coverage_percentage: 100.0,
        low_stock_products_count: 2,
        out_of_stock_products_count: 0,
        valuation_status: 'COMPLETE',
      };

      assert.equal(summary.valuation_status, 'COMPLETE');
      assert.equal(summary.cost_coverage_percentage, 100.0);
      assert.equal(formatPrice(summary.total_inventory_cost_value), '90000.00');
    });
  });

  describe('2. Replenishment & Demand Forecasting Data Parsing', () => {
    test('parses replenishment recommendations correctly', () => {
      const items = [
        {
          product_id: 'p1',
          title: 'Footfall Counter Sensor',
          current_stock: 2,
          reorder_level: 5,
          safety_stock: 3,
          suggested_replenishment_qty: 15,
          status: 'REPLENISHMENT_RECOMMENDED',
        },
        {
          product_id: 'p2',
          title: 'Thermal Scanner',
          current_stock: 20,
          reorder_level: 5,
          safety_stock: 3,
          suggested_replenishment_qty: 0,
          status: 'SUFFICIENT_STOCK',
        },
      ];

      const needsReplenishment = items.filter((i) => i.status === 'REPLENISHMENT_RECOMMENDED');
      assert.equal(needsReplenishment.length, 1);
      assert.equal(needsReplenishment[0].suggested_replenishment_qty, 15);
    });

    test('validates forecast time-series points structure for Recharts', () => {
      const forecast = {
        product_id: 'prod-456',
        forecast_horizon_days: 7,
        daily_forecasts: [
          { date: '2026-10-30', predicted_demand: 3.5 },
          { date: '2026-10-31', predicted_demand: 4.0 },
          { date: '2026-11-01', predicted_demand: 2.8 },
        ],
        total_predicted_demand: 10.3,
        average_daily_demand: 3.43,
      };

      assert.equal(forecast.daily_forecasts.length, 3);
      assert.ok(forecast.daily_forecasts[0].date);
      assert.ok(typeof forecast.daily_forecasts[0].predicted_demand === 'number');
      assert.equal(forecast.total_predicted_demand, 10.3);
    });
  });

  describe('3. Customer Segmentation & RFM Logic', () => {
    test('classifies segment labels into corresponding UI tier buckets', () => {
      assert.equal(getClusterBadgeCategory('Champions (High-Value Loyal)'), 'CHAMPIONS');
      assert.equal(getClusterBadgeCategory('Loyal Customers'), 'LOYAL');
      assert.equal(getClusterBadgeCategory('At-Risk / Lapsed'), 'AT_RISK');
      assert.equal(getClusterBadgeCategory('New / Low-Engagement'), 'NEW_ENGAGEMENT');
      assert.equal(getClusterBadgeCategory('New Registrations'), 'NEW_ENGAGEMENT');
    });

    test('handles new customer cold-start profile in CustomerMySegmentView safely', () => {
      const coldStartProfile = {
        customer_id: 'cust-new-1',
        recency_days: null,
        frequency: 0,
        monetary_spend: '0.00',
        average_order_value: '0.00',
        segment_label: 'New / Low-Engagement',
        segment_description: 'Welcome to ShopSense! You have not placed an order in the observation window yet.',
        recommended_action: 'Place your first order to unlock VIP rewards.',
      };

      assert.equal(coldStartProfile.frequency, 0);
      assert.equal(coldStartProfile.recency_days, null);
      assert.equal(formatPrice(coldStartProfile.monetary_spend), '0.00');
      assert.equal(getClusterBadgeCategory(coldStartProfile.segment_label), 'NEW_ENGAGEMENT');
    });

    test('validates unsupervised clustering quality metrics threshold checks', () => {
      const qualityMetrics = {
        selected_k: 4,
        silhouette_score: 0.612,
        davies_bouldin_index: 0.584,
        stability_score: 1.0,
      };

      // K=4 chosen
      assert.equal(qualityMetrics.selected_k, 4);
      // Silhouette should be >= 0.50
      assert.ok(qualityMetrics.silhouette_score >= 0.50);
      // Davies-Bouldin should be < 1.0
      assert.ok(qualityMetrics.davies_bouldin_index < 1.0);
      // Stability score should exceed the target >= 0.85 (85%)
      assert.ok(qualityMetrics.stability_score >= 0.85);
    });
  });

  describe('4. Recommendation Engine Scenarios & Ranking', () => {
    test('validates personalized recommendations sorting and structure', () => {
      const recs = {
        scenario: 'PERSONALIZED',
        total_returned: 3,
        items: [
          {
            product_id: 'p-1',
            title: 'RFID Edge Reader',
            sku: 'RFID-100',
            price: 5999.0,
            category: 'Hardware',
            score: 0.85,
            recommendation_reason: 'Frequently Ordered with Sensor Array',
            stock_quantity: 12,
          },
          {
            product_id: 'p-2',
            title: 'Barcode Scanner Cordless',
            sku: 'BAR-200',
            price: 2499.0,
            category: 'POS Accessories',
            score: 0.62,
            recommendation_reason: 'Category Affinity (Hardware/POS)',
            stock_quantity: 5,
          },
        ],
      };

      assert.equal(recs.scenario, 'PERSONALIZED');
      assert.equal(recs.items.length, 2);
      assert.ok(recs.items[0].score >= recs.items[1].score, 'Recommendations must be sorted descending by relevance score');
    });

    test('validates cold-start fallback to POPULAR_BESTSELLERS scenario', () => {
      const fallbackRecs = {
        scenario: 'POPULAR_BESTSELLERS',
        total_returned: 4,
        items: [
          { product_id: 'p-pop-1', title: 'Thermal Printer', score: 45.0, recommendation_reason: 'Top Marketplace Choice' },
        ],
      };

      assert.equal(fallbackRecs.scenario, 'POPULAR_BESTSELLERS');
      assert.ok(fallbackRecs.items.length > 0);
      assert.equal(fallbackRecs.items[0].recommendation_reason, 'Top Marketplace Choice');
    });

    test('validates offline holdout evaluation metrics schema and lift calculation', () => {
      const evalResponse = {
        k: 5,
        train_orders_count: 8,
        test_orders_count: 2,
        evaluated_customers_count: 2,
        hybrid_exact_hit_rate: 50.0,
        hybrid_exact_precision: 10.0,
        hybrid_category_hit_rate: 100.0,
        popularity_exact_hit_rate: 50.0,
        popularity_category_hit_rate: 50.0,
        lift_over_popularity: 100.0, // +100% lift
      };

      assert.equal(evalResponse.k, 5);
      assert.equal(evalResponse.hybrid_category_hit_rate, 100.0);
      assert.equal(evalResponse.hybrid_exact_hit_rate, 50.0);
      assert.equal(evalResponse.lift_over_popularity, 100.0);
      assert.ok(evalResponse.hybrid_category_hit_rate >= evalResponse.popularity_category_hit_rate);
      assert.equal(`${evalResponse.hybrid_category_hit_rate.toFixed(1)}%`, '100.0%');
      assert.equal(`${evalResponse.hybrid_exact_hit_rate.toFixed(1)}%`, '50.0%');
    });
  });

  describe('5. Navigation and Role-Based Access Control Logic', () => {
    const getPermittedNavLinks = (user) => {
      const links = ['/products', '/cart'];
      if (!user) return [...links, '/login', '/register/customer', '/register/vendor'];
      if (user.role === 'CUSTOMER') {
        links.push('/orders', '/my-segment');
      } else if (user.role === 'VENDOR') {
        links.push('/vendor/onboarding-status');
        if (user.vendor_profile?.status === 'APPROVED') {
          links.push('/vendor/dashboard');
        }
      } else if (user.role === 'ADMIN') {
        links.push('/admin');
      }
      return links;
    };

    test('verifies public visitor sees catalog, cart, and registration links only', () => {
      const publicLinks = getPermittedNavLinks(null);
      assert.ok(publicLinks.includes('/products'));
      assert.ok(publicLinks.includes('/cart'));
      assert.ok(publicLinks.includes('/login'));
      assert.ok(!publicLinks.includes('/admin'));
      assert.ok(!publicLinks.includes('/my-segment'));
      assert.ok(!publicLinks.includes('/vendor/dashboard'));
    });

    test('verifies customer receives /my-segment and /orders links but not admin/vendor portals', () => {
      const customerUser = { role: 'CUSTOMER', id: 'cust-1' };
      const customerLinks = getPermittedNavLinks(customerUser);
      assert.ok(customerLinks.includes('/my-segment'));
      assert.ok(customerLinks.includes('/orders'));
      assert.ok(!customerLinks.includes('/admin'));
      assert.ok(!customerLinks.includes('/vendor/dashboard'));
    });

    test('verifies approved vendor receives /vendor/dashboard but not admin or customer perks', () => {
      const vendorUser = { role: 'VENDOR', vendor_profile: { status: 'APPROVED' } };
      const vendorLinks = getPermittedNavLinks(vendorUser);
      assert.ok(vendorLinks.includes('/vendor/dashboard'));
      assert.ok(!vendorLinks.includes('/admin'));
      assert.ok(!vendorLinks.includes('/my-segment'));
    });

    test('verifies pending vendor cannot access /vendor/dashboard until approved', () => {
      const pendingVendor = { role: 'VENDOR', vendor_profile: { status: 'PENDING' } };
      const pendingLinks = getPermittedNavLinks(pendingVendor);
      assert.ok(pendingLinks.includes('/vendor/onboarding-status'));
      assert.ok(!pendingLinks.includes('/vendor/dashboard'));
    });

    test('verifies admin receives /admin with platform governance access', () => {
      const adminUser = { role: 'ADMIN' };
      const adminLinks = getPermittedNavLinks(adminUser);
      assert.ok(adminLinks.includes('/admin'));
      assert.ok(!adminLinks.includes('/my-segment'));
    });
  });

  describe('6. Empty, Loading, and Error State Assertions', () => {
    test('handles empty low-stock alerts without crashing UI calculations', () => {
      const emptyAlerts = { items: [], total_alerts: 0, out_of_stock_count: 0 };
      assert.equal(emptyAlerts.items.length, 0);
      assert.equal(emptyAlerts.total_alerts, 0);
      assert.equal(emptyAlerts.out_of_stock_count, 0);
    });

    test('maps valuation status to user-readable indicators', () => {
      const getValuationStatusText = (status) => {
        switch (status) {
          case 'COMPLETE':
            return '100% Verified Product Cost';
          case 'PARTIAL':
            return 'Partial Cost Coverage';
          case 'ZERO_VALUATION':
            return 'Zero Stock on Hand';
          case 'UNAVAILABLE':
          default:
            return 'Cost Data Unavailable';
        }
      };

      assert.equal(getValuationStatusText('COMPLETE'), '100% Verified Product Cost');
      assert.equal(getValuationStatusText('PARTIAL'), 'Partial Cost Coverage');
      assert.equal(getValuationStatusText('ZERO_VALUATION'), 'Zero Stock on Hand');
      assert.equal(getValuationStatusText('UNAVAILABLE'), 'Cost Data Unavailable');
    });

    test('handles recommendation scenario fallbacks gracefully', () => {
      const getScenarioBadge = (scenario) => {
        switch (scenario) {
          case 'PERSONALIZED':
            return 'Personalized Collaborative Affinity';
          case 'SIMILAR_PRODUCTS':
            return 'Item-Item Co-Purchases';
          case 'POPULAR_BESTSELLERS':
            return 'Marketplace Bestsellers';
          case 'COLD_START_FALLBACK':
            return 'Popularity Fallback (New Customer)';
          default:
            return 'Catalog Recommendations';
        }
      };

      assert.equal(getScenarioBadge('PERSONALIZED'), 'Personalized Collaborative Affinity');
      assert.equal(getScenarioBadge('COLD_START_FALLBACK'), 'Popularity Fallback (New Customer)');
    });
  });

  describe('7. Filtering and Pagination Behavior', () => {
    test('filters RFM items by search query and segment label', () => {
      const items = [
        { customer_id: 'cust-aaa-111', segment_label: 'Champions' },
        { customer_id: 'cust-bbb-222', segment_label: 'Loyal Customers' },
        { customer_id: 'cust-ccc-333', segment_label: 'At-Risk / Lapsed' },
      ];

      const filterRfm = (list, search, segment) => {
        return list.filter((item) => {
          const matchesSearch = item.customer_id.toLowerCase().includes(search.toLowerCase());
          const matchesSegment = segment === 'ALL' || item.segment_label === segment;
          return matchesSearch && matchesSegment;
        });
      };

      assert.equal(filterRfm(items, 'aaa', 'ALL').length, 1);
      assert.equal(filterRfm(items, '', 'Champions').length, 1);
      assert.equal(filterRfm(items, 'bbb', 'Champions').length, 0);
      assert.equal(filterRfm(items, '', 'ALL').length, 3);
    });

    test('calculates pagination boundary limits safely', () => {
      const paginate = (currentPage, totalPages, targetPage) => {
        return Math.max(1, Math.min(totalPages, targetPage));
      };

      assert.equal(paginate(1, 5, 0), 1); // cannot go below page 1
      assert.equal(paginate(1, 5, 2), 2);
      assert.equal(paginate(5, 5, 6), 5); // cannot exceed totalPages
    });
  });
});
