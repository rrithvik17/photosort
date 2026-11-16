import os
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
from ml_pipeline import analyze_image, cluster_images

def create_image(color, shape, offset=(0,0), filename="img.jpg"):
    img = Image.new('RGB', (400, 400), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    x1, y1 = 100 + offset[0], 100 + offset[1]
    x2, y2 = 300 + offset[0], 300 + offset[1]
    if shape == 'circle':
        draw.ellipse((x1, y1, x2, y2), fill=color)
    else:
        draw.rectangle((x1, y1, x2, y2), fill=color)
    img.save(filename)
    return filename

# Scenarios
filenames = []

# Scenario 1: Same person, same background, different pose (Red circle, slight shift)
filenames.append(create_image((200, 50, 50), 'circle', (0,0), "person1_pose1.jpg"))
filenames.append(create_image((200, 50, 50), 'circle', (10, -5), "person1_pose2.jpg")) # Slight shift
filenames.append(create_image((200, 50, 50), 'circle', (-5, 10), "person1_pose3.jpg")) # Different shift

# Scenario 2: Burst shots (almost identical)
filenames.append(create_image((50, 200, 50), 'rectangle', (0,0), "burst1.jpg"))
filenames.append(create_image((50, 200, 50), 'rectangle', (1,1), "burst2.jpg"))
filenames.append(create_image((50, 200, 50), 'rectangle', (2,2), "burst3.jpg"))

# Scenario 3: Different person/location (Blue square)
filenames.append(create_image((50, 50, 200), 'rectangle', (0,0), "person2_loc1.jpg"))

# Scenario 4: Same person as 2, different lighting (Darker green rectangle)
# Actually just draw a darker rectangle
filenames.append(create_image((30, 150, 30), 'rectangle', (0,0), "burst_dark_lighting.jpg"))

# Scenario 5: Truly unique photos (Yellow polygon/circle far away)
filenames.append(create_image((200, 200, 50), 'circle', (50, 50), "unique_yellow.jpg"))

features = {}
for f in filenames:
    features[f] = analyze_image(f)[0]

groups, uniques = cluster_images(features, eps=0.6)

print("--- CLUSTERING RESULTS ---")
for idx, group in enumerate(groups):
    print(f"Group {idx + 1}: {group}")

print(f"Unique Photos: {uniques}")

for f in filenames:
    os.remove(f)
