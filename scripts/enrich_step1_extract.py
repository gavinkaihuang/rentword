import os
import json
import sqlite3
import argparse
import requests
import time
from typing import List, Dict

# Configuration
DB_PATH = 'prisma/dev.db'
WORDBOOK_ID = 1 # High School Words
OUTPUT_FILE = 'high_school_enrichment.json'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_words(limit: int = 10000, offset: int = 0):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, spelling, meaning FROM Word WHERE wordBookId = ? LIMIT ? OFFSET ?", 
        (WORDBOOK_ID, limit, offset)
    )
    words = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return words

def call_ai_classification(words: List[Dict], api_key: str, base_url: str = "https://api.openai.com/v1/chat/completions", model: str = "gemini-1.5-flash"):
    if not words:
        return []
        
    word_list_str = "\n".join([f"{w['id']}: {w['spelling']} ({w['meaning']})" for w in words])
    
    system_prompt = """
    You are a Language Data Architect. Analyze the provided list of words.
    For each word, generate a JSON object with:
    - id: The provided word ID (Integer, MUST match input)
    - spelling: The word spelling (String, for verification)
    - cluster_tag: Semantic category (e.g., "Cognitive Process", "Social Interaction", "Physical Properties", "Abstract Concept")
    - root_affix: Identify common roots/affixes (e.g. "struct", "ion", "pre-")
    - synonym_group: A keyword or concept ID for synonyms (e.g. "BIG", "HAPPY") or null
    - antonym: A direct antonym word if applicable, or null
    - usage_domain: Recommended domain (e.g., "Academic", "Tech", "Daily", "Literature")
    
    Return ONLY a valid JSON object with a key "words" containing the array.
    Example: { "words": [{ "id": 123, "spelling": "test", ... }] }
    """
    
    user_prompt = f"Words to classify:\n{word_list_str}"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": model, 
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": { "type": "json_object" }
    }
    
    try:
        response = requests.post(base_url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        parsed = json.loads(content)
        
        if isinstance(parsed, dict) and 'words' in parsed:
            return parsed['words']
        elif isinstance(parsed, list):
            return parsed
        return []
    except Exception as e:
        print(f"Error calling AI: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Step 1: Extract and Classify Words to JSON")
    parser.add_argument("--key", help="OpenAI API Key", required=True)
    parser.add_argument("--base_url", default="https://api.openai.com/v1/chat/completions", help="API Endpoint URL")
    parser.add_argument("--model", default="gemini-1.5-flash", help="Model name")
    parser.add_argument("--batch", type=int, default=400, help="Batch size for AI calls")
    # Add --limit to test with smaller subset
    parser.add_argument("--limit", type=int, default=10000, help="Total words to process")
    args = parser.parse_args()
    
    # Load existing to resume?
    all_results = []
    processed_ids = set()
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                if isinstance(existing_data, list):
                    all_results = existing_data
                    for item in all_results:
                        if 'id' in item:
                            processed_ids.add(item['id'])
            print(f"Resuming from {len(all_results)} existing records...")
        except:
            print("Could not read existing file, starting fresh.")
    
    words = fetch_words(limit=args.limit)
    print(f"Fetched {len(words)} words from DB.")
    
    # Filter out already processed
    words_to_process = [w for w in words if w['id'] not in processed_ids]
    print(f"Words remaining to process: {len(words_to_process)}")
    
    # Process in batches
    for i in range(0, len(words_to_process), args.batch):
        batch = words_to_process[i : i + args.batch]
        print(f"Processing batch {i} to {i+len(batch)}...")
        
        batch_results = call_ai_classification(batch, args.key, args.base_url, args.model)
        
        if batch_results:
            all_results.extend(batch_results)
            # Save immediately (incremental backup)
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(all_results, f, indent=2, ensure_ascii=False)
            print(f"Saved {len(batch_results)} results. Total: {len(all_results)}")
        else:
            print("Batch failed or returned empty.")
            
        time.sleep(10) # Rate limit check
        
    print(f"Done! Data saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
