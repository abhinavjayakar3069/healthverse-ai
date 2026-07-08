#!/usr/bin/env python3
"""
Mobile consistency checker - catches the exact bug class found and fixed
several times this session: a screen destructuring a context field or
calling an api.client method that doesn't actually exist, or navigating to
an unregistered route. All three fail silently until someone taps the
right button on a real device - this catches them in about a second,
statically, every time.

Run with:  python3 check_consistency.py   (from the mobile/ directory)
"""
import re
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
issues = []

# --- AppContext usage ---
with open("src/context/AppContext.js") as f:
    ctx_source = f.read()
provider_match = re.search(r"<AppContext\.Provider\s+value=\{\{(.*?)\}\}", ctx_source, re.DOTALL)
provided_names = set()
for item in re.split(r"[,\n]", provider_match.group(1)):
    item = item.strip()
    if item:
        provided_names.add(item)

# --- api client exports ---
with open("src/api/client.js") as f:
    api_source = f.read()
api_methods = set(re.findall(r"^\s*(\w+):\s*(?:async\s*)?\(", api_source, re.MULTILINE))

# --- registered navigator routes ---
with open("src/navigation/RootNavigator.js") as f:
    nav_source = f.read()
registered_routes = set(re.findall(r'<\w+Stack\.Screen\s+name="([^"]+)"', nav_source))
registered_routes |= set(re.findall(r'<Tab\.Screen\s+name="([^"]+)"', nav_source))

# --- check every screen ---
for fname in sorted(os.listdir("src/screens")):
    path = f"src/screens/{fname}"
    with open(path) as f:
        src = f.read()

    destructure_match = re.search(r"const\s*\{([^}]+)\}\s*=\s*useApp\(\)", src)
    if destructure_match:
        for name in [x.strip() for x in destructure_match.group(1).split(",") if x.strip()]:
            if name not in provided_names:
                issues.append(f"{fname}: destructures '{name}' from useApp() but AppContext doesn't provide it")

    for call in set(re.findall(r"api\.(\w+)\(", src)):
        if call not in api_methods:
            issues.append(f"{fname}: calls api.{call}() but client.js doesn't export it")

    for target in re.findall(r"navigation\.navigate\(['\"]([^'\"]+)['\"]", src):
        if target not in registered_routes:
            issues.append(f"{fname}: navigates to '{target}' - not a registered route name")

# Screens that exist on purpose but aren't wired into navigation yet -
# real code with real activation steps documented (custom dev client +
# real third-party accounts needed), deliberately not silently orphaned.
# Add to this list only with a comment explaining why, right here.
INTENTIONALLY_DORMANT = {
    "DoctorVideoScreen",  # needs Daily.co account + custom dev client - see mobile/README.md
}

# --- every screen file is actually registered somewhere ---
screen_files = {f.replace(".js", "") for f in os.listdir("src/screens") if f.endswith(".js")}
imported_screens = set(re.findall(r"import (\w+Screen) from", nav_source))
orphaned = screen_files - imported_screens - INTENTIONALLY_DORMANT
if orphaned:
    issues.append(f"Screen file(s) exist but aren't imported in RootNavigator.js: {orphaned}")

if issues:
    print(f"FOUND {len(issues)} ISSUE(S):")
    for i in issues:
        print(" -", i)
    sys.exit(1)
else:
    print(f"Clean. Checked {len(os.listdir('src/screens'))} screens against "
          f"{len(provided_names)} context values, {len(api_methods)} api methods, "
          f"{len(registered_routes)} registered routes.")
