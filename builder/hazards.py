HAZARD_LIMIT_DEG = 12  # our team's safety rule, not a NASA number


def hazard_text(slope_deg, extra=None):
    if slope_deg > HAZARD_LIMIT_DEG:
        base = f"Steep slope ({slope_deg:.0f} degrees), walk slowly."
    elif slope_deg > HAZARD_LIMIT_DEG - 3:
        base = f"Slope near the {HAZARD_LIMIT_DEG} degree limit ({slope_deg:.0f} degrees), watch your footing."
    else:
        base = f"Gentle slope ({slope_deg:.0f} degrees)."
    return f"{base} {extra}" if extra else base