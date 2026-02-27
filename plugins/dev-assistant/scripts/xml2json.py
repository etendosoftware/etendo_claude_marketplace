#!/usr/bin/env python3
"""
Converts Etendo sourcedata XML files to compact JSON.

Usage:
  # Show all records in a file (compact table)
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml

  # Filter by record ID
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --id 0D9B036E

  # Filter by any field value (partial, case-insensitive)
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --filter NAME=SyncTerms

  # Show specific columns only
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --cols NAME,JAVA_CLASS

  # Output raw JSON (for piping)
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --json

  # Compare two files by a shared key (e.g. find webhooks missing role access)
  python3 xml2json.py SMFWHE_DEFINEDWEBHOOK.xml --diff SMFWHE_DEFINEDWEBHOOK_ROLE.xml --key SMFWHE_DEFINEDWEBHOOK_ID

  # Auto-resolve path: if given just a filename, searches sourcedata/ dirs
  python3 xml2json.py AD_TABLE.xml --filter TABLENAME=smft
"""

import argparse
import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def find_sourcedata_file(filename):
    """Search for the file in known sourcedata directories."""
    if os.path.isfile(filename):
        return filename

    # Search from CWD upwards for modules/*/src-db/database/sourcedata/
    search_roots = [Path.cwd()]
    # Also check common Etendo locations
    for p in Path.cwd().parents:
        if (p / "modules").is_dir():
            search_roots.append(p)
            break

    for root in search_roots:
        for match in root.rglob(f"src-db/database/sourcedata/{filename}"):
            return str(match)

    return filename  # fall back to original


def parse_xml(filepath):
    """Parse Etendo sourcedata XML into list of dicts."""
    tree = ET.parse(filepath)
    root = tree.getroot()
    records = []
    for child in root:
        record = {}
        for field in child:
            record[field.tag] = (field.text or "").strip()
        if record:
            records.append(record)
    return records


def filter_records(records, filter_expr):
    """Filter records by field=value (case-insensitive, partial match)."""
    key, val = filter_expr.split("=", 1)
    key = key.upper()
    val = val.lower()
    return [r for r in records if val in r.get(key, "").lower()]


def filter_by_id(records, id_prefix):
    """Filter records whose primary key (first *_ID field) starts with id_prefix."""
    id_prefix = id_prefix.upper()
    result = []
    for r in records:
        for k, v in r.items():
            if k.endswith("_ID") and k == list(r.keys())[0]:
                if v.upper().startswith(id_prefix):
                    result.append(r)
                break
    return result


def select_cols(records, cols):
    """Keep only specified columns."""
    cols = [c.upper() for c in cols]
    return [{k: v for k, v in r.items() if k in cols} for r in records]


def print_table(records, max_col_width=50):
    """Print records as a compact aligned table."""
    if not records:
        print("(no records)")
        return

    all_keys = list(dict.fromkeys(k for r in records for k in r))

    # Calculate column widths
    widths = {}
    for k in all_keys:
        vals = [r.get(k, "") for r in records]
        widths[k] = min(max(len(k), max((len(v) for v in vals), default=0)), max_col_width)

    # Print header
    header = " | ".join(k.ljust(widths[k])[:widths[k]] for k in all_keys)
    print(header)
    print("-+-".join("-" * widths[k] for k in all_keys))

    # Print rows
    for r in records:
        row = " | ".join(r.get(k, "").ljust(widths[k])[:widths[k]] for k in all_keys)
        print(row)

    print(f"\n({len(records)} records)")


def diff_files(file1_records, file2_records, key):
    """Find records in file1 whose key value is NOT present in file2."""
    key = key.upper()
    file2_keys = {r.get(key, "") for r in file2_records}
    missing = [r for r in file1_records if r.get(key, "") not in file2_keys]
    # Also find the primary ID column
    return missing


def main():
    parser = argparse.ArgumentParser(description="Convert Etendo sourcedata XML to JSON/table")
    parser.add_argument("file", help="XML file (name or path)")
    parser.add_argument("--id", help="Filter by primary key prefix")
    parser.add_argument("--filter", help="Filter by FIELD=value (partial, case-insensitive)")
    parser.add_argument("--cols", help="Comma-separated column names to show")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    parser.add_argument("--diff", help="Second XML file — show records in FILE whose --key is missing in DIFF")
    parser.add_argument("--key", help="Column name for --diff comparison")
    parser.add_argument("--count", action="store_true", help="Just show record count")

    args = parser.parse_args()

    filepath = find_sourcedata_file(args.file)
    if not os.path.isfile(filepath):
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    records = parse_xml(filepath)

    # Diff mode
    if args.diff:
        if not args.key:
            print("Error: --diff requires --key", file=sys.stderr)
            sys.exit(1)
        diff_path = find_sourcedata_file(args.diff)
        if not os.path.isfile(diff_path):
            print(f"Error: diff file not found: {args.diff}", file=sys.stderr)
            sys.exit(1)
        file2_records = parse_xml(diff_path)
        records = diff_files(records, file2_records, args.key)

    # Apply filters
    if args.id:
        records = filter_by_id(records, args.id)
    if args.filter:
        records = filter_records(records, args.filter)
    if args.cols:
        records = select_cols(records, args.cols.split(","))

    # Output
    if args.count:
        print(len(records))
    elif args.json:
        print(json.dumps(records, indent=2))
    else:
        # Skip audit columns for compact display
        skip = {"AD_CLIENT_ID", "AD_ORG_ID", "ISACTIVE", "CREATED", "CREATEDBY",
                "UPDATED", "UPDATEDBY"}
        compact = [{k: v for k, v in r.items() if k not in skip} for r in records]
        print_table(compact)


if __name__ == "__main__":
    main()
