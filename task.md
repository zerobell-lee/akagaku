# Akagaku Improvement Tasks

## 1. ✅ Fix SpeechBubble Height Dependency on Character Height - COMPLETED
**Problem**: speechBubbleWindow height follows character height, causing small characters to have tiny speech bubbles.

**Solution**:
- Use Minkee's height as constant reference value
- Decouple speechBubble height from character height

**Fixed**:
- Added `SPEECH_BUBBLE_HEIGHT = 768` constant
- Replaced `this.characterAppearance.character_height` with constant in createSpeechBubbleWindow()

---

## 2. ✅ Adjust SpeechBubble Position Gap Based on Zoom Factor - COMPLETED
**Problem**: Gap between speechBubble and character appears larger when zoomFactor is lower.

**Solution**:
- Add compensation formula to adjust gap based on displayScale
- Maintain consistent visual gap across different zoom levels

**Fixed**:
- Changed hardcoded gap (50px) to scale with displayScale: `Math.floor(50 * this.displayScale)`

---

## 3. ✅ Hide SpeechBubble When Going to Tray - COMPLETED
**Problem**: When "go to tray" is clicked while speechBubble is open, only character disappears but speechBubble remains visible.

**Solution**:
- Close speechBubble window when character goes to tray
- Hide both windows together

**Fixed**:
- Added speechBubble hiding logic in handleMoveToTray() method

---

## 4. ✅ Disable Triggers in Tray State - COMPLETED
**Problem**: Triggers (e.g., "10-minute chitchat", "midnight greeting") may still fire when character is in tray (invisible).

**Solution**:
1. Added pause/resume methods to TriggerManager
2. Pause triggers when moving to tray
3. Resume triggers when restoring from tray

**Fixed**:
- Added `isPaused` flag and `pause()/resume()` methods to TriggerManager
- Modified `checkTriggers()` to skip when paused
- Updated background.ts to call `pause()` on MOVE_TO_TRAY
- Updated tray click handler to call `resume()` when restoring

---

## 5. ✅ Add App Metadata to Prompt - COMPLETED
**Problem**: Character lacks context about the app itself (Akagaku concept).

**Solution**:
- Add meta information about Akagaku to system prompt
- Include app name, purpose, and concept explanation
- Help character understand the context of conversation

**Fixed**:
- Added Akagaku app context to all system prompts in `prompt.ts`
- Included Ukagaka inspiration and desktop companion concept explanation

---

## 6. ✅ Improve Summary Message Format - COMPLETED
**Problem**: Current summaries use meta-description format like "This conversation is about..."

**Desired Format**:
- Direct factual summary: "Character ate food and user agreed."
- Remove meta-phrases like "이 대화는~~", "This conversation is about~~"

**Solution**:
- Update summary prompt to generate direct factual statements
- Focus on actions and events, not conversation description

**Fixed**:
- Updated summary prompt in `SummarizeNode.ts` to use direct factual statements
- Removed meta-descriptive phrases from prompt instructions
