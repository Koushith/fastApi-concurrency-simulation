"""
Report Generation Service

Simulates a CPU-intensive report generation process that:
1. Generates realistic financial transaction data
2. Creates a CSV file with the report
3. Returns metadata including download URL

The artificial delay (10ms per transaction) simulates real-world
scenarios like database queries, aggregations, and file I/O.
"""

import csv
import hashlib
import os
import random
import time
import uuid
from datetime import datetime, timedelta


# Directory to store generated CSV reports
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)


def generate_report(payload: dict) -> dict:
    """
    Generate a financial report as a CSV file.

    Args:
        payload: {"num_transactions": 50, "report_name": "Q1_Finance"}

    Returns:
        dict with file_id, file_name, download_url, and summary stats

    Performance: ~10ms per transaction (simulated processing time)
    """
    num_transactions = payload.get("num_transactions", 50)
    report_name = payload.get("report_name", "Monthly_Report")

    # Deterministic seed for reproducibility
    seed = int(hashlib.md5(report_name.encode()).hexdigest()[:8], 16)
    random.seed(seed)

    # Generate realistic financial transactions
    revenue_categories = ["Sales Income", "Service Fees", "Interest Income", "Consulting"]
    expense_categories = ["Payroll", "Marketing", "Office Supplies", "Software", "Travel", "Utilities"]

    transactions = []
    total_revenue = 0
    total_expenses = 0

    for i in range(num_transactions):
        # Simulate processing time (10ms per transaction)
        time.sleep(0.01)

        # 60% revenue, 40% expenses to ensure positive net income
        is_revenue = random.random() < 0.6
        if is_revenue:
            category_type = "Revenue"
            category_name = random.choice(revenue_categories)
            amount = round(random.uniform(5000, 50000), 2)  # Higher amounts for revenue
        else:
            category_type = "Expense"
            category_name = random.choice(expense_categories)
            amount = round(random.uniform(500, 15000), 2)  # Lower amounts for expenses
        tx_date = datetime.now() - timedelta(days=random.randint(0, 30))

        if category_type == "Revenue":
            total_revenue += amount
        else:
            total_expenses += amount

        transactions.append({
            "Transaction ID": f"TXN-{i+1:05d}",
            "Date": tx_date.strftime("%Y-%m-%d"),
            "Type": category_type,
            "Category": category_name,
            "Description": f"{category_name} - {tx_date.strftime('%B %Y')}",
            "Amount": f"${amount:,.2f}",
            "Amount_Raw": amount,
        })

    # Generate CSV content
    file_id = str(uuid.uuid4())[:8]
    file_name = f"{report_name}_{file_id}.csv"
    file_path = os.path.join(REPORTS_DIR, file_name)

    with open(file_path, "w", newline="") as f:
        # Write header info
        f.write(f"# Financial Report: {report_name}\n")
        f.write(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"# Period: Last 30 Days\n")
        f.write(f"# Total Transactions: {num_transactions}\n")
        f.write(f"#\n")
        f.write(f"# SUMMARY\n")
        f.write(f"# Total Revenue: ${total_revenue:,.2f}\n")
        f.write(f"# Total Expenses: ${total_expenses:,.2f}\n")
        f.write(f"# Net Income: ${total_revenue - total_expenses:,.2f}\n")
        f.write(f"#\n")

        # Write transactions
        writer = csv.DictWriter(f, fieldnames=["Transaction ID", "Date", "Type", "Category", "Description", "Amount"])
        writer.writeheader()
        for tx in transactions:
            row = {k: v for k, v in tx.items() if k != "Amount_Raw"}
            writer.writerow(row)

    # Calculate file size
    file_size = os.path.getsize(file_path)

    return {
        "report_name": report_name,
        "file_id": file_id,
        "file_name": file_name,
        "file_size_bytes": file_size,
        "download_url": f"/api/reports/{file_name}",
        "summary": {
            "total_transactions": num_transactions,
            "total_revenue": round(total_revenue, 2),
            "total_expenses": round(total_expenses, 2),
            "net_income": round(total_revenue - total_expenses, 2),
        },
        "processing_time_ms": num_transactions * 10,
        "status": "success",
    }
