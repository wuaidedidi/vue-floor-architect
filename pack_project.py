"""
项目打包脚本
将项目打包成 item.zip，排除不需要的文件和目录
"""
import zipfile
import os
from pathlib import Path

# 项目根目录
PROJECT_DIR = Path(__file__).parent
OUTPUT_FILE = PROJECT_DIR / "item.zip"

# 需要排除的文件和目录
EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    ".vscode",
    ".playwright-mcp",
    "venv",
    "__pycache__",
    ".idea",
    "dist",
    ".gemini",
}

EXCLUDE_FILES = {
    "result.md",
    "ErrorRule.md",
    "package-lock.json",
    "pack_project.py",
    "item.zip",
    ".gitignore",
    ".DS_Store",
    "Thumbs.db",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".log",
}


def should_exclude(path: Path, root: Path) -> bool:
    """判断文件或目录是否应该被排除"""
    rel_path = path.relative_to(root)
    
    # 检查目录名
    for part in rel_path.parts:
        if part in EXCLUDE_DIRS:
            return True
    
    # 检查文件名
    if path.is_file():
        if path.name in EXCLUDE_FILES:
            return True
        if path.suffix in EXCLUDE_EXTENSIONS:
            return True
    
    return False


def pack_project():
    """打包项目"""
    print(f"开始打包项目: {PROJECT_DIR}")
    print(f"输出文件: {OUTPUT_FILE}")
    
    # 如果已存在则删除
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()
        print("已删除旧的 item.zip")
    
    file_count = 0
    
    with zipfile.ZipFile(OUTPUT_FILE, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PROJECT_DIR):
            root_path = Path(root)
            
            # 过滤目录（修改 dirs 列表以跳过排除的目录）
            dirs[:] = [d for d in dirs if not should_exclude(root_path / d, PROJECT_DIR)]
            
            for file in files:
                file_path = root_path / file
                
                if should_exclude(file_path, PROJECT_DIR):
                    continue
                
                # 计算相对路径
                arcname = file_path.relative_to(PROJECT_DIR)
                zipf.write(file_path, arcname)
                file_count += 1
                print(f"  添加: {arcname}")
    
    # 获取文件大小
    size_kb = OUTPUT_FILE.stat().st_size / 1024
    
    print(f"\n✅ 打包完成!")
    print(f"   文件数量: {file_count}")
    print(f"   压缩包大小: {size_kb:.1f} KB")
    print(f"   输出路径: {OUTPUT_FILE}")


if __name__ == "__main__":
    pack_project()
