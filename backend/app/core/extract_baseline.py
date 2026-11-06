"""
ELOCIA FSL Baseline Landmark Extraction Worker
Processes a demonstration video (.mp4, .webm, .mov) using MediaPipe Holistic
and outputs a standardized 3D coordinate landmark sequence JSON file.
"""
import sys
import os
import argparse
import json
import cv2
import mediapipe as mp

def safe_print(*args, **kwargs):
    """Safely print without crashing on Windows broken console pipes [WinError 233]."""
    try:
        print(*args, **kwargs)
        sys.stdout.flush()
    except (OSError, IOError, Exception):
        pass

def extract_landmarks(video_path, output_json_path, stage_id=None):
    if not os.path.exists(video_path):
        err = f"Video file not found: {video_path}"
        safe_print(json.dumps({"success": False, "error": err}))
        return {"success": False, "error": err}

    mp_holistic = mp.solutions.holistic
    holistic = mp_holistic.Holistic(
        static_image_mode=False,
        model_complexity=0,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        err = f"Could not open video file: {video_path}"
        safe_print(json.dumps({"success": False, "error": err}))
        return {"success": False, "error": err}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    baseline_data = []
    frame_count = 0
    hands_detected_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Fast frame downscaling for high-speed landmark extraction
        # MediaPipe coordinates are normalized (0.0 to 1.0), so 640px gives 
        # identical landmark accuracy at 3-4x faster CPU processing speed.
        h, w = frame.shape[:2]
        if w > 640:
            scale = 640.0 / w
            frame = cv2.resize(frame, (640, int(h * scale)), interpolation=cv2.INTER_LINEAR)

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False

        results = holistic.process(rgb_frame)

        frame_data = {
            "hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
            "right_hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
            "left_hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
            "has_right": False,
            "has_left": False,
            "pose": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(33)]
        }

        if results.right_hand_landmarks:
            frame_data["has_right"] = True
            for j, lm in enumerate(results.right_hand_landmarks.landmark):
                frame_data["right_hand"][j] = {"x": float(lm.x), "y": float(lm.y), "z": float(lm.z)}

        if results.left_hand_landmarks:
            frame_data["has_left"] = True
            for j, lm in enumerate(results.left_hand_landmarks.landmark):
                frame_data["left_hand"][j] = {"x": float(lm.x), "y": float(lm.y), "z": float(lm.z)}

        # Dominant/primary hand for backwards-compatibility with 1-hand algorithms
        active_hand = results.right_hand_landmarks or results.left_hand_landmarks
        if active_hand:
            hands_detected_count += 1
            for j, lm in enumerate(active_hand.landmark):
                frame_data["hand"][j] = {"x": float(lm.x), "y": float(lm.y), "z": float(lm.z)}

        if results.pose_landmarks:
            for j, lm in enumerate(results.pose_landmarks.landmark):
                frame_data["pose"][j] = {"x": float(lm.x), "y": float(lm.y), "z": float(lm.z)}

        baseline_data.append(frame_data)
        frame_count += 1

    cap.release()
    holistic.close()

    if frame_count == 0:
        err = "No frames could be read from the video"
        safe_print(json.dumps({"success": False, "error": err}))
        return {"success": False, "error": err}

    os.makedirs(os.path.dirname(os.path.abspath(output_json_path)), exist_ok=True)
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(baseline_data, f)

    result = {
        "success": True,
        "video_path": video_path,
        "output_path": output_json_path,
        "stage_id": stage_id,
        "total_frames": frame_count,
        "hands_detected_frames": hands_detected_count,
        "fps": fps
    }
    safe_print(json.dumps(result))
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract MediaPipe Holistic landmarks from FSL video")
    parser.add_argument("--video", required=True, help="Path to input video file")
    parser.add_argument("--output", required=True, help="Path to save output JSON")
    parser.add_argument("--stage", type=str, default="1", help="Stage ID or word identifier for the sign")

    args = parser.parse_args()
    extract_landmarks(args.video, args.output, args.stage)
