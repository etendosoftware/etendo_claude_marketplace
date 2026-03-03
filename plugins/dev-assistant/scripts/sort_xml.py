#!/usr/bin/env python3
"""
Sort Etendo sourcedata XML files by entity ID (UUID).

Usage:
    python3 sort_xml.py <file.xml> [file2.xml ...]
    python3 sort_xml.py src-db/database/sourcedata/AD_MESSAGE.xml
    python3 sort_xml.py src-db/database/sourcedata/*.xml

The script handles the Etendo XML comment-prefixed format:
    <!--UUID--><ENTITY_TAG>
    <!--UUID-->  <ENTITY_ID_FIELD><![CDATA[UUID]]></ENTITY_ID_FIELD>
    ...
    <!--UUID--></ENTITY_TAG>
"""

import re
import sys
from pathlib import Path


def sort_etendo_xml(filepath: str) -> tuple[bool, str]:
    """
    Sort the entries in an Etendo sourcedata XML file by UUID.

    Returns:
        (changed, message) — changed is True if file was modified.
    """
    path = Path(filepath)
    if not path.exists():
        return False, f"File not found: {filepath}"

    content = path.read_text(encoding="utf-8")

    # Detect header (<?xml ...?>\n<data>\n) and footer (</data>)
    header_match = re.match(r"(.*?<data>\n)", content, re.DOTALL)
    if not header_match:
        return False, f"Could not find <data> root element in {filepath}"
    header = header_match.group(1)

    footer_match = re.search(r"\n?</data>\s*$", content)
    if not footer_match:
        return False, f"Could not find </data> closing tag in {filepath}"
    footer = "\n</data>"

    # Detect the entity tag name (e.g. AD_MESSAGE, AD_COLUMN, AD_ELEMENT)
    entity_match = re.search(r"<!--[0-9A-Fa-f]+-->(<([A-Z_]+)>)", content)
    if not entity_match:
        return False, f"Could not detect entity tag in {filepath}"
    entity_tag = entity_match.group(2)

    # Split the body into individual entries.
    # Each entry starts with <!--UUID--><ENTITY_TAG> and ends with <!--UUID--></ENTITY_TAG>
    # We use a regex that captures full blocks including trailing newline.
    entry_pattern = re.compile(
        r"(<!--[0-9A-Fa-f]+--><%s>.*?<!--[0-9A-Fa-f]+--></%s>\n?)" % (entity_tag, entity_tag),
        re.DOTALL,
    )

    entries = entry_pattern.findall(content)
    if not entries:
        return False, f"No <{entity_tag}> entries found in {filepath}"

    # Extract the leading UUID from each entry for sorting
    id_pattern = re.compile(r"^<!--([0-9A-Fa-f]+)-->")

    def get_uuid(entry: str) -> str:
        m = id_pattern.match(entry)
        return m.group(1).upper() if m else ""

    sorted_entries = sorted(entries, key=get_uuid)

    # Check if already sorted
    if entries == sorted_entries:
        return False, f"Already sorted: {filepath}"

    # Reconstruct file: header + blank line + entries (each separated by blank line) + footer
    body_parts = []
    for entry in sorted_entries:
        # Normalize: ensure entry ends with exactly one newline
        body_parts.append(entry.rstrip("\n") + "\n")

    new_body = "\n".join(body_parts)
    new_content = header + "\n" + new_body + footer + "\n"

    path.write_text(new_content, encoding="utf-8")
    return True, f"Sorted {len(entries)} entries in {filepath}"


def main():
    if len(sys.argv) < 2:
        print("Usage: sort_xml.py <file.xml> [file2.xml ...]")
        sys.exit(1)

    files = sys.argv[1:]
    any_error = False

    for filepath in files:
        changed, message = sort_etendo_xml(filepath)
        status = "✓" if changed else ("=" if "Already sorted" in message else "✗")
        print(f"  [{status}] {message}")
        if "not found" in message or "Could not" in message:
            any_error = True

    sys.exit(1 if any_error else 0)


if __name__ == "__main__":
    main()
