"""Driver mappings and transfers between seasons"""

# Driver transfers and team changes for 2024-2025
DRIVER_TRANSFERS = {
    2024: {
        # 2024 Grid
        "VER": {"name": "Max Verstappen", "team": "Red Bull Racing"},
        "PER": {"name": "Sergio Perez", "team": "Red Bull Racing"},
        "HAM": {"name": "Lewis Hamilton", "team": "Mercedes"},
        "RUS": {"name": "George Russell", "team": "Mercedes"},
        "LEC": {"name": "Charles Leclerc", "team": "Ferrari"},
        "SAI": {"name": "Carlos Sainz", "team": "Ferrari"},
        "NOR": {"name": "Lando Norris", "team": "McLaren"},
        "PIA": {"name": "Oscar Piastri", "team": "McLaren"},
        "ALO": {"name": "Fernando Alonso", "team": "Aston Martin"},
        "STR": {"name": "Lance Stroll", "team": "Aston Martin"},
        "OCO": {"name": "Esteban Ocon", "team": "Alpine"},
        "GAS": {"name": "Pierre Gasly", "team": "Alpine"},
        "BOT": {"name": "Valtteri Bottas", "team": "Alfa Romeo"},
        "ZHO": {"name": "Zhou Guanyu", "team": "Alfa Romeo"},
        "MAG": {"name": "Kevin Magnussen", "team": "Haas"},
        "HUL": {"name": "Nico Hulkenberg", "team": "Haas"},
        "TSU": {"name": "Yuki Tsunoda", "team": "AlphaTauri"},
        "RIC": {"name": "Daniel Ricciardo", "team": "AlphaTauri"},
        "ALB": {"name": "Alexander Albon", "team": "Williams"},
        "SAR": {"name": "Logan Sargeant", "team": "Williams"},
        # Mid-season changes
        "DEV": {"name": "Nyck de Vries", "team": "AlphaTauri"},
        "LAW": {"name": "Liam Lawson", "team": "AlphaTauri"},
    },
    2025: {
        # 2025 Grid (confirmed and rumored changes)
        "VER": {"name": "Max Verstappen", "team": "Red Bull Racing"},
        "PER": {"name": "Sergio Perez", "team": "Red Bull Racing"},
        "HAM": {"name": "Lewis Hamilton", "team": "Ferrari"},  # Moved from Mercedes
        "LEC": {"name": "Charles Leclerc", "team": "Ferrari"},
        "RUS": {"name": "George Russell", "team": "Mercedes"},
        "ANT": {"name": "Andrea Kimi Antonelli", "team": "Mercedes"},  # New to F1
        "NOR": {"name": "Lando Norris", "team": "McLaren"},
        "PIA": {"name": "Oscar Piastri", "team": "McLaren"},
        "ALO": {"name": "Fernando Alonso", "team": "Aston Martin"},
        "STR": {"name": "Lance Stroll", "team": "Aston Martin"},
        "GAS": {"name": "Pierre Gasly", "team": "Alpine"},
        "DOO": {"name": "Jack Doohan", "team": "Alpine"},  # New to F1
        "HUL": {"name": "Nico Hulkenberg", "team": "Sauber"},  # Moved from Haas
        "BOT": {"name": "Valtteri Bottas", "team": "Sauber"},
        "BEA": {"name": "Oliver Bearman", "team": "Haas"},  # New to F1
        "OCO": {"name": "Esteban Ocon", "team": "Haas"},  # Moved from Alpine
        "TSU": {"name": "Yuki Tsunoda", "team": "RB"},  # AlphaTauri renamed
        "HAD": {"name": "Isack Hadjar", "team": "RB"},  # New to F1
        "ALB": {"name": "Alexander Albon", "team": "Williams"},
        "SAI": {"name": "Carlos Sainz", "team": "Williams"},  # Moved from Ferrari
        "COL": {"name": "Franco Colapinto", "team": "Williams"},  # Mid-season 2024 addition
    }
}

def get_driver_info(code: str, season: int) -> dict:
    """Get driver information for a specific season"""
    if season in DRIVER_TRANSFERS and code in DRIVER_TRANSFERS[season]:
        return DRIVER_TRANSFERS[season][code]
    # Return basic info if not found
    return {"name": code, "team": "Unknown"}
