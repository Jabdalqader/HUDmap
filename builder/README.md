# builder/ (AI1, AI3)
Python scripts that download NASA data and write `web/mission/mission.json` + `web/mission/assets/`.
AI3 adds `panoramas.py` here for the VR panoramas.
Task: T1.1 (see the project board)

## panoramas.py (AI3): 360° Mars photos for the VR simulation
```bash
pip install numpy pillow
python3 builder/panoramas.py --stop 0 --sol 4596 --search 8
```
Downloads Curiosity's Navcam photos for that sol, lines them up, and writes `web/mission/assets/pano_stopN.jpg` + `.json`.
