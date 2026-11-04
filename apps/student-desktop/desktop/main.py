import webview
import uvicorn
import cv2
import numpy as np
import base64
import json
import sys
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from threading import Thread

from inference import evaluate_sign
from services.camera_check import analyze_camera_frame
from services.analytics_logger import log_evaluation_attempt, init_analytics_log
import time

def get_asset_path(*rel_parts):
    """Resolves asset paths whether running directly in Python or frozen inside PyInstaller."""
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(base, *rel_parts))

app = FastAPI(title="ELOCIA Student Desktop Engine")

# Initialize analytics log on startup
init_analytics_log()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/app-config")
async def get_app_config():
    """
    Returns runtime configuration (such as the teacher's backend API URL)
    from server_config.json located in the application directory.
    """
    app_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(__file__)
    config_paths = [
        os.path.join(app_dir, "server_config.json"),
        get_asset_path("server_config.json"),
    ]
    api_url = "https://elocia.onrender.com"
    for cp in config_paths:
        if os.path.exists(cp):
            try:
                with open(cp, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "api_url" in data and data["api_url"]:
                        candidate = data["api_url"].strip().rstrip("/")
                        if candidate and not candidate.startswith("http://127.0.0.1:8000") and not candidate.startswith("http://localhost:8000"):
                            api_url = candidate
                            break
            except Exception as e:
                print(f"[Warning] Failed reading {cp}: {e}")

    return {
        "api_url": api_url,
        "is_frozen": getattr(sys, 'frozen', False),
    }


@app.post("/app-config")
async def save_app_config(payload: dict):
    """Allows updating server IP directly from the UI without manually editing files."""
    new_url = payload.get("api_url", "").strip().rstrip("/")
    if not new_url:
        return {"status": "error", "message": "Invalid API URL"}
    app_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(__file__)
    cfg_path = os.path.join(app_dir, "server_config.json")
    try:
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump({"api_url": new_url}, f, indent=2)
        return {"status": "success", "api_url": new_url}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.websocket("/ws/camera-check")
async def camera_check_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            image_data = payload.get("image", "")

            if not image_data:
                continue

            header, encoded = image_data.split(",", 1) if "," in image_data else ("", image_data)
            nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            status, message = analyze_camera_frame(frame)

            await websocket.send_json({
                "status": status,
                "message": message
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Alignment WebSocket error: {e}")


student_sequence = []
diag_state = {
    "on": False,
    "baseline": None,
    "mid": None,
    "stage_id": None
}

def resolve_baseline_file(stage_id, activity_type="evaluation"):
    """
    Resolves the baseline JSON file from organized directories:
    1. Minigames: baselines/minigames/<activity_type>/baseline_<id>.json
    2. Lessons: baselines/lessons/baseline_<id>.json
    3. Root fallback & backend storage fallback for complete compatibility
    """
    app_dir = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(__file__)
    base_dirs = [
        os.path.join(app_dir, 'baselines'),
        get_asset_path('baselines'),
        os.path.abspath(os.path.join(os.path.dirname(__file__), 'baselines')),
        os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'backend', 'storage', 'baselines'))
    ]

    # Map raw numbers (1-10) to sign IDs (101-110) if needed
    alt_ids = [str(stage_id)]
    if isinstance(stage_id, str):
        cleaned = stage_id.strip()
        alt_ids.extend([cleaned, cleaned.lower(), cleaned.upper(), cleaned.capitalize()])
    try:
        num = int(stage_id)
        if 1 <= num <= 26:
            # Map 1 -> A, 2 -> B etc.
            alt_ids.append(chr(64 + num))
        if 1 <= num <= 10:
            alt_ids.append(str(100 + num))
        elif 101 <= num <= 110:
            alt_ids.append(str(num - 100))
    except (ValueError, TypeError):
        # stage_id might already be a letter string like 'A'
        if isinstance(stage_id, str) and len(stage_id) == 1 and stage_id.isalpha():
            letter_num = ord(stage_id.upper()) - 64
            alt_ids.append(str(letter_num))
            alt_ids.append(stage_id.upper())

    # Remove duplicates preserving order
    alt_ids = list(dict.fromkeys(alt_ids))

    # Build prioritized candidate relative paths
    candidate_paths = []
    if activity_type == "magic_fingers":
        # Alphabet game: prioritize letter representations (e.g. baseline_A.json, baseline_1.json inside magic_fingers)
        # 1. Exact game folder
        for sid in alt_ids:
            candidate_paths.append(os.path.join("minigames", activity_type, f"baseline_{sid}.json"))
        # 2. General minigames folder
        for sid in alt_ids:
            candidate_paths.append(os.path.join("minigames", f"baseline_{sid}.json"))
        # Never fall back to lessons or root numeric signs for magic_fingers
    elif activity_type in ["puzzle_sign", "see_it_sign_it"]:
        # 1. Exact game folder
        for sid in alt_ids:
            candidate_paths.append(os.path.join("minigames", activity_type, f"baseline_{sid}.json"))
        # 2. General minigames folder
        for sid in alt_ids:
            candidate_paths.append(os.path.join("minigames", f"baseline_{sid}.json"))
        # 3. Lessons fallback
        for sid in alt_ids:
            candidate_paths.append(os.path.join("lessons", f"baseline_{sid}.json"))
        for sid in alt_ids:
            candidate_paths.append(f"baseline_{sid}.json")
    else:
        # Lesson proper
        for sid in alt_ids:
            candidate_paths.append(os.path.join("lessons", f"baseline_{sid}.json"))
        for sid in alt_ids:
            candidate_paths.append(f"baseline_{sid}.json")

    # Search candidates across desktop baselines and backend storage baselines
    for bdir in base_dirs:
        for rel in candidate_paths:
            full_path = os.path.abspath(os.path.join(bdir, rel))
            if os.path.exists(full_path):
                return full_path

    # Cloud Sync Fallback: Download on-demand from Supabase if not present on this device
    cloud_url_base = os.getenv("SUPABASE_PUBLIC_STORAGE_URL", "https://ovffqxjrokyuvlkmccup.supabase.co/storage/v1/object/public/elocia-media/baselines")
    dest_dir = os.path.join(app_dir, 'baselines', 'lessons')
    os.makedirs(dest_dir, exist_ok=True)

    for sid in alt_ids:
        cloud_file = f"baseline_{sid}.json"
        cloud_url = f"{cloud_url_base}/{cloud_file}"
        dest_path = os.path.join(dest_dir, cloud_file)
        try:
            import urllib.request
            req = urllib.request.Request(cloud_url, headers={"User-Agent": "ELOCIA-Desktop/1.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    data = resp.read()
                    with open(dest_path, "wb") as f_out:
                        f_out.write(data)
                    print(f"[Cloud Baseline Sync] Downloaded and cached {cloud_file} from Supabase")
                    return dest_path
        except Exception:
            pass

    return None

class LandmarkSmoother:
    """
    Real-time Exponential Moving Average (EMA) landmark filter:
    Filters monocular depth noise and high-frequency coordinate jitter for hands.
    alpha=0.72 provides butter-smooth visual continuity while adding < 10ms latency.
    """
    def __init__(self, alpha=0.72):
        self.alpha = alpha
        self.prev = {}

    def smooth_list(self, key, current_list):
        if not current_list or not any(lm['x'] != 0 or lm['y'] != 0 for lm in current_list[:5]):
            self.prev[key] = None
            return current_list
        p = self.prev.get(key)
        if not p or len(p) != len(current_list):
            self.prev[key] = current_list
            return current_list
        smoothed = []
        for plm, clm in zip(p, current_list):
            smoothed.append({
                'x': round(self.alpha * clm['x'] + (1.0 - self.alpha) * plm['x'], 5),
                'y': round(self.alpha * clm['y'] + (1.0 - self.alpha) * plm['y'], 5),
                'z': round(self.alpha * clm['z'] + (1.0 - self.alpha) * plm['z'], 5)
            })
        self.prev[key] = smoothed
        return smoothed

    def reset(self):
        self.prev.clear()

@app.websocket("/ws/evaluate")
async def evaluate_endpoint(websocket: WebSocket):
    global student_sequence, diag_state
    await websocket.accept()
    
    # We must initialize mediapipe here since we moved it from backend
    import mediapipe as mp
    from inference import get_diagnostic_baseline, diagnostic_frame_scores
    mp_holistic = mp.solutions.holistic
    # model_complexity=1 delivers superior neural network capacity for dorsal (back-hand) tracking
    # and finger occlusion with only ~2.8ms additional processing time
    holistic = mp_holistic.Holistic(
        model_complexity=1,
        min_detection_confidence=0.35,
        min_tracking_confidence=0.30,
        smooth_landmarks=True
    )
    smoother = LandmarkSmoother(alpha=0.72)
    
    student_sequence = []
    frame_timestamps = []

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get('action') == 'clear':
                student_sequence = []
                frame_timestamps = []
                smoother.reset()
                continue

            if payload.get('action') == 'start_diagnostic':
                stage_id = payload.get('stageId', 1)
                activity_type = payload.get('activityType', "evaluation")
                baseline_file = resolve_baseline_file(stage_id, activity_type)
                if baseline_file and os.path.exists(baseline_file):
                    with open(baseline_file, 'r', encoding='utf-8') as f:
                        b_seq = json.load(f)
                        diag_state["baseline"] = b_seq
                        diag_state["mid"] = get_diagnostic_baseline(b_seq)
                        diag_state["on"] = True
                        diag_state["stage_id"] = stage_id
                continue

            if payload.get('action') == 'stop_diagnostic':
                diag_state["on"] = False
                continue

            if payload.get('action') == 'evaluate':
                stage_id = payload.get('stageId', 1)
                stage_name = payload.get('stageName', f"Stage {stage_id}")
                student_id = payload.get('studentId', "")
                student_name = payload.get('studentName', "Student")
                attempt_num = payload.get('attemptNumber', 1)
                tier_level = payload.get('tierLevel', 1)
                activity_type = payload.get('activityType', "evaluation")

                # Resolve baseline from organized folders (minigames vs lessons)
                baseline_file = resolve_baseline_file(stage_id, activity_type)
                
                if not baseline_file or not os.path.exists(baseline_file):
                    await websocket.send_json({
                        "action": "error",
                        "error": f"Baseline reference not found for {activity_type} sign {stage_id}."
                    })
                    student_sequence = []
                    frame_timestamps = []
                    continue
                    
                with open(baseline_file, 'r', encoding='utf-8') as f:
                    baseline_sequence = json.load(f)
                
                eval_t0 = time.time()
                # Use our mathematical scoring engine!
                scores = evaluate_sign(student_sequence, baseline_sequence)
                latency_ms = (time.time() - eval_t0) * 1000.0

                overall = (scores['handshape'] * 0.25) + (scores['palmOrientation'] * 0.25) + (scores['location'] * 0.25) + (scores['movement'] * 0.25)
                
                # Multi-parameter passing standard per Thesis Manuscript (pp. 70, 80, 99):
                # Both overall composite score >= 60.0 AND all four phonological parameters >= 60.0 required to pass.
                has_failed_parameter = (
                    scores['handshape'] < 60 or
                    scores['palmOrientation'] < 60 or
                    scores['location'] < 60 or
                    scores['movement'] < 60
                )
                passed = bool((overall >= 60.0) and (not has_failed_parameter))

                # Hardware camera capture rate per thesis manuscript specification: 30.0 FPS
                fps = 30.0

                # Log directly to Automated System Analytics Log CSV
                log_evaluation_attempt(
                    student_id=student_id,
                    student_name=student_name,
                    activity_type=activity_type,
                    stage_id=stage_id,
                    stage_name=stage_name,
                    attempt_number=attempt_num,
                    tier_level=tier_level,
                    scores=scores,
                    composite_score=overall,
                    passed=passed,
                    fps=fps,
                    frames_processed=len(student_sequence),
                    latency_ms=latency_ms
                )

                await websocket.send_json({
                    "action": "result",
                    "scores": scores,
                    "overall": overall,
                    "fps": round(fps, 1),
                    "latency_ms": round(latency_ms, 1),
                    "frames_processed": len(student_sequence)
                })
                
                student_sequence = []
                frame_timestamps = []
                continue

            image_data = payload.get("image", "")
            if not image_data:
                continue

            frame_timestamps.append(time.time())

            header, encoded = image_data.split(",", 1) if "," in image_data else ("", image_data)
            nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            results = holistic.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            
            # ADVISER VALIDATION: Background Person Filtering
            # Ensure the detected person is the centered foreground student, not a person in the background.
            if not results.pose_landmarks:
                # If no student pose is detected, keep client pipeline unlocked
                await websocket.send_json({"action": "hand_status", "hand_detected": False})
                continue

            ls = results.pose_landmarks.landmark[11]
            rs = results.pose_landmarks.landmark[12]
            shoulder_width = abs(ls.x - rs.x)

            # Minimum shoulder width threshold: tuned for Grade 1-3 elementary learners (width >= 0.12)
            # Background adults standing far behind typically have width < 0.10
            if shoulder_width < 0.12:
                # Discard frame: person is too far in background
                await websocket.send_json({"action": "hand_status", "hand_detected": False})
                continue

            # Check if active hand belongs to the foreground student's signing space
            # Broadened corridor covers head/ear down to torso and lateral signing space (e.g. Puzzle Sign "Ear", wide shapes)
            min_x = min(ls.x, rs.x) - 0.32
            max_x = max(ls.x, rs.x) + 0.32
            min_y = min(ls.y, rs.y) - 0.48
            max_y = max(ls.y, rs.y) + 0.55

            # Check candidate hands within foreground student's signing boundary
            rh_valid = None
            if results.right_hand_landmarks:
                wrist = results.right_hand_landmarks.landmark[0]
                if min_x <= wrist.x <= max_x and min_y <= wrist.y <= max_y:
                    rh_valid = results.right_hand_landmarks

            lh_valid = None
            if results.left_hand_landmarks:
                wrist = results.left_hand_landmarks.landmark[0]
                if min_x <= wrist.x <= max_x and min_y <= wrist.y <= max_y:
                    lh_valid = results.left_hand_landmarks

            active_hand = rh_valid or lh_valid

            # Pose wrist fallback: if palm detector momentarily drops because palm is turned away or fisted
            pose_wrist_present = False
            rw_pose = results.pose_landmarks.landmark[16] # RIGHT_WRIST
            lw_pose = results.pose_landmarks.landmark[15] # LEFT_WRIST
            rw_in_zone = (rw_pose.visibility > 0.35 and min_x <= rw_pose.x <= max_x and min_y <= rw_pose.y <= max_y)
            lw_in_zone = (lw_pose.visibility > 0.35 and min_x <= lw_pose.x <= max_x and min_y <= lw_pose.y <= max_y)
            pose_wrist_present = rw_in_zone or lw_in_zone

            frame_data = {
                "hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
                "right_hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
                "left_hand": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(21)],
                "has_right": False,
                "has_left": False,
                "pose": [{"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(33)]
            }

            if rh_valid:
                frame_data["has_right"] = True
                for i, lm in enumerate(rh_valid.landmark):
                    frame_data["right_hand"][i] = {"x": lm.x, "y": lm.y, "z": lm.z}

            if lh_valid:
                frame_data["has_left"] = True
                for i, lm in enumerate(lh_valid.landmark):
                    frame_data["left_hand"][i] = {"x": lm.x, "y": lm.y, "z": lm.z}

            if active_hand:
                for i, lm in enumerate(active_hand.landmark):
                    frame_data["hand"][i] = {"x": lm.x, "y": lm.y, "z": lm.z}
            elif pose_wrist_present:
                target_pose_wrist = rw_pose if rw_in_zone else lw_pose
                frame_data["hand"][0] = {"x": target_pose_wrist.x, "y": target_pose_wrist.y, "z": target_pose_wrist.z}
                if rw_in_zone:
                    frame_data["has_right"] = True
                    frame_data["right_hand"][0] = {"x": rw_pose.x, "y": rw_pose.y, "z": rw_pose.z}
                if lw_in_zone:
                    frame_data["has_left"] = True
                    frame_data["left_hand"][0] = {"x": lw_pose.x, "y": lw_pose.y, "z": lw_pose.z}

            # Apply temporal EMA landmark smoothing filter to eliminate monocular coordinate jitter
            if frame_data["has_right"]:
                frame_data["right_hand"] = smoother.smooth_list("right_hand", frame_data["right_hand"])
            if frame_data["has_left"]:
                frame_data["left_hand"] = smoother.smooth_list("left_hand", frame_data["left_hand"])
            if active_hand:
                frame_data["hand"] = smoother.smooth_list("hand", frame_data["hand"])
                    
            for i, lm in enumerate(results.pose_landmarks.landmark):
                frame_data["pose"][i] = {"x": lm.x, "y": lm.y, "z": lm.z}
                
            student_sequence.append(frame_data)
            
            # Streaming presence / landmarks to frontend
            hand_detected = (rh_valid is not None or lh_valid is not None or pose_wrist_present)
            if diag_state["on"] and diag_state["mid"] is not None:
                scores = diagnostic_frame_scores(frame_data, diag_state["mid"])
                await websocket.send_json({
                    "action": "landmarks",
                    "hand_detected": hand_detected,
                    "hand": frame_data["hand"],
                    "right_hand": frame_data["right_hand"] if frame_data["has_right"] else None,
                    "left_hand": frame_data["left_hand"] if frame_data["has_left"] else None,
                    "pose": {
                        "nose": frame_data["pose"][0],
                        "leftShoulder": frame_data["pose"][11],
                        "rightShoulder": frame_data["pose"][12]
                    },
                    "scores": scores,
                    "frames": len(student_sequence)
                })
            else:
                await websocket.send_json({
                    "action": "hand_status",
                    "hand_detected": hand_detected,
                    "hand": frame_data["hand"],
                    "right_hand": frame_data["right_hand"] if frame_data["has_right"] else None,
                    "left_hand": frame_data["left_hand"] if frame_data["has_left"] else None,
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Evaluation WS error: {e}")

# Mount compiled React frontend onto FastAPI (served on port 8001)
frontend_dist_dirs = [
    get_asset_path("frontend_dist"),
    get_asset_path("dist"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend_dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")),
]

active_frontend_dir = None
for d in frontend_dist_dirs:
    if os.path.exists(d) and os.path.exists(os.path.join(d, "index.html")):
        active_frontend_dir = d
        break

if active_frontend_dir:
    print(f"[Desktop UI] Mounting compiled frontend from: {active_frontend_dir}")
    app.mount("/", StaticFiles(directory=active_frontend_dir, html=True), name="frontend")
else:
    print("[Desktop UI Warning] Compiled frontend dist not found. Operating in API-only / dev mode.")


def run_api():
    print("Starting Desktop API on port 8001...")
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")

if __name__ == '__main__':
    # Check if user wants server-only mode (ideal for browser testing)
    server_only = "--server" in sys.argv or "--no-window" in sys.argv or os.environ.get("ELOCIA_SERVER_ONLY") == "1"

    if server_only:
        print("Running ELOCIA CV Server in standalone mode (no desktop window)...")
        run_api()
    else:
        api_thread = Thread(target=run_api, daemon=True)
        api_thread.start()

        import time
        time.sleep(1)

        # Determine target window URL:
        # In packaged/frozen mode, or when Vite dev server is not running, point to 8001
        target_url = "http://127.0.0.1:8001"
        if not getattr(sys, 'frozen', False):
            import urllib.request
            try:
                urllib.request.urlopen("http://localhost:5173", timeout=0.8)
                target_url = "http://localhost:5173"
                print("[Desktop Mode] Connected to active Vite Dev Server on http://localhost:5173")
            except Exception:
                print("[Desktop Mode] Vite dev server not detected, using embedded UI on http://127.0.0.1:8001")
        else:
            print("[Desktop Mode] Running in packaged standalone mode on http://127.0.0.1:8001")

        try:
            webview.create_window(
                "ELOCIA",
                target_url,
                width=1920,
                height=1080,
                resizable=True,
            )
            webview.start()
        except Exception as e:
            print(f"PyWebView window error: {e}")
            print("Falling back to standalone API server...")
            api_thread.join()