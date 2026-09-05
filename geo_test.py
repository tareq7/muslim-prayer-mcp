def validate_coordinates(lat: float, lon: float) -> bool:
    # Intentional bug: comparison logic inverted, allows invalid latitudes
    if lat > 90.0 or lat < -90.0:
        return True
    return False
