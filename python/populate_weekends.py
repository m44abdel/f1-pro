"""
Script to populate all F1 Grand Prix weekends for 2024 and 2025 seasons
"""
import psycopg
import os
from datetime import date

# Get database URL from environment
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set")

# 2024 F1 Calendar (24 races)
WEEKENDS_2024 = [
    {"round": 1, "name": "Bahrain Grand Prix", "circuit": "Sakhir", "date": date(2024, 3, 2)},
    {"round": 2, "name": "Saudi Arabian Grand Prix", "circuit": "Jeddah", "date": date(2024, 3, 9)},
    {"round": 3, "name": "Australian Grand Prix", "circuit": "Melbourne", "date": date(2024, 3, 24)},
    {"round": 4, "name": "Japanese Grand Prix", "circuit": "Suzuka", "date": date(2024, 4, 7)},
    {"round": 5, "name": "Chinese Grand Prix", "circuit": "Shanghai", "date": date(2024, 4, 21)},
    {"round": 6, "name": "Miami Grand Prix", "circuit": "Miami", "date": date(2024, 5, 5)},
    {"round": 7, "name": "Emilia Romagna Grand Prix", "circuit": "Imola", "date": date(2024, 5, 19)},
    {"round": 8, "name": "Monaco Grand Prix", "circuit": "Monaco", "date": date(2024, 5, 26)},
    {"round": 9, "name": "Canadian Grand Prix", "circuit": "Montreal", "date": date(2024, 6, 9)},
    {"round": 10, "name": "Spanish Grand Prix", "circuit": "Barcelona", "date": date(2024, 6, 23)},
    {"round": 11, "name": "Austrian Grand Prix", "circuit": "Spielberg", "date": date(2024, 6, 30)},
    {"round": 12, "name": "British Grand Prix", "circuit": "Silverstone", "date": date(2024, 7, 7)},
    {"round": 13, "name": "Hungarian Grand Prix", "circuit": "Budapest", "date": date(2024, 7, 21)},
    {"round": 14, "name": "Belgian Grand Prix", "circuit": "Spa-Francorchamps", "date": date(2024, 7, 28)},
    {"round": 15, "name": "Dutch Grand Prix", "circuit": "Zandvoort", "date": date(2024, 8, 25)},
    {"round": 16, "name": "Italian Grand Prix", "circuit": "Monza", "date": date(2024, 9, 1)},
    {"round": 17, "name": "Azerbaijan Grand Prix", "circuit": "Baku", "date": date(2024, 9, 15)},
    {"round": 18, "name": "Singapore Grand Prix", "circuit": "Marina Bay", "date": date(2024, 9, 22)},
    {"round": 19, "name": "United States Grand Prix", "circuit": "Austin", "date": date(2024, 10, 20)},
    {"round": 20, "name": "Mexico City Grand Prix", "circuit": "Mexico City", "date": date(2024, 10, 27)},
    {"round": 21, "name": "São Paulo Grand Prix", "circuit": "Interlagos", "date": date(2024, 11, 3)},
    {"round": 22, "name": "Las Vegas Grand Prix", "circuit": "Las Vegas", "date": date(2024, 11, 23)},
    {"round": 23, "name": "Qatar Grand Prix", "circuit": "Lusail", "date": date(2024, 12, 1)},
    {"round": 24, "name": "Abu Dhabi Grand Prix", "circuit": "Yas Marina", "date": date(2024, 12, 8)},
]

# 2025 F1 Calendar (24 races) - Provisional
WEEKENDS_2025 = [
    {"round": 1, "name": "Australian Grand Prix", "circuit": "Melbourne", "date": date(2025, 3, 16)},
    {"round": 2, "name": "Chinese Grand Prix", "circuit": "Shanghai", "date": date(2025, 3, 23)},
    {"round": 3, "name": "Japanese Grand Prix", "circuit": "Suzuka", "date": date(2025, 4, 6)},
    {"round": 4, "name": "Bahrain Grand Prix", "circuit": "Sakhir", "date": date(2025, 4, 13)},
    {"round": 5, "name": "Saudi Arabian Grand Prix", "circuit": "Jeddah", "date": date(2025, 4, 20)},
    {"round": 6, "name": "Miami Grand Prix", "circuit": "Miami", "date": date(2025, 5, 4)},
    {"round": 7, "name": "Emilia Romagna Grand Prix", "circuit": "Imola", "date": date(2025, 5, 18)},
    {"round": 8, "name": "Monaco Grand Prix", "circuit": "Monaco", "date": date(2025, 5, 25)},
    {"round": 9, "name": "Spanish Grand Prix", "circuit": "Barcelona", "date": date(2025, 6, 1)},
    {"round": 10, "name": "Canadian Grand Prix", "circuit": "Montreal", "date": date(2025, 6, 15)},
    {"round": 11, "name": "Austrian Grand Prix", "circuit": "Spielberg", "date": date(2025, 6, 29)},
    {"round": 12, "name": "British Grand Prix", "circuit": "Silverstone", "date": date(2025, 7, 6)},
    {"round": 13, "name": "Belgian Grand Prix", "circuit": "Spa-Francorchamps", "date": date(2025, 7, 27)},
    {"round": 14, "name": "Hungarian Grand Prix", "circuit": "Budapest", "date": date(2025, 8, 3)},
    {"round": 15, "name": "Dutch Grand Prix", "circuit": "Zandvoort", "date": date(2025, 8, 31)},
    {"round": 16, "name": "Italian Grand Prix", "circuit": "Monza", "date": date(2025, 9, 7)},
    {"round": 17, "name": "Azerbaijan Grand Prix", "circuit": "Baku", "date": date(2025, 9, 21)},
    {"round": 18, "name": "Singapore Grand Prix", "circuit": "Marina Bay", "date": date(2025, 10, 5)},
    {"round": 19, "name": "United States Grand Prix", "circuit": "Austin", "date": date(2025, 10, 19)},
    {"round": 20, "name": "Mexico City Grand Prix", "circuit": "Mexico City", "date": date(2025, 10, 26)},
    {"round": 21, "name": "São Paulo Grand Prix", "circuit": "Interlagos", "date": date(2025, 11, 9)},
    {"round": 22, "name": "Las Vegas Grand Prix", "circuit": "Las Vegas", "date": date(2025, 11, 22)},
    {"round": 23, "name": "Qatar Grand Prix", "circuit": "Lusail", "date": date(2025, 11, 30)},
    {"round": 24, "name": "Abu Dhabi Grand Prix", "circuit": "Yas Marina", "date": date(2025, 12, 7)},
]

def insert_weekends(conn, season, weekends):
    """Insert weekends for a season"""
    with conn.cursor() as cur:
        inserted = 0
        skipped = 0
        
        for weekend in weekends:
            try:
                cur.execute("""
                    INSERT INTO weekends (season, round, name, circuit, date)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (season, round) DO NOTHING
                    RETURNING id
                """, (season, weekend["round"], weekend["name"], weekend["circuit"], weekend["date"]))
                
                if cur.fetchone():
                    inserted += 1
                    print(f"✓ Added: Round {weekend['round']} - {weekend['name']}")
                else:
                    skipped += 1
                    print(f"- Skipped: Round {weekend['round']} - {weekend['name']} (already exists)")
                    
            except Exception as e:
                print(f"✗ Error adding {weekend['name']}: {e}")
                conn.rollback()
                raise
        
        conn.commit()
        print(f"\n{season} Season: {inserted} added, {skipped} skipped")
        return inserted, skipped

def main():
    """Main function to populate all weekends"""
    print("Populating F1 Grand Prix weekends...")
    print("=" * 60)
    
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            # Check current state
            with conn.cursor() as cur:
                cur.execute("SELECT season, COUNT(*) FROM weekends GROUP BY season ORDER BY season")
                current = dict(cur.fetchall())
                
            print("Current database state:")
            for season, count in current.items():
                print(f"  {season}: {count} races")
            print()
            
            # Insert 2024 weekends
            print("Adding 2024 weekends...")
            insert_weekends(conn, 2024, WEEKENDS_2024)
            
            # Insert 2025 weekends
            print("\nAdding 2025 weekends...")
            insert_weekends(conn, 2025, WEEKENDS_2025)
            
            # Show final state
            print("\n" + "=" * 60)
            with conn.cursor() as cur:
                cur.execute("SELECT season, COUNT(*) FROM weekends GROUP BY season ORDER BY season")
                final = dict(cur.fetchall())
                
            print("Final database state:")
            for season, count in final.items():
                print(f"  {season}: {count} races")
                
    except Exception as e:
        print(f"\nError: {e}")
        return 1
    
    print("\nWeekend population complete!")
    return 0

if __name__ == "__main__":
    exit(main())
