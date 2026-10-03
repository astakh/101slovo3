#!/usr/bin/env python3
"""
Скрипт для замены всех захардкоженных localhost:8000 на использование переменной окружения
"""

import re
from pathlib import Path

def fix_file(filepath: Path) -> bool:
    """Исправляет один файл. Возвращает True, если были изменения."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Заменяем 'http://localhost:8000' на `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}`
    # Но только если это не уже заменено
    content = re.sub(
        r"'http://localhost:8000(/[^']*)'",
        r"`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}\1`",
        content
    )
    
    # Заменяем `http://localhost:8000` на `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}`
    content = re.sub(
        r'`http://localhost:8000(/[^`]*)`',
        r'`${import.meta.env.VITE_API_URL || \'http://localhost:8000\'}\1`',
        content
    )
    
    if content != original:
        filepath.write_text(content, encoding='utf-8')
        return True
    return False

def main():
    """Главная функция."""
    src_dir = Path('src')
    
    if not src_dir.exists():
        print(f"❌ Директория {src_dir} не найдена")
        return
    
    print("🔍 Поиск файлов с захардкоженными URL...")
    
    fixed_files = []
    total_files = 0
    
    for tsx_file in src_dir.rglob('*.tsx'):
        total_files += 1
        if fix_file(tsx_file):
            fixed_files.append(tsx_file)
            print(f"✅ Исправлен: {tsx_file}")
    
    for ts_file in src_dir.rglob('*.ts'):
        total_files += 1
        if fix_file(ts_file):
            fixed_files.append(ts_file)
            print(f"✅ Исправлен: {ts_file}")
    
    print(f"\n📊 Статистика:")
    print(f"   Всего файлов проверено: {total_files}")
    print(f"   Исправлено файлов: {len(fixed_files)}")
    
    if fixed_files:
        print(f"\n✨ Готово! Все файлы исправлены.")
    else:
        print(f"\n✅ Все файлы уже корректны.")

if __name__ == '__main__':
    main()
