#!/usr/bin/env python3
"""
Скрипт для исправления отсутствующих await перед fetchone() и fetchall()
во всех файлах бэкенда.
"""

import re
from pathlib import Path

def fix_file(filepath: Path) -> bool:
    """Исправляет один файл. Возвращает True, если были изменения."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Паттерн: cur.fetchone() или cur.fetchall() без await перед ними
    # Ищем строки, где есть cur.fetchone() или cur.fetchall(), но нет await перед ними
    
    lines = content.split('\n')
    fixed_lines = []
    
    for line in lines:
        # Проверяем, есть ли в строке cur.fetchone() или cur.fetchall()
        if 'cur.fetchone()' in line or 'cur.fetchall()' in line:
            # Проверяем, есть ли уже await перед cur
            # Паттерн: что-то вроде "= cur.fetchone()" или "if cur.fetchone()"
            # Но НЕ "await cur.fetchone()"
            
            # Если строка содержит "await cur.fetchone()" или "await cur.fetchall()", пропускаем
            if 'await cur.fetchone()' in line or 'await cur.fetchall()' in line:
                fixed_lines.append(line)
                continue
            
            # Иначе добавляем await перед cur.fetchone() или cur.fetchall()
            line = line.replace('cur.fetchone()', 'await cur.fetchone()')
            line = line.replace('cur.fetchall()', 'await cur.fetchall()')
        
        fixed_lines.append(line)
    
    fixed_content = '\n'.join(fixed_lines)
    
    if fixed_content != original:
        filepath.write_text(fixed_content, encoding='utf-8')
        return True
    return False

def main():
    """Главная функция."""
    backend_dir = Path('backend/app')
    
    if not backend_dir.exists():
        print(f"❌ Директория {backend_dir} не найдена")
        return
    
    print("🔍 Поиск файлов с отсутствующими await...")
    
    fixed_files = []
    total_files = 0
    
    for py_file in backend_dir.rglob('*.py'):
        total_files += 1
        if fix_file(py_file):
            fixed_files.append(py_file)
            print(f"✅ Исправлен: {py_file}")
    
    print(f"\n📊 Статистика:")
    print(f"   Всего файлов проверено: {total_files}")
    print(f"   Исправлено файлов: {len(fixed_files)}")
    
    if fixed_files:
        print(f"\n✨ Готово! Все файлы исправлены.")
    else:
        print(f"\n✅ Все файлы уже корректны.")

if __name__ == '__main__':
    main()
