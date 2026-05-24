"""
filter_words.py
---------------
Filters a word list against two conditions:
  1. All characters of the word belong to set A (allowed characters).
  2. The word contains at least one character from set B (required characters).

Usage:
    python filter_words.py <wordlist.csv> <filters.txt> [output.xml]

Filter file format (one pair per line):
    # Lines starting with # are comments
    # Each active line: "A_chars | B_chars"  (spaces are ignored)
"""

import csv
import sys
import os
import random
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


# ── Core filter function ──────────────────────────────────────────────────────

def filter_words(A: set, B: set, words: list[str]) -> list[str]:
    """
    Return words satisfying:
      1. Every character is in A  (word ⊆ A)
      2. At least one character is in B  (word ∩ B ≠ ∅)
    """
    result = []
    for word in words:
        chars = set(word)
        if chars <= A and chars & B:
            result.append(word)
    return result


# ── Pseudo-word generator ─────────────────────────────────────────────────────

VOWELS = set("aeiouyéèêëàâùûôîï")

def generate_pseudo_words(A: set, B: set, count: int = 60, seed: int = 0) -> list[str]:
    """
    Generate pronounceable pseudo-words using only characters from A,
    guaranteed to contain at least one character from B.
    Uses a deterministic seed so output is reproducible.
    """
    rng    = random.Random(seed)
    A_list = sorted(A)
    B_list = sorted(B)
    vowels = sorted(A & VOWELS)
    cons   = sorted(A - VOWELS)

    result  = set()
    attempt = 0
    while len(result) < count and attempt < 200_000:
        attempt += 1
        length = rng.randint(3, min(6, max(3, len(A_list))))
        word   = []
        has_b  = False

        for pos in range(length):
            # Alternate consonants / vowels when both exist
            if vowels and cons:
                pool = vowels if pos % 2 == 1 else cons
            else:
                pool = A_list

            # On the last character, force a B char if none seen yet
            if pos == length - 1 and not has_b:
                b_pool = [c for c in pool if c in B]
                if not b_pool:
                    b_pool = B_list          # fall back to any B char
                pool = b_pool

            c = rng.choice(pool)
            if c in B:
                has_b = True
            word.append(c)

        w = "".join(word)
        if has_b and len(set(w)) >= 2:
            result.add(w)

    return sorted(result)


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_csv(path: str) -> list[str]:
    """Read a word CSV; returns deduplicated words sorted by frequency rank."""
    words = []
    seen  = set()
    with open(path, encoding="utf-8", newline="") as f:
        reader   = csv.DictReader(f)
        col      = "word_fr" if "word_fr" in reader.fieldnames else reader.fieldnames[1]
        rank_col = "rank"    if "rank"    in reader.fieldnames else None
        rows     = list(reader)
        if rank_col:
            rows.sort(key=lambda r: int(r[rank_col]))
        for row in rows:
            w = row[col].strip().lower()
            if w and w not in seen:
                seen.add(w)
                words.append(w)
    return words


def parse_filters(path: str) -> list[tuple[set, set, str]]:
    """
    Read the filter file.  Format per active line:  A_chars | B_chars
    Returns list of (A, B, original_line).
    """
    filters = []
    with open(path, encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "|" not in line:
                print(f"[WARNING] Line {lineno} skipped (no '|'): {raw.rstrip()}", file=sys.stderr)
                continue
            left, right = line.split("|", 1)
            A = set(left.replace(" ", ""))
            B = set(right.replace(" ", ""))
            if not A:
                print(f"[WARNING] Line {lineno}: empty A, skipped.", file=sys.stderr)
                continue
            if not B:
                print(f"[WARNING] Line {lineno}: empty B, skipped.", file=sys.stderr)
                continue
            filters.append((A, B, line.strip()))
    return filters


# ── XML builder ───────────────────────────────────────────────────────────────

def _chars_attr(s: set) -> str:
    """Space-separated sorted characters."""
    return " ".join(sorted(s))

def _level_name(idx: int, B: set) -> str:
    """Human-readable level label derived from new keys (B set)."""
    keys = " · ".join(sorted(B))
    return keys if idx == 1 else f"+ {keys}"

def _min_score_pct(idx: int, total: int) -> float:
    """Linearly scale min score from 0.38 (first level) to 0.60 (last)."""
    if total <= 1:
        return 0.50
    return round(0.38 + (idx - 1) * (0.22 / (total - 1)), 2)


def build_xml(
    wordlist_path: str,
    filters_path:  str,
    filter_defs:   list[tuple[set, set, str]],
    words:         list[str],
) -> ET.Element:
    total = len(filter_defs)
    root  = ET.Element("word_filter_results")
    root.set("generated_at",        datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    root.set("wordlist_source",     os.path.basename(wordlist_path))
    root.set("filter_source",       os.path.basename(filters_path))
    root.set("total_words_loaded",  str(len(words)))
    root.set("total_levels",        str(total))

    for idx, (A, B, definition) in enumerate(filter_defs, 1):
        matched = filter_words(A, B, words)
        pseudo  = generate_pseudo_words(A, B, count=60, seed=idx)

        f_el = ET.SubElement(root, "filter")
        f_el.set("index",         str(idx))
        f_el.set("definition",    definition)
        f_el.set("level_name",    _level_name(idx, B))
        f_el.set("min_score_pct", str(_min_score_pct(idx, total)))
        f_el.set("mission_size",  "8")

        ET.SubElement(f_el, "allowed_chars").text  = _chars_attr(A)
        ET.SubElement(f_el, "required_chars").text = _chars_attr(B)

        matches_el = ET.SubElement(f_el, "matches")
        matches_el.set("count", str(len(matched)))
        for word in matched:
            ET.SubElement(matches_el, "word").text = word

        pseudo_el = ET.SubElement(f_el, "pseudo_words")
        pseudo_el.set("count", str(len(pseudo)))
        for word in pseudo:
            ET.SubElement(pseudo_el, "word").text = word

    return root


def write_xml(root: ET.Element, path: str) -> str:
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    header = '<?xml version="1.0" encoding="UTF-8"?>\n'
    if path:
        with open(path, "w", encoding="utf-8") as f:
            f.write(header)
            tree.write(f, encoding="unicode", xml_declaration=False)
        return path
    else:
        import io
        buf = io.StringIO()
        buf.write(header)
        tree.write(buf, encoding="unicode", xml_declaration=False)
        return buf.getvalue()


# ── Entry point ───────────────────────────────────────────────────────────────

def run(wordlist_path: str, filters_path: str, output_path: str):
    print(f"Loading word list : {wordlist_path}",  file=sys.stderr)
    words = parse_csv(wordlist_path)
    print(f"  → {len(words)} words loaded",        file=sys.stderr)

    print(f"Loading filters   : {filters_path}",   file=sys.stderr)
    filter_defs = parse_filters(filters_path)
    print(f"  → {len(filter_defs)} filter(s)",     file=sys.stderr)

    root   = build_xml(wordlist_path, filters_path, filter_defs, words)
    result = write_xml(root, output_path)

    if output_path:
        print(f"Output written to : {output_path}", file=sys.stderr)
    else:
        print(result)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        print("Usage: python filter_words.py <wordlist.csv> <filters.txt> [output.xml]")
        sys.exit(1)

    wordlist = sys.argv[1]
    filters  = sys.argv[2]
    output   = sys.argv[3] if len(sys.argv) >= 4 else None

    for path in (wordlist, filters):
        if not os.path.exists(path):
            print(f"Error: file not found → {path}", file=sys.stderr)
            sys.exit(1)

    run(wordlist, filters, output)
