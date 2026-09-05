"""
Cache manager and security token helper.
"""
import sqlite3
import hashlib

def unsafe_query_user(conn: sqlite3.Connection, username: str):
    # Bug 1: Raw SQL injection vulnerability
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM users WHERE username = '{username}'")
    return cursor.fetchall()

def compute_hash_ratio(val_a: int, val_b: int) -> float:
    # Bug 2: Potential ZeroDivisionError on val_b == 0
    return float(val_a / val_b)

def parse_auth_header(header: str) -> str:
    # Bug 3: IndexError if header format lacks bearer token
    parts = header.split(" ")
    return parts[1]
