"""
101slovo — Скрипт применения миграции базы данных.

Использование:
    cd backend
    python apply_migration.py

Или с явным указанием пути:
    python backend/apply_migration.py
"""

import sys
from pathlib import Path

import psycopg
from psycopg import errors

# Добавляем путь к app для импорта config
sys.path.insert(0, str(Path(__file__).parent))

from app.config import settings


def apply_migration():
    """
    Применяет миграцию 001_init.sql к базе данных.
    
    Raises:
        FileNotFoundError: Если файл миграции не найден
        psycopg.Error: Если ошибка выполнения SQL
    """
    # Путь к файлу миграции
    migration_file = Path(__file__).parent.parent / "sql" / "001_init.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл миграции не найден: {migration_file}")
        print(f"   Ожидался путь: {migration_file.absolute()}")
        sys.exit(1)
    
    print(f"📄 Чтение файла миграции: {migration_file}")
    
    # Чтение SQL файла
    try:
        with open(migration_file, "r", encoding="utf-8") as f:
            sql_content = f.read()
    except Exception as e:
        print(f"❌ Ошибка чтения файла: {e}")
        sys.exit(1)
    
    print(f"✅ Файл прочитан ({len(sql_content)} символов)")
    
    # Маскируем пароль для вывода
    display_url = settings.DATABASE_URL
    if "@" in display_url:
        parts = display_url.split("@")
        userinfo = parts[0].rsplit("//", 1)[-1]
        if ":" in userinfo:
            user, _ = userinfo.split(":", 1)
            display_url = display_url.replace(userinfo, f"{user}:***")
    
    print(f"🔗 Подключение к базе данных: {display_url.split('@')[1] if '@' in display_url else '***'}")
    
    # Применение миграции
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            print("✅ Подключение установлено")
            
            # Проверка, не применена ли уже миграция
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT version FROM schema_migrations WHERE version = '001_init'")
                    if cur.fetchone():
                        print("⚠️  Миграция 001_init уже применена")
                        response = input("   Применить повторно? (y/N): ")
                        if response.lower() != 'y':
                            print("❌ Отменено")
                            sys.exit(0)
            except errors.UndefinedTable:
                # Таблица schema_migrations ещё не существует - это нормально
                pass
            
            print("🚀 Применение миграции...")
            
            with conn.cursor() as cur:
                cur.execute(sql_content)
            
            conn.commit()
            
            print("✅ Миграция успешно применена!")
            
            # Проверка результата
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM schema_migrations")
                migrations_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
                tables_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM prompts")
                prompts_count = cur.fetchone()[0]
            
            print(f"\n📊 Статистика:")
            print(f"   • Применено миграций: {migrations_count}")
            print(f"   • Таблиц в базе данных: {tables_count}")
            print(f"   • Промптов LLM: {prompts_count}")
            
    except psycopg.OperationalError as e:
        print(f"\n❌ Ошибка подключения к базе данных:")
        print(f"   {e}")
        print(f"\n💡 Проверьте:")
        print(f"   • DATABASE_URL в файле .env")
        print(f"   • Доступность сервера PostgreSQL")
        print(f"   • Правильность логина и пароля")
        print(f"   • Существует ли база данных")
        sys.exit(1)
        
    except psycopg.Error as e:
        print(f"\n❌ Ошибка выполнения SQL:")
        print(f"   {e}")
        print(f"\n💡 Возможные причины:")
        print(f"   • Ошибка в SQL файле")
        print(f"   • Недостаточно прав у пользователя")
        print(f"   • Конфликт с существующими таблицами")
        sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Непредвиденная ошибка: {e}")
        sys.exit(1)


def create_general_dictionary():
    """
    Создаёт словарь 'general' если он не существует.
    """
    print("\n📚 Проверка словаря 'general'...")
    
    try:
        with psycopg.connect(settings.DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # Проверка существования
                cur.execute("SELECT id FROM dictionaries WHERE code = 'general'")
                if cur.fetchone():
                    print("✅ Словарь 'general' уже существует")
                    return
                
                # Создание словаря
                cur.execute(
                    """INSERT INTO dictionaries (code, name, description) 
                       VALUES ('general', 'General English', 'Общий словарь английских слов')"""
                )
                conn.commit()
                print("✅ Словарь 'general' создан")
                
    except psycopg.Error as e:
        print(f"⚠️  Не удалось создать словарь: {e}")
        print("   Вы можете создать его вручную:")
        print("   INSERT INTO dictionaries (code, name, description)")
        print("   VALUES ('general', 'General English', 'Общий словарь английских слов');")


def main():
    """Главная функция."""
    print("=" * 60)
    print("🎯 101slovo — Применение миграции базы данных")
    print("=" * 60)
    print()
    
    apply_migration()
    create_general_dictionary()
    
    print()
    print("=" * 60)
    print("🎉 Готово! База данных настроена.")
    print("=" * 60)
    print()
    print("Следующие шаги:")
    print("1. Запустите backend: uvicorn app.main:app --reload")
    print("2. Откройте Swagger UI: http://localhost:8000/docs")
    print("3. Зарегистрируйте пользователя через POST /auth/register")
    print()


if __name__ == "__main__":
    main()
