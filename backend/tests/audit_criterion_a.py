"""
ShopSense Milestone 1 Audit — Criterion A: Vendor Onboarding Validation Suite
Evaluates 100 systematic vendor onboarding test cases against FastAPI endpoints.
Pass rate target: >= 99.0%
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.core.config import settings
from backend.app.core.database import Base, get_db
from backend.app.main import app

def run_criterion_a_audit():
    # Strict isolation check: Verify target is shopsense_test
    if "shopsense_test" not in settings.TEST_DATABASE_URL:
        raise RuntimeError(
            f"SAFETY ABORT: TEST_DATABASE_URL must target 'shopsense_test', got: {settings.TEST_DATABASE_URL}"
        )

    test_engine = create_engine(settings.TEST_DATABASE_URL, pool_pre_ping=True)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Ensure clean tables on test database
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    test_cases = []

    # Group 1: Valid registrations with varying fields (20 cases)
    for i in range(1, 21):
        test_cases.append({
            'id': f'TC-ONB-VAL-{i:02d}',
            'group': 'Valid Registration',
            'desc': f'Valid vendor registration variation #{i}',
            'payload': {
                'email': f'valid_vendor_{i}@audit.shopsense.com',
                'password': f'SecurePassword{i}!@#',
                'full_name': f'Test Vendor {i}',
                'store_name': f'Store Enterprise {i}',
                'business_email': f'biz_{i}@store{i}.com' if i % 2 == 0 else '',
                'business_phone': f'+91 980000{i:04d}' if i % 3 == 0 else '',
                'business_address': f'{i} Market Street' if i % 2 == 0 else '',
                'business_description': f'Description for vendor {i}' if i % 2 == 0 else ''
            },
            'expected_status': 201,
            'expected_role': 'VENDOR',
            'expected_status_enum': 'PENDING'
        })

    # Group 2: Duplicate email registrations (15 cases)
    for i in range(1, 16):
        test_cases.append({
            'id': f'TC-ONB-DUP-{i:02d}',
            'group': 'Duplicate Email',
            'desc': f'Duplicate email rejection for valid_vendor_{i}@audit.shopsense.com',
            'payload': {
                'email': f'valid_vendor_{i}@audit.shopsense.com',
                'password': 'AnotherPassword123!',
                'full_name': f'Impostor {i}',
                'store_name': f'Impostor Store {i}'
            },
            'expected_status': 409
        })

    # Group 3: Invalid email formats (15 cases)
    invalid_emails = [
        'plainaddress', '@missingusername.com', 'username@.com', 'username@com',
        'username space@domain.com', 'user..name@domain.com', '.username@domain.com',
        'username@domain..com', 'username@-domain.com', 'username@domain_bad.com',
        'username@domain,com', 'username@domain..org', 'user@domain@domain.com',
        'user@domain .com', 'user@domain.com.'
    ]
    for i, bad_email in enumerate(invalid_emails, 1):
        test_cases.append({
            'id': f'TC-ONB-EML-{i:02d}',
            'group': 'Invalid Email Format',
            'desc': f'Reject invalid email syntax: {bad_email}',
            'payload': {
                'email': bad_email,
                'password': 'SecurePassword123!',
                'full_name': 'Invalid Email User',
                'store_name': 'Invalid Email Store'
            },
            'expected_status': 422
        })

    # Group 4: Password validation constraints (10 cases)
    passwords = ['', 'a', '1234', '1234567', '       ', 'short', 'abc123', 'pass7ch', 'p@ss6', '123456']
    for i, pw in enumerate(passwords, 1):
        test_cases.append({
            'id': f'TC-ONB-PWD-{i:02d}',
            'group': 'Password Validation (<8 chars)',
            'desc': f'Reject password under 8 characters: length={len(pw)}',
            'payload': {
                'email': f'pw_test_{i}@audit.shopsense.com',
                'password': pw,
                'full_name': 'Short Password User',
                'store_name': 'Short Password Store'
            },
            'expected_status': 422
        })

    # Group 5: Missing required fields (10 cases)
    missing_payloads = [
        ({}, 'missing all fields'),
        ({'password': 'ValidPassword123!', 'full_name': 'Name', 'store_name': 'Store'}, 'missing email'),
        ({'email': 'no_pw@audit.shopsense.com', 'full_name': 'Name', 'store_name': 'Store'}, 'missing password'),
        ({'email': 'no_name@audit.shopsense.com', 'password': 'ValidPassword123!', 'store_name': 'Store'}, 'missing full_name'),
        ({'email': 'no_store@audit.shopsense.com', 'password': 'ValidPassword123!', 'full_name': 'Name'}, 'missing store_name'),
        ({'email': 'short_name@audit.shopsense.com', 'password': 'ValidPassword123!', 'full_name': 'A', 'store_name': 'Store'}, 'full_name too short'),
        ({'email': 'short_store@audit.shopsense.com', 'password': 'ValidPassword123!', 'full_name': 'Valid Name', 'store_name': 'A'}, 'store_name too short'),
        ({'email': None, 'password': 'ValidPassword123!', 'full_name': 'Valid Name', 'store_name': 'Store'}, 'null email'),
        ({'email': 'null_pw@audit.shopsense.com', 'password': None, 'full_name': 'Valid Name', 'store_name': 'Store'}, 'null password'),
        ({'email': 'null_store@audit.shopsense.com', 'password': 'ValidPassword123!', 'full_name': 'Valid Name', 'store_name': None}, 'null store_name'),
    ]
    for i, (pld, reason) in enumerate(missing_payloads, 1):
        test_cases.append({
            'id': f'TC-ONB-REQ-{i:02d}',
            'group': 'Missing Required Fields',
            'desc': f'Reject required field constraint: {reason}',
            'payload': pld,
            'expected_status': 422
        })

    # Group 6: Empty/whitespace optional fields (10 cases)
    for i in range(1, 11):
        test_cases.append({
            'id': f'TC-ONB-OPT-{i:02d}',
            'group': 'Empty Optional Fields',
            'desc': f'Accept empty/whitespace optional fields variation #{i}',
            'payload': {
                'email': f'opt_vendor_{i}@audit.shopsense.com',
                'password': 'SecurePassword123!',
                'full_name': f'Optional Vendor {i}',
                'store_name': f'Optional Store {i}',
                'business_email': '   ' if i % 2 == 0 else '',
                'business_phone': '   ' if i % 2 == 0 else '',
                'business_address': '   ' if i % 2 == 0 else '',
                'business_description': '   ' if i % 2 == 0 else ''
            },
            'expected_status': 201,
            'expected_role': 'VENDOR',
            'expected_status_enum': 'PENDING'
        })

    # Group 7: Role escalation & tampering protection (10 cases)
    for i in range(1, 11):
        test_cases.append({
            'id': f'TC-ONB-ESC-{i:02d}',
            'group': 'Role Escalation Protection',
            'desc': f'Prevent privilege escalation tampering #{i}',
            'payload': {
                'email': f'escalate_vendor_{i}@audit.shopsense.com',
                'password': 'SecurePassword123!',
                'full_name': f'Hacker Vendor {i}',
                'store_name': f'Hacker Store {i}',
                'role': 'ADMIN' if i % 2 == 0 else 'SUPERUSER',
                'account_status': 'ACTIVE',
                'status': 'APPROVED' if i % 2 == 0 else 'ACTIVE'
            },
            'expected_status': 201,
            'expected_role': 'VENDOR',
            'expected_status_enum': 'PENDING'
        })

    # Group 8: Sanitization and injection safety (10 cases)
    injection_strings = [
        ("<script>alert('xss')</script>", 'XSS in full_name'),
        ("' OR '1'='1", 'SQL injection in store_name'),
        ("Robert'); DROP TABLE users;--", 'SQL drop in store_name'),
        ("Store & <Sensors> 'Analytics'", 'XML/HTML entities in store_name'),
        ("Store / \\ \" Special chars", 'Escape characters in store_name'),
        ("Store 100% Guaranteed", 'Percentage in store_name'),
        ("Store with unicode: Bharat", 'Unicode in store_name'),
        ("Store with symbols: #1 @ Mall", 'Symbols in store_name'),
        ("Store with newline\nin\nname", 'Newline in store_name'),
        ("Store with tabs\t\tname", 'Tabs in store_name')
    ]
    for i, (inj, reason) in enumerate(injection_strings, 1):
        test_cases.append({
            'id': f'TC-ONB-SEC-{i:02d}',
            'group': 'Special Characters & Injection',
            'desc': f'Safely handle injection/special characters: {reason}',
            'payload': {
                'email': f'injection_vendor_{i}@audit.shopsense.com',
                'password': 'SecurePassword123!',
                'full_name': 'Security Test Vendor',
                'store_name': inj
            },
            'expected_status': 201,
            'expected_role': 'VENDOR',
            'expected_status_enum': 'PENDING'
        })

    passed = 0
    failed = 0
    failed_cases = []
    group_results = {}

    try:
        with TestClient(app) as client:
            for tc in test_cases:
                grp = tc['group']
                if grp not in group_results:
                    group_results[grp] = {'total': 0, 'passed': 0}
                group_results[grp]['total'] += 1

                res = client.post('/api/v1/auth/register/vendor', json=tc['payload'])
                status_ok = (res.status_code == tc['expected_status'])
                role_ok = True
                status_enum_ok = True
                if status_ok and tc['expected_status'] == 201:
                    data = res.json()
                    if data.get('role') != tc.get('expected_role'):
                        role_ok = False
                    if data.get('vendor_profile', {}).get('status') != tc.get('expected_status_enum'):
                        status_enum_ok = False

                if status_ok and role_ok and status_enum_ok:
                    passed += 1
                    group_results[grp]['passed'] += 1
                else:
                    failed += 1
                    failed_cases.append((tc['id'], tc['desc'], tc['expected_status'], res.status_code, res.text[:100]))

        total = len(test_cases)
        pass_rate = (passed / total) * 100

        print("================================================================================")
        print("      CRITERION A AUDIT RESULTS: VENDOR ONBOARDING VALIDATION SUITE             ")
        print("================================================================================")
        print(f"Total Test Cases Executed: {total}")
        print(f"Correctly Handled Cases:   {passed}")
        print(f"Failed Cases:              {failed}")
        print(f"Measured Pass Rate:        {pass_rate:.2f}% (Target: >= 99.00%)")
        print("--------------------------------------------------------------------------------")
        print("RESULTS BY CATEGORY:")
        for grp, res in group_results.items():
            grp_rate = (res['passed'] / res['total']) * 100
            print(f"  * {grp:<32s}: {res['passed']}/{res['total']} passed ({grp_rate:.1f}%)")
        print("--------------------------------------------------------------------------------")
        if failed_cases:
            print("FAILED CASES:")
            for fc in failed_cases:
                print(f"  FAIL: {fc}")
        else:
            print("NO FAILED CASES. 100% OF TEST CASES HANDLED CORRECTLY.")
        print("================================================================================")
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()

if __name__ == '__main__':
    run_criterion_a_audit()
