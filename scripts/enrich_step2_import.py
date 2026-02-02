import json
import sqlite3
import argparse
import os

DB_PATH = 'prisma/dev.db'
INPUT_FILE = 'high_school_enrichment.json'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def update_word(word_id: int, metadata: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    # Check if word exists first? Assuming IDs are valid from Step 1.
    
    if 'cluster_tag' in metadata:
        updates.append("clusterTag = ?")
        params.append(metadata['cluster_tag'])
        
    if 'root_affix' in metadata:
        updates.append("roots = ?")
        params.append(metadata['root_affix'])
        
    if 'synonym_group' in metadata:
        updates.append("synonymGroup = ?")
        params.append(metadata['synonym_group'])
        
    if 'antonym' in metadata:
        updates.append("antonym = ?")
        params.append(metadata['antonym'])
        
    if 'usage_domain' in metadata:
        updates.append("usageDomain = ?")
        params.append(metadata['usage_domain'])
        
    if not updates:
        return False
        
    params.append(word_id)
    sql = f"UPDATE Word SET {', '.join(updates)} WHERE id = ?"
    
    try:
        cursor.execute(sql, params)
        conn.commit()
        updated = cursor.rowcount > 0
        conn.close()
        return updated
    except Exception as e:
        print(f"Error updating word {word_id}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Step 2: Import Enrichment JSON to DB")
    parser.add_argument("--file", default=INPUT_FILE, help="Path to JSON file")
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        print(f"File not found: {args.file}")
        return
        
    with open(args.file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    if not isinstance(data, list):
        print("Invalid JSON format, expected a list.")
        return
        
    print(f"Loaded {len(data)} records from {args.file}. Starting import...")
    
    count = 0
    for item in data:
        if 'id' in item:
            if update_word(item['id'], item):
                count += 1
                if count % 100 == 0:
                    print(f"Imported {count}...")
            else:
                print(f"Failed to update or no changes for ID {item['id']}")
                
    print(f"Import complete. Updated {count} words.")

if __name__ == '__main__':
    main()
