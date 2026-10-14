import enum


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    VENDOR = "VENDOR"
    CUSTOMER = "CUSTOMER"


class AccountStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


class VendorStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class OrderStatus(str, enum.Enum):
    """
    Order lifecycle status.

    Revenue Recognition Policy:
    - COMPLETED: The only status currently recognized as positive realized revenue
      for platform and vendor sales reporting.
    - PENDING: Payment or checkout processing is incomplete. Excluded from realized revenue.
    - CANCELLED: Order was voided or aborted before fulfillment. Excluded from revenue.
    - REFUNDED: Order was refunded. Does not count as positive revenue (and will be treated
      as a contra-revenue deduction or excluded from net revenue in analytics).
    """
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


# Explicit set of order statuses that contribute to recognized revenue in analytics.
REVENUE_RECOGNIZED_ORDER_STATUSES: frozenset[OrderStatus] = frozenset({OrderStatus.COMPLETED})
