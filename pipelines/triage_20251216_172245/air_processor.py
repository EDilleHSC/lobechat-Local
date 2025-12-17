# Moved to core/intake/pipelines/triage_20251216_172245/air_processor.py — original preserved in git history
# This placeholder indicates the canonical implementation has moved.
import os
import json
from pathlib import Path
from datetime import datetime

# Configuration
NAVI_DIR = r"D:\05_AGENTS-AI\01_RUNTIME\VBoarder\NAVI"
ACTIVE_DIR = os.path.join(NAVI_DIR, "ACTIVE")
SNAPSHOT_DIR = os.path.join(NAVI_DIR, "snapshots", "inbox")
WAITING_DIR = os.path.join(NAVI_DIR, "WAITING")
DONE_DIR = os.path.join(NAVI_DIR, "DONE")
COLLECTION_DIR = os.path.join(NAVI_DIR, "COLLECTION")
COLLECTION_SNAPSHOTS = os.path.join(NAVI_DIR, "snapshots", "collection")

# Allowed extensions for confidence calculation
ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.xlsx', '.pptx', '.txt', '.rtf', '.odt', '.doc', '.xls', '.ppt']

def find_latest_snapshot():
    """Find the most recent processed snapshot"""
    if not os.path.exists(SNAPSHOT_DIR):
        return None

    snapshot_files = [f for f in os.listdir(SNAPSHOT_DIR) if f.endswith('.json')]
    if not snapshot_files:
        return None

    # Sort by timestamp (filenames contain timestamps)
    snapshot_files.sort(reverse=True)

    for filename in snapshot_files:
        snapshot_path = os.path.join(SNAPSHOT_DIR, filename)
        try:
            with open(snapshot_path, 'r') as f:
                snapshot = json.load(f)
            if snapshot.get('status') == 'processed':
                return snapshot, snapshot_path
        except Exception as e:
            print(f"Error reading snapshot {filename}: {e}")

    return None, None

def monitor_collection_status():
    """Monitor COLLECTION system status for AIR awareness"""
    collection_status = {
        'incoming_count': 0,
        'batch_count': 0,
        'review_count': 0,
        'hold_count': 0,
        'trash_count': 0,
        'total_backlog': 0,
        'oldest_batch_days': 0,
        'risks': []
    }

    try:
        # Check INCOMING
        incoming_dir = os.path.join(COLLECTION_DIR, "INCOMING")
        if os.path.exists(incoming_dir):
            incoming_files = []
            for root, dirs, files in os.walk(incoming_dir):
                incoming_files.extend([os.path.join(root, f) for f in files])
            collection_status['incoming_count'] = len(incoming_files)

        # Check BATCHES
        batches_dir = os.path.join(COLLECTION_DIR, "BATCHES")
        if os.path.exists(batches_dir):
            batch_dirs = [d for d in os.listdir(batches_dir) if os.path.isdir(os.path.join(batches_dir, d))]
            collection_status['batch_count'] = len(batch_dirs)

            # Calculate oldest batch age
            if batch_dirs:
                oldest_batch = min(batch_dirs)  # Lexicographically first (oldest)
                try:
                    # Extract date from batch ID (format: YYYY-MM-DD_source_index)
                    date_str = oldest_batch.split('_')[0]
                    batch_date = datetime.strptime(date_str, '%Y-%m-%d')
                    age_days = (datetime.now() - batch_date).days
                    collection_status['oldest_batch_days'] = age_days
                except:
                    pass

        # Check REVIEW, HOLD, TRASH_CANDIDATE
        for category in ['REVIEW', 'HOLD', 'TRASH_CANDIDATE']:
            cat_dir = os.path.join(COLLECTION_DIR, category)
            if os.path.exists(cat_dir):
                files = []
                for root, dirs, files_walk in os.walk(cat_dir):
                    files.extend([os.path.join(root, f) for f in files_walk])
                collection_status[f'{category.lower()}_count'] = len(files)

        # Calculate total backlog
        collection_status['total_backlog'] = (
            collection_status['incoming_count'] +
            collection_status['batch_count'] +
            collection_status['review_count'] +
            collection_status['hold_count']
        )

        # Identify risks
        if collection_status['incoming_count'] > 0:
            collection_status['risks'].append("Files waiting in INCOMING - run Process_Collection")

        if collection_status['oldest_batch_days'] > 7:
            collection_status['risks'].append(f"Oldest batch is {collection_status['oldest_batch_days']} days old - review needed")

        if collection_status['total_backlog'] > 50:
            collection_status['risks'].append(f"Large COLLECTION backlog ({collection_status['total_backlog']} items)")

        # Check for idle Inbox but growing COLLECTION
        inbox_idle = len(os.listdir(ACTIVE_DIR)) == 0 if os.path.exists(ACTIVE_DIR) else True
        collection_growing = collection_status['total_backlog'] > 10

        if inbox_idle and collection_growing:
            collection_status['risks'].append("Inbox idle but COLLECTION growing - consider bulk processing")

    except Exception as e:
        print(f"Warning: Error monitoring COLLECTION: {e}")

    return collection_status

def analyze_file_content(filepath):
    """Analyze file content to determine priority level and return content"""
    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            content_lower = content.lower()

        # Check for urgent keywords
        urgent_keywords = ['critical', 'emergency', 'immediate', 'urgent', 'ceo', 'executive']
        if any(keyword in content_lower for keyword in urgent_keywords):
            return 'urgent', content_lower

        # Check for high priority keywords
        high_keywords = ['important', 'priority', 'deadline', 'review']
        if any(keyword in content_lower for keyword in high_keywords):
            return 'high', content_lower

        # Check for medium priority keywords
        medium_keywords = ['check', 'verify', 'follow up', 'meeting']
        if any(keyword in content_lower for keyword in medium_keywords):
            return 'medium', content_lower

        # Default to low priority
        return 'low', content_lower

    except Exception as e:
        print(f"[ERROR] Error analyzing {filepath}: {e}")
        return 'low', ''

def calculate_confidence(filepath, content_lower=None):
    """Calculate confidence score based on rule matching"""
    confidence = 0
    signals = []

    filename = os.path.basename(filepath)
    _, ext = os.path.splitext(filename)

    # File type allowed (+30)
    if ext.lower() in ALLOWED_EXTENSIONS:
        confidence += 30
        signals.append('allowed_extension')

    # Keyword analysis
    if content_lower is None:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content_lower = f.read().lower()
        except:
            content_lower = ''

    urgent_keywords = ['critical', 'emergency', 'immediate', 'urgent', 'ceo', 'executive']
    high_keywords = ['important', 'priority', 'deadline', 'review']
    medium_keywords = ['check', 'verify', 'follow up', 'meeting']
    all_keywords = urgent_keywords + high_keywords + medium_keywords

    # Keyword match strength (+30 max, +10 per category matched)
    matched_categories = 0
    if any(k in content_lower for k in urgent_keywords):
        matched_categories += 1
    if any(k in content_lower for k in high_keywords):
        matched_categories += 1
    if any(k in content_lower for k in medium_keywords):
        matched_categories += 1

    keyword_strength = min(30, matched_categories * 10)
    confidence += keyword_strength
    if keyword_strength > 0:
        signals.append('keyword_matches')

    # Keyword density (+15 if multiple different keywords)
    keyword_count = sum(1 for k in all_keywords if k in content_lower)
    if keyword_count > 1:
        confidence += 15
        signals.append('keyword_density')

    # Filename clarity (+10 if descriptive)
    filename_words = len(filename.replace('_', ' ').replace('-', ' ').split())
    if filename_words > 2:
        confidence += 10
        signals.append('clear_filename')

    # No ambiguity flags (+15 - since extension validation already happened, assume no ambiguity)
    confidence += 15
    signals.append('no_ambiguity')

    # Cap at 100
    confidence = min(100, confidence)

    # Determine label
    if confidence >= 80:
        label = 'High'
    elif confidence >= 50:
        label = 'Medium'
    else:
        label = 'Low'

    return confidence, label, signals

def get_reason_for_priority(priority, filepath):
    """Generate human-readable reason for priority assignment"""
    if priority == 'urgent':
        return 'Contains urgent keywords (critical, emergency, immediate)'
    elif priority == 'high':
        return 'Contains priority keywords (important, urgent, priority)'
    elif priority == 'medium':
        return 'Contains review keywords (review, check, verify)'
    else:
        return 'Standard processing priority'

def generate_next_steps(processed_items):
    """Generate next steps based on processed items and COLLECTION status"""
    next_steps = []

    # Monitor COLLECTION status
    collection_status = monitor_collection_status()

    # Include COLLECTION awareness in next steps
    if collection_status['incoming_count'] > 0:
        next_steps.append(f"COLLECTION: {collection_status['incoming_count']} files waiting in INCOMING - run Process_Collection when ready")

    if collection_status['batch_count'] > 0:
        next_steps.append(f"COLLECTION: {collection_status['batch_count']} unreviewed batches available - check COLLECTION Overview")

    if collection_status['risks']:
        next_steps.extend([f"COLLECTION RISK: {risk}" for risk in collection_status['risks']])

    # Add COLLECTION context reminder
    next_steps.append("COLLECTION batches are separate from Inbox - they don't affect daily operations until manually promoted")

    # Original processing-based next steps
    has_urgent = any(item['priority'] == 'URGENT' for item in processed_items)
    has_waiting = any(item['destination'] == 'WAITING' for item in processed_items)

    if has_urgent:
        next_steps.append("Notify executive team of urgent items")
        next_steps.append("Escalate critical requests immediately")

    if has_waiting:
        next_steps.append("Schedule review meeting for waiting items")
        next_steps.append("Await policy clarification if needed")

    next_steps.append("Monitor ACTIVE directory for new arrivals")
    next_steps.append("Archive completed items to DONE")

    return next_steps

def air_process_files():
    """AIR main processing logic - outputs structured JSON for Presenter"""
    print("VBoarder AIR Starting...")
    print(f"Reading from: {ACTIVE_DIR}")

    # Find latest processed snapshot
    snapshot, snapshot_path = find_latest_snapshot()
    if not snapshot:
        print("ERROR: No processed snapshots found")
        return

    print(f"Processing snapshot: {os.path.basename(snapshot_path)}")

    # Get files from ACTIVE directory (where mailroom puts them)
    if not os.path.exists(ACTIVE_DIR):
        print(f"ERROR: ACTIVE directory not found: {ACTIVE_DIR}")
        return

    active_files = os.listdir(ACTIVE_DIR)
    if not active_files:
        print("No files in ACTIVE directory")
        return

    print(f"Found {len(active_files)} files to process")

    processed_items = []

    for filename in active_files:
        filepath = os.path.join(ACTIVE_DIR, filename)

        # Analyze file content
        priority, content_lower = analyze_file_content(filepath)

        # Calculate confidence
        confidence, confidence_label, signals = calculate_confidence(filepath, content_lower)

        # Determine destination based on priority
        if priority == 'urgent':
            destination = 'ACTIVE'  # Keep in ACTIVE for immediate attention
            action = 'escalate'
        elif priority == 'high':
            destination = 'ACTIVE'  # Keep in ACTIVE for processing
            action = 'process'
        elif priority == 'medium':
            destination = 'WAITING'  # Move to WAITING for review
            action = 'review'
        else:
            destination = 'DONE'  # Archive low priority
            action = 'archive'

        # Create structured item for Presenter
        item = {
            'file': filename,
            'priority': priority.upper(),
            'destination': destination,
            'reason': get_reason_for_priority(priority, filepath),
            'confidence': confidence,
            'confidence_label': confidence_label,
            'signals': signals
        }

        processed_items.append(item)
        print(f"{filename} -> {priority.upper()} -> {action} -> {destination} (Confidence: {confidence}%)")

    # Generate next steps based on processing
    next_steps = generate_next_steps(processed_items)

    # Create AIR output for Presenter (machine-truth JSON)
    air_output = {
        'agent': 'AIR',
        'action': 'route',
        'summary': f'{len(processed_items)} incoming requests processed',
        'items': processed_items,
        'next_steps': next_steps,
        'timestamp': datetime.now().isoformat()
    }

    # Execute decisions
    moved_count = 0
    for item in processed_items:
        filename = item['file']
        destination = item['destination']

        source_path = os.path.join(ACTIVE_DIR, filename)
        dest_dir = os.path.join(NAVI_DIR, destination)

        if not os.path.exists(source_path):
            print(f"[SKIP] File not found (already processed?): {filename}")
            continue

        if destination != 'ACTIVE':  # Only move if not staying in ACTIVE
            os.makedirs(dest_dir, exist_ok=True)
            dest_path = os.path.join(dest_dir, filename)

            try:
                os.rename(source_path, dest_path)
                print(f"Moved {filename} to {destination}")
                moved_count += 1
            except Exception as e:
                print(f"ERROR: Error moving {filename}: {e}")

    # Update snapshot with AIR decisions
    snapshot['air_processed_at'] = datetime.now().isoformat()
    snapshot['air_output'] = air_output
    snapshot['status'] = 'air_processed'

    try:
        with open(snapshot_path, 'w') as f:
            json.dump(snapshot, f, indent=2)
        print("Updated snapshot with AIR decisions")
    except Exception as e:
        print(f"ERROR: Error updating snapshot: {e}")

    # Save AIR output for Presenter
    air_output_path = os.path.join(NAVI_DIR, 'air_output.json')
    try:
        with open(air_output_path, 'w') as f:
            json.dump(air_output, f, indent=2)
        print(f"AIR output saved to: {air_output_path}")
    except Exception as e:
        print(f"ERROR: Error saving AIR output: {e}")

    print(f"AIR processing complete - {len(processed_items)} files processed, {moved_count} moved")

if __name__ == "__main__":
    air_process_files()