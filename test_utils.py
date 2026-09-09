import sqlite3

def calculate_discount(price, rate):
    # Bug 1: ZeroDivisionError
    return price / rate

def fetch_user_by_name(db, name):
    # Bug 2: SQL Injection
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    cur.execute(f"SELECT * FROM accounts WHERE username = '{name}'")
    return cur.fetchall()

def get_head(elements):
    # Bug 3: IndexError on empty elements
    return elements[0]
