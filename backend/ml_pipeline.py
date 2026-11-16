import cv2
import numpy as np
from PIL import Image
import torch
import torchvision.models as models
import torchvision.transforms as transforms
import torchvision.transforms.functional as F
from torchvision.models.detection import ssdlite320_mobilenet_v3_large, SSDLite320_MobileNet_V3_Large_Weights
from sklearn.cluster import AgglomerativeClustering
import os

# Initialize MobileNetV3 for feature extraction
model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
model.eval()

# Initialize SSDLite for person detection (Primary Subject)
ssd_weights = SSDLite320_MobileNet_V3_Large_Weights.DEFAULT
detector = ssdlite320_mobilenet_v3_large(weights=ssd_weights)
detector.eval()

preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def generate_thumbnail(image_path: str, output_path: str, size: tuple = (400, 400)):
    """Generate a lightweight thumbnail to be used by the frontend and CV pipeline."""
    try:
        with Image.open(image_path) as img:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img.thumbnail(size)
            img.save(output_path, format="JPEG", quality=85)
            return True
    except Exception as e:
        print(f"Error generating thumbnail for {image_path}: {e}")
        return False

def extract_embedding(img: Image.Image) -> np.ndarray:
    """Extract a normalized semantic vector for a given image/crop."""
    input_tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        x = model.features(input_tensor)
        x = torch.nn.functional.adaptive_avg_pool2d(x, (1, 1))
        x = torch.flatten(x, 1)
    vec = x.squeeze().numpy()
    norm = np.linalg.norm(vec)
    return vec / norm if norm > 0 else vec

def extract_identity_histogram(img: Image.Image) -> np.ndarray:
    """Extract a 2D HSV Color Histogram from the person crop to act as an Identity Signature."""
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2HSV)
    # Use 8 bins for Hue and 8 bins for Saturation. Ignore Value (brightness) to be lighting invariant.
    hist = cv2.calcHist([img_cv], [0, 1], None, [8, 8], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    hist_vec = hist.flatten()
    norm = np.linalg.norm(hist_vec)
    return hist_vec / norm if norm > 0 else hist_vec

def compute_blur(img: Image.Image) -> float:
    """Compute Variance of Laplacian for blur detection."""
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
    img_blurred = cv2.GaussianBlur(img_cv, (3, 3), 0)
    return float(cv2.Laplacian(img_blurred, cv2.CV_64F).var())

def analyze_image(image_path: str) -> tuple:
    """
    Perform subject-aware feature extraction, person identity matching, and localized blur detection.
    Returns (feature_vector, quality_category_string).
    """
    try:
        with Image.open(image_path) as img:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
            if img.mode != 'RGB':
                img = img.convert('RGB')
                
            # 1. Subject Detection
            tensor = F.to_tensor(img).unsqueeze(0)
            with torch.no_grad():
                prediction = detector(tensor)[0]
                
            # COCO class 1 is person
            boxes = prediction['boxes']
            scores = prediction['scores']
            labels = prediction['labels']
            
            person_indices = (labels == 1) & (scores > 0.5)
            person_boxes = boxes[person_indices]
            
            person_crop = None
            if len(person_boxes) > 0:
                # Find largest person box
                areas = (person_boxes[:, 2] - person_boxes[:, 0]) * (person_boxes[:, 3] - person_boxes[:, 1])
                largest_idx = torch.argmax(areas)
                best_box = person_boxes[largest_idx].numpy().astype(int)
                person_crop = img.crop((best_box[0], best_box[1], best_box[2], best_box[3]))

            # 2. Extract Embeddings (Identity-Aware)
            full_emb = extract_embedding(img)
            
            if person_crop is not None:
                person_emb = extract_embedding(person_crop)
                person_hist = extract_identity_histogram(person_crop)
                
                # Heavily weight the Person Identity (Histogram) so different people are separated.
                # Concatenate: [Person Identity (x2.0), Person Semantic (x1.0), Background Semantic (x1.0)]
                combined = np.concatenate([person_hist * 2.0, person_emb, full_emb])
            else:
                # No person. Pad with zeros so vectors match shape for clustering.
                dummy_hist = np.zeros(64) # 8x8 bins
                dummy_emb = np.zeros_like(full_emb)
                combined = np.concatenate([dummy_hist, dummy_emb, full_emb])
                
            norm = np.linalg.norm(combined)
            final_vector = combined / norm if norm > 0 else combined
            
            # 3. Quality Assessment (Depth of Field Protection)
            global_blur = compute_blur(img)
            
            if person_crop is not None:
                subject_blur = compute_blur(person_crop)
                # If subject is sharp, do NOT penalize background bokeh (global_blur)
                if subject_blur < 5:
                    quality = "Low Quality"
                elif subject_blur < 40:
                    quality = "Needs Review"
                else:
                    # Subject is sharp! It's Excellent, regardless of background bokeh.
                    quality = "Excellent"
            else:
                # No person found, rely entirely on global blur for the scene
                if global_blur < 15:
                    quality = "Low Quality"
                elif global_blur < 50:
                    quality = "Needs Review"
                else:
                    quality = "Excellent"

            return final_vector, quality

    except Exception as e:
        print(f"Error analyzing {image_path}: {e}")
        return None, "Low Quality"

def cluster_images(features_dict: dict, eps: float = 0.7) -> tuple:
    """
    Cluster image feature vectors using Agglomerative Clustering to build a similarity graph.
    eps: Distance threshold for cutting the graph into Moment clusters.
    Returns a tuple: (list of groups (size > 1), list of unique_photos (size == 1)).
    """
    image_ids = list(features_dict.keys())
    
    if len(image_ids) == 0:
        return [], []
    if len(image_ids) == 1:
        return [], image_ids

    feature_matrix = np.array([features_dict[img_id] for img_id in image_ids])
    
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=eps,
        metric='euclidean',
        linkage='average'
    ).fit(feature_matrix)
    
    labels = clustering.labels_
    
    clusters = {}
    for idx, label in enumerate(labels):
        img_id = image_ids[idx]
        if label not in clusters:
            clusters[label] = []
        clusters[label].append(img_id)
            
    groups = []
    unique_photos = []
    
    for label, group in clusters.items():
        if len(group) == 1:
            unique_photos.append(group[0])
        else:
            groups.append(group)
            
    return groups, unique_photos
