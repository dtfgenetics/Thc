from pathlib import Path

path = Path('scripts/package-public-suite-wordpress.py')
source = path.read_text()
old = '''        subprocess.run(["npm", "install", "--ignore-scripts"], cwd=checkout, check=True)
        subprocess.run(["npm", "test"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "build"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "validate:release"], cwd=checkout, check=True)
'''
new = '''        subprocess.run(["npm", "install", "--ignore-scripts"], cwd=checkout, check=True)
        subprocess.run(["npm", "test"], cwd=checkout, check=True)
        package_json_path = checkout / "package.json"
        package_json = json.loads(package_json_path.read_text()) if package_json_path.is_file() else {}
        package_scripts = package_json.get("scripts") if isinstance(package_json.get("scripts"), dict) else {}
        if "validate:ui" in package_scripts:
            subprocess.run(["npm", "run", "validate:ui"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "build"], cwd=checkout, check=True)
        subprocess.run(["npm", "run", "validate:release"], cwd=checkout, check=True)
'''
if old not in source:
    raise SystemExit('expected external game build sequence not found')
path.write_text(source.replace(old, new, 1))
print('Updated external game packager to run validate:ui when declared.')
