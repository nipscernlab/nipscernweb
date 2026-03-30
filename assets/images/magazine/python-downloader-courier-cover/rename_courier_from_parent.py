import os
import re
from pathlib import Path

# ── 1. Parse & clean the dates ──────────────────────────────────────────────

raw_dates = """Jan/Feb 2013
Sep 2013
Jul/Aug 2013
Jun 2013
May 2013
Apr 2013
Mar 2013
Jan/Feb 2026
Nov/Dec 2025
Sep/Oct 2025
Jul/Aug 2025
May/Jun 2025
Mar/Apr 2025
Jan/Feb 2025
Nov/Dec 2024
Sep/Oct 2024
Jul/Aug 2024
May/Jun 2024
Mar/Apr 2024
Jan/Feb 2024
Nov/Dec 2023
Sep/Oct 2023
Jul/Aug 2023
May/Jun 2023
Mar/Apr 2023
Jan/Feb 2023
Nov/Dec 2022
Sep/Oct 2022
Jul/Aug 2022
May/Jun 2022
Mar/Apr 2022
Jan/Feb 2022
Nov/Dec 2021
Sep/Oct 2021
Jul/Aug 2021
May/Jun 2021
Mar/Apr 2021
Jan/Feb 2021
Nov/Dec 2020
Sep/Oct 2020
Jul/Aug 2020
May/Jun 2020
Mar/Apr 2020
Jan/Feb 2020
Nov/Dec 2019
Sep/Oct 2019
Jul/Aug 2019
May/Jun 2019
Mar/Apr 2019
Jan/Feb 2019
Dec 2018
Nov 2018
Oct 2018
Sep 2018
Jul/Aug 2018
Jun 2018
May 2018
Apr 2018
Mar 2018
Jan/Feb 2018
Dec 2017
Nov 2017
Oct 2017
Sep 2017
Jul/Aug 2017
Jun 2017
May 2017
Apr 2017
Mar 2017
Jan/Feb 2017
Dec 2016
Nov 2016
Oct 2016
Sep 2016
Jul/Aug 2016
Jun 2016
May 2016
Apr 2016
Mar 2016
Jan/Feb 2016
Dec 2015
Nov 2015
Oct 2015
Sep 2015
Jul/Aug 2015
Jun 2015
May 2015
Apr 2015
Mar 2015
Jan/Feb 2015
Dec 2014
Nov 2014
Oct 2014
Sep 2014
Jul/Aug 2014
Jun 2014
May 2014
Apr 2014
Mar 2014
Jan/Feb 2014
Dec 2013
Nov 2013
Oct 2013"""

MONTH_NUM = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4,
    "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
    "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
}

def parse_date(line):
    """Return (sort_key, filename_suffix) for a date string like 'Jan/Feb 2026'."""
    line = line.strip()
    # Split month part and year
    parts = line.rsplit(" ", 1)
    if len(parts) != 2:
        return None
    month_part, year_str = parts
    year = int(year_str)

    # Handle combined months (e.g. "Jan/Feb", "Jul/Aug")
    months = month_part.split("/")
    sort_month = MONTH_NUM[months[0]]          # sort by first month
    suffix = "".join(months)                   # "JanFeb", "Jul", etc.

    return (year, sort_month), f"CERNCourier{year}{suffix}.jpg"

# Parse, deduplicate, ignore non-date lines
seen = set()
dates = []
for line in raw_dates.strip().splitlines():
    line = line.strip()
    if not line or line == "CERN Courier":
        continue
    result = parse_date(line)
    if result is None:
        continue
    key, filename = result
    if filename not in seen:
        seen.add(filename)
        dates.append((key, filename))

# Sort most recent → oldest
dates.sort(key=lambda x: x[0], reverse=True)

print(f"Total date entries parsed: {len(dates)}")

# ── 2. Collect images from one level up ─────────────────────────────────────

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif"}

script_dir = Path(__file__).resolve().parent
parent_dir = script_dir.parent                 # one level up

image_files = sorted(
    p for p in parent_dir.iterdir()
    if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
)

print(f"Total images found in '{parent_dir}': {len(image_files)}")

# ── 3. Validate counts match ─────────────────────────────────────────────────

if len(image_files) != len(dates):
    print(
        f"\n⚠  Mismatch: {len(image_files)} images vs {len(dates)} dates.\n"
        "Aborting rename. Please check both lists."
    )
    raise SystemExit(1)

# ── 4. Preview ───────────────────────────────────────────────────────────────

print("\nPreview (first 10 renames):")
for img, (_, new_name) in list(zip(image_files, dates))[:10]:
    print(f"  {img.name:40s} → {new_name}")

confirm = input("\nProceed with renaming? [y/N]: ").strip().lower()
if confirm != "y":
    print("Aborted.")
    raise SystemExit(0)

# ── 5. Rename ────────────────────────────────────────────────────────────────

errors = []
for img_path, (_, new_name) in zip(image_files, dates):
    target = img_path.parent / new_name
    try:
        img_path.rename(target)
        print(f"  ✓ {img_path.name} → {new_name}")
    except Exception as e:
        errors.append((img_path.name, new_name, str(e)))
        print(f"  ✗ {img_path.name} → {new_name}  ERROR: {e}")

print(f"\nDone. {len(image_files) - len(errors)} renamed, {len(errors)} errors.")