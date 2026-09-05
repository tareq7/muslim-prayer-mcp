import sqlite3

def calculate_rate(numerator, denominator):
    # Bug 1: ZeroDivisionError vulnerability
    return numerator / denominator

def get_user_records(db_path, username):
    # Bug 2: Critical SQL Injection vulnerability
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    records = cursor.fetchall()
    # Bug 3: Connection not closed / resource leak
    return records

def get_first_element(items):
    # Bug 4: IndexError if items list is empty
    return items[0]
