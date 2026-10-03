#!/usr/bin/env python3
"""
Скрипт для автоматического исправления отсутствующих await перед fetchone() и fetchall()
во всех Python файлах проекта.
"""

import re
from pathlib import Path


def fix_file(filepath: Path) -> bool:
    """Исправляет один файл. Возвращает True, если были изменения."""
    content = filepath.read_text(encoding='utf-8')
    original = content
    
    # Паттерн для поиска cur.fetchone() и cur.fetchall() без await
    # Ищем строки, где есть = cur.fetchone() или = cur.fetchall(), но нет await перед cur
    
    # Исправляем присваивания: row = cur.fetchone() -> row = await cur.fetchone()
    content = re.sub(
        r'(\s+)(\w+)\s*=\s*cur\.fetchone\(\)',
        r'\1\2 = await cur.fetchone()',
        content
    )
    
    content = re.sub(
        r'(\s+)(\w+)\s*=\s*cur\.fetchall\(\)',
        r'\1\2 = await cur.fetchall()',
        content
    )
    
    # Исправляем inline присваивания с индексацией: total = cur.fetchone()["cnt"]
    content = re.sub(
        r'(\s+)(\w+)\s*=\s*cur\.fetchone\(\)\[',
        r'\1\2 = (await cur.fetchone())[',
        content
    )
    
    # Исправляем условия: if cur.fetchone(): -> if await cur.fetchone():
    content = re.sub(
        r'(\s+)if\s+cur\.fetchone\(\):',
        r'\1if await cur.fetchone():',
        content
    )
    
    content = re.sub(
        r'(\s+)if\s+not\s+cur\.fetchone\(\):',
        r'\1if not await cur.fetchone():',
        content
    )
    
    # Исправляем for loops: for r in cur.fetchall(): -> for r in await cur.fetchall():
    content = re.sub(
        r'(\s+)for\s+(\w+)\s+in\s+cur\.fetchall\(\):',
        r'\1for \2 in await cur.fetchall():',
        content
    )
    
    # Исправляем set comprehensions: {r["id"] for r in cur.fetchall()}
    content = re.sub(
        r'for\s+(\w+)\s+in\s+cur\.fetchall\(\)',
        r'for \1 in await cur.fetchall()',
        content
    )
    
    # Исправляем dict comprehensions: {r["status"]: r["cnt"] for r in cur.fetchall()}
    # Уже покрыто предыдущим паттерном
    
    # Убираем дублирование await (если уже есть await await)
    content = re.sub(r'await\s+await\s+', 'await ', content)
    
    if content != original:
        filepath.write_text(content, encoding='utf-8')
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
