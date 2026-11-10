import shutil
import os

SRC = "photo_candidates/all"
DST = "../web/mission/assets"
os.makedirs(DST, exist_ok=True)

# stop id -> frame number from the contact sheet
PICKS = {0: 13, 1: 12, 2: 13, 3: 11, 4: 8, 5: 9}

for stop_id, n in PICKS.items():
    shutil.copy(f"{SRC}/stop{stop_id}_{n}.jpg", f"{DST}/stop{stop_id}.jpg")
    print(f"stop{stop_id}.jpg  <-  stop{stop_id}_{n}.jpg")