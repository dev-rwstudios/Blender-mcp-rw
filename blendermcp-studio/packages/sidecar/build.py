"""Run: python build.py"""
import PyInstaller.__main__
import sys

args = [
    "main.py",
    "--name=sidecar",
    "--onefile",
    "--hidden-import=litellm",
    "--hidden-import=mcp",
    "--hidden-import=fastapi",
    "--hidden-import=uvicorn",
    "--hidden-import=websockets",
    "--collect-all=litellm",
    "--collect-all=mcp",
    "--noconfirm",
    "--distpath=dist",
]

if sys.platform == "win32":
    args.append("--console")

PyInstaller.__main__.run(args)
