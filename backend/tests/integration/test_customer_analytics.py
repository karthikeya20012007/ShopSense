import pytest
from fastapi import status
from uuid import UUID

def test_admin_inventory_summary(admin_headers, client):
    resp = client.get('/inventory/admin/summary', headers=admin_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    # Expect keys defined in InventorySummaryResponse
    expected_keys = {"total_products", "total_units_in_stock", "total_inventory_cost_value",
                     "cost_coverage_percentage", "low_stock_products_count", "out_of_stock_products_count",
                     "valuation_status"}
    assert expected_keys.issubset(data.keys())

def test_rfm_pagination(admin_headers, client):
    resp = client.get('/customer-analytics/rfm?page=1&page_size=5', headers=admin_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert 'items' in data and 'total' in data
    assert data['page'] == 1
    assert data['page_size'] == 5
    assert data['total_pages'] >= 0

def test_customer_segmentation(admin_headers, client):
    resp = client.get('/customer-analytics/segments', headers=admin_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    # Verify segmentation metadata exists
    assert 'segments' in data and isinstance(data['segments'], list)
    for segment in data['segments'][:1]:
        assert 'segment_label' in segment and 'customer_count' in segment

def test_my_segment(customer_headers, client):
    resp = client.get('/customer-analytics/my-segment', headers=customer_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    # Expect segment label and metrics
    assert 'segment_label' in data
    assert 'recency_days' in data and 'frequency' in data and 'monetary_spend' in data
