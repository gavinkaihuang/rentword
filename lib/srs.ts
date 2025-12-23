/**
 * Spaced Repetition System (SRS) Logic
 * Simplified SM-2 like approach for vocabulary learning.
 */

export interface SRSResult {
    proficiency: number;
    nextReviewDate: Date;
    consecutiveCorrect: number;
}

/**
 * Calculate the next review schedule based on performance.
 * @param currentProficiency Current proficiency level (0-5)
 * @param consecutiveCorrect Number of times answered correctly in a row
 * @param isCorrect Whether the current answer was correct
 */
export function calculateNextReview(
    currentProficiency: number,
    consecutiveCorrect: number,
    isCorrect: boolean
): SRSResult {
    let newProficiency = currentProficiency;
    let newConsecutiveCorrect = consecutiveCorrect;
    let nextReviewDate = new Date();

    if (isCorrect) {
        newConsecutiveCorrect++;
        // Increase proficiency if correct, capped at 5
        if (newProficiency < 5) {
            newProficiency++;
        }

        // Determine interval based on *new* proficiency
        // Level 0 -> 0 (shouldn't happen if correct, moves to 1)
        // Level 1 -> 1 day
        // Level 2 -> 3 days
        // Level 3 -> 7 days
        // Level 4 -> 15 days
        // Level 5 -> 30 days

        let intervalDays = 0;
        switch (newProficiency) {
            case 1: intervalDays = 1; break;
            case 2: intervalDays = 3; break;
            case 3: intervalDays = 7; break;
            case 4: intervalDays = 15; break;
            case 5: intervalDays = 30; break;
            default: intervalDays = 1; // Fallback
        }

        // Add interval to current time
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

    } else {
        // Incorrect answer
        newConsecutiveCorrect = 0;
        // Reset or decrease proficiency
        // Strategy: Drop to 0 or 1? Let's drop to 0 to force re-learning.
        newProficiency = 0;

        // Next review: Immediate (or very short). 
        // We set it to now (or 1 minute from now) so it appears in "Review" mode immediately.
        // Let's keep it as "Now" for simplicity.
    }

    return {
        proficiency: newProficiency,
        nextReviewDate,
        consecutiveCorrect: newConsecutiveCorrect,
    };
}
