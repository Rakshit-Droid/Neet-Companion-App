"""Write paste-ready versions of the three Firebase auth templates.

The source files carry explanatory comments and BODY markers so they document
themselves. What the console wants is only what sits between those markers, and
hunting for them in a browser text box is exactly where a stray line gets left
behind. These are the same bytes with nothing else in the file.
"""

import io
import os
import re

REPO = r"c:\Users\Raksh\Desktop\Projects\Neet Companion App"
OUT = os.path.join(REPO, "emails", "firebase-paste")

TEMPLATES = {
    "password-reset.html": "Reset your NEET Companion password",
    "sign-in-link.html": "Your NEET Companion sign-in link",
    "verify-email.html": "Confirm your email for NEET Companion",
}

os.makedirs(OUT, exist_ok=True)
index = ["# Paste these into Firebase\n"]
index.append(
    "Generated from the templates one directory up — do not edit these by hand,\n"
    "edit the source and re-run `python scripts/build-firebase-templates.py`.\n\n"
    "Console: Authentication -> Templates -> pick the template -> pencil icon.\n"
    "Paste the whole file into the message body. Set the subject to the one below.\n\n"
    "`%LINK%` must survive. It is the one-time URL; without it the email has\n"
    "nothing to click. Leave the password-reset action URL at its default.\n"
)

for name, subject in TEMPLATES.items():
    raw = io.open(os.path.join(REPO, "emails", name), encoding="utf-8").read()
    m = re.search(r"<!-- BODY -->\n(.*?)\n<!-- /BODY -->", raw, re.S)
    if not m:
        raise SystemExit(f"{name}: no BODY markers found")
    io.open(os.path.join(OUT, name), "w", encoding="utf-8").write(m.group(1) + "\n")
    index.append(f"\n## {name}\n\n**Subject:** `{subject}`\n")

io.open(os.path.join(OUT, "README.md"), "w", encoding="utf-8").write("".join(index))
print("wrote", OUT)
for name in TEMPLATES:
    p = os.path.join(OUT, name)
    print(f"  {name}  {os.path.getsize(p)} bytes")
