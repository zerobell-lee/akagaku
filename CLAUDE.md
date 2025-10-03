# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Akagaku is a desktop application inspired by **Ukagaka (伺か)**, built with **Nextron** (Electron + Next.js). It provides an interactive character experience powered by **LangChain** and **LangGraph**, allowing desktop characters to have natural conversations with users using LLMs (OpenAI/Anthropic).

## Development Commands

### Development
```bash
npm run dev              # Start development server
```

### Build
```bash
npm run build            # Build production application
```

### Post-install
```bash
npm run postinstall      # Install Electron app dependencies (runs automatically)
```

## Architecture

### Clean Architecture Structure

The project follows **Clean Architecture** principles with clear separation of concerns:

```
main/
├── domain/                     # Pure business logic (no framework dependencies)
│   ├── entities/              # Character, User, Relationship, Topic
│   ├── value-objects/         # Affection, Attitude, Emoticon
│   ├── repositories/          # Repository interfaces (ICharacterRepository, ISkinRepository, etc.)
│   ├── ghost/                 # LangGraph state machine definition
│   │   └── graph/             # LangGraph nodes, states, prompts, utils
│   ├── message/               # Message domain models (AkagakuMessage)
│   ├── tools/                 # Tool definitions (WeatherTool, CryptoTool, etc.)
│   ├── triggers/              # Trigger system (IntervalTrigger, TimeTrigger, TrayActivationTrigger)
│   └── services/              # Domain services
├── application/               # Use cases and application logic
│   ├── use-cases/            # SendMessage, GreetUser, UpdateRelationship, ChangeSkin, ListSkins
│   ├── ports/                # ILLMService, IMessageParser, IMessageConverter, IChatHistorySummarizer
│   └── dtos/                 # ConversationDTOs (SendMessageInput, ConversationOutput)
├── infrastructure/            # Framework implementations
│   ├── character/            # YamlCharacterRepository, SkinRepository, CharacterManifestRepository
│   ├── chat/                 # SQLiteChatHistoryRepository, ChatHistorySummarizer
│   ├── database/             # SQLiteDatabase (singleton), migrations
│   ├── user/                 # ElectronStoreUserRepository, RelationshipRepository
│   ├── config/               # ConfigRepository (electron-store), logger (winston)
│   ├── llm/                  # LangChainAdapter (implements ILLMService)
│   ├── message/              # MessageParser, StreamingMessageParser
│   ├── topic/                # TopicRepository (markdown + YAML frontmatter)
│   ├── tools/                # ToolConfigRepository
│   ├── triggers/             # TriggerRegistry
│   ├── ghost/                # GhostService (facade for use cases)
│   └── utils/                # DatetimeStringUtils, EmoticonMatcher
├── presentation/             # Electron main process handlers
│   ├── handlers/             # UserActionHandler, ArchiveHandler
│   └── ipc/                  # IPC handler interfaces
└── helpers/                  # Window creation utilities
```

**Dependency Direction**: Infrastructure → Application → Domain

**Clean Architecture Status**:
- ✅ **Domain Layer**: Complete with entities, value objects, repository interfaces
- ✅ **Application Layer**: Use cases defined and functional
- ✅ **Infrastructure Layer**: All repositories and adapters implemented
- ⚠️ **Integration Status**: GhostService wraps Ghost class for backward compatibility
- 🔄 **Future Work**: Extract remaining business logic from Ghost class into use cases

### Data Storage Architecture

#### SQLite Database
**Purpose**: Primary storage for chat history and summaries

**Schema** ([data/database/schema.sql](data/database/schema.sql)):
```sql
-- Chat messages (all conversation messages)
messages (id, character, type, content, emoticon, created_at, created_timestamp)

-- Summaries (LLM-generated conversation summaries)
summaries (id, character, content, created_at, created_timestamp, message_count)
```

**Key Characteristics**:
- `created_timestamp`: Unix timestamp for efficient querying
- Separate tables for messages and summaries
- Indexed by character and timestamp for performance
- **Message Preservation**: All messages are preserved in database; summaries are for LLM context compression only

**Database Manager** ([main/infrastructure/database/SQLiteDatabase.ts](main/infrastructure/database/SQLiteDatabase.ts)):
- Singleton pattern for connection management
- WAL mode for better concurrency
- Transaction helper for atomic operations

#### Electron Store
**Purpose**: Configuration and metadata storage

**Used For**:
- User settings (ConfigRepository)
- Character relationships (RelationshipRepository)
- Topic usage tracking (TopicRepository)
- Active skin selection (SkinRepository)

### Core Architecture Pattern: LangGraph State Machine

The application uses **LangGraph** to implement a conversation flow as a state machine.

**State Definition** ([main/domain/ghost/graph/states.ts](main/domain/ghost/graph/states.ts)):
```typescript
interface GhostState {
  chat_history: AkagakuChatHistory;
  userInput: { payload: string; isSystemMessage: boolean };
  conversationAgent: CompiledStateGraph;
  toolAgent: AgentExecutor;
  toolCallHistory: any[];
  toolCallCompleted: boolean;
  toolCallFinalAnswer: string;
  // ... other state fields
}
```

**Graph Nodes**:

1. **ToolNode** ([main/domain/ghost/graph/nodes/ToolNode.ts](main/domain/ghost/graph/nodes/ToolNode.ts))
   - Fast path: Pattern matching to skip LLM for obvious non-tool requests
   - Slow path: Lightweight LLM for tool decision
   - Handles tool invocation using `toolAgent` (AgentExecutor)
   - Returns `toolCallCompleted` flag and `toolCallFinalAnswer`
   - Optimization: Minimal context sent to LLM (no full conversation history)

2. **ResponseNode** ([main/domain/ghost/graph/nodes/ResponseNode.ts](main/domain/ghost/graph/nodes/ResponseNode.ts))
   - Generates character responses using `conversationAgent`
   - Parses LLM responses with `StreamingMessageParser`
   - Updates affection/relationship scores based on interaction
   - Creates `AkagakuCharacterMessage` and adds to chat history
   - Handles retry logic on parse errors
   - Supports streaming responses via `StreamingEventEmitter`

3. **UpdateChatHistoryNode** ([main/domain/ghost/graph/nodes/UpdateNode.ts](main/domain/ghost/graph/nodes/UpdateNode.ts))
   - Persists conversation history to SQLite
   - Triggers background summarization if needed

4. **UpdateUserSettingNode** ([main/domain/ghost/graph/nodes/UpdateNode.ts](main/domain/ghost/graph/nodes/UpdateNode.ts))
   - Updates user relationship data periodically

**Process Flow**:
```
User Input → Ghost.invoke()
    ↓
[START] → ToolNode (if not system message)
    ↓
ToolNode → ResponseNode (when tools complete)
    ↓
ResponseNode → UpdateChatHistoryNode (on success)
    ↓
UpdateChatHistoryNode → UpdateUserSettingNode (every 5 conversations)
    ↓
[END] → Return GhostResponse
```

### Chat History Management

#### SQLiteChatHistoryRepository
**Location**: [main/infrastructure/chat/SQLiteChatHistoryRepository.ts](main/infrastructure/chat/SQLiteChatHistoryRepository.ts)

**Responsibilities**:
- Load chat history with summary integration
- Persist new messages to database
- Query messages after last summary timestamp

**Load Pattern**:
```typescript
1. Get last summary for character
2. If summary exists:
   - Add summary as first message
   - Query messages WHERE created_timestamp > summary.timestamp
3. If no summary:
   - Query all messages for character
4. Return AkagakuChatHistory object
```

#### ChatHistorySummarizer (SQLite-Based)
**Location**: [main/infrastructure/chat/ChatHistorySummarizer.ts](main/infrastructure/chat/ChatHistorySummarizer.ts)

**Purpose**: Compress old conversation history using LLM to reduce token usage

**New Architecture (Refactored)**:
- Works directly with SQLite database (no in-memory manipulation)
- Interface: `summarize(characterName, llmService, apiKey, modelName, enableLightweightModel): Promise<boolean>`

**Process**:
```typescript
1. Query last summary timestamp from summaries table
2. Query unsummarized messages WHERE created_timestamp > last_summary_timestamp
3. Validation:
   - Check if message count > summarizationThreshold
   - Check if total messages > keepRecentMessages
   - Check if messages to summarize >= MIN_SUMMARIZE (10)
4. Generate summary using LLM
5. INSERT summary with timestamp = last summarized message timestamp
6. Messages are preserved in database (NOT deleted)
```

**Critical Timestamp Handling**:
- Summary timestamp = timestamp of **last summarized message**
- This ensures `WHERE created_timestamp > summary.timestamp` correctly fetches unsummarized messages
- **DO NOT** use `new Date()` or current timestamp for summaries

**Configuration**:
- `chatHistoryLimit`: Maximum messages to keep in database (default: 100)
- `summarizationThreshold`: Trigger summarization when unsummarized count exceeds this (default: 40)
- `keepRecentMessages`: Number of recent messages to keep unsummarized (default: 20)
- `enableAutoSummarization`: Toggle summarization feature (default: true)

**Background Execution**:
- Triggered asynchronously from `UpdateChatHistoryNode`
- Non-blocking with lock mechanism to prevent concurrent summarization
- Executes in `Ghost.executeBackgroundSummarization()`

### Character System

#### Character Data Structure
**Location**: `data/character/{character_id}/`

**Required Files**:
- `manifest.yaml`: Character metadata (id, name, description, version, author, thumbnail)
- `character_description.yaml`: Personality, dialogue style, background
- `appearance.yaml`: Visual properties and graphics (default appearance)
- `affection_attitude_map.yaml`: Relationship score to attitude mapping

**Manifest System**:
- Supports versioning (`manifest_version`, `version`)
- Thumbnail specification: 256x256 PNG/JPEG/WebP, max 500KB
- Author attribution and creation date

#### Skin System
**Location**: `data/character/{character_id}/skins/{skin_id}/`

**Purpose**: Multiple visual variations for characters

**Structure**:
```
skins/
├── hotpants/
│   ├── manifest.yaml        # Skin metadata
│   ├── appearance.yaml      # Skin-specific graphics
│   ├── thumbnail.png        # 256x256 preview
│   └── images/              # Emotion graphics
├── jeans/
├── sailor/
├── suit/
└── swimsuit/
```

**Manifest** (`manifest.yaml`):
```yaml
manifest_version: "1.0"
skin_id: "hotpants"
skin_name: "Hot Pants"
description: "wearing hot pants and a casual top"  # For LLM context
version: "1.0.0"
author: "zerobell-lee"
thumbnail: "thumbnail.png"
```

**AI Integration**:
- Skin `description` field is injected into LLM prompt
- Character appearance changes dynamically based on active skin
- Use cases: `ChangeSkinUseCase`, `ListSkinsUseCase`

**Repository** ([main/infrastructure/character/SkinRepository.ts](main/infrastructure/character/SkinRepository.ts)):
- `getAvailableSkins(characterId)`: List all skins
- `getSkinManifest(characterId, skinId)`: Load skin metadata
- `getSkinAppearance(characterId, skinId)`: Load skin graphics
- `getActiveSkin(characterId)`: Get current active skin
- `setActiveSkin(characterId, skinId)`: Change active skin
- Legacy support for characters without skin system

#### Character Loading Flow
```typescript
1. Load manifest from manifest.yaml
2. Load character description from character_description.yaml
3. Load active skin (or default appearance.yaml)
4. Load affection-attitude mapping
5. Initialize Ghost with combined settings
```

### Topic-Based Chit-Chat System

**Location**: `data/character/{character_id}/topics/`

**Purpose**: Character-initiated conversations with context-aware topic selection

**Topic File Format** (Markdown + YAML frontmatter):
```markdown
---
title: "Ask about user's work"
category: "personal"
frequency: "occasional"
tags: ["work", "career", "job"]
---

Ask the user about their work or job in a natural, caring way.
Show genuine interest in their professional life.
```

**Topic Entity** ([main/domain/entities/Topic.ts](main/domain/entities/Topic.ts)):
```typescript
class Topic {
  id: string;              // Filename without .md
  metadata: TopicMetadata; // From YAML frontmatter
  content: string;         // Markdown content
  lastUsed?: Date;         // Tracked per-character
}
```

**Topic Repository** ([main/infrastructure/topic/TopicRepository.ts](main/infrastructure/topic/TopicRepository.ts)):
- Loads topics from markdown files
- Tracks topic usage timestamps per character
- Persists usage data in electron-store

**Topic Selection Strategy**:
1. Load all available topics for character
2. Filter by frequency weights and last use
3. Random weighted selection
4. Mark topic as used after selection

**Integration with Ghost**:
- `doChitChat()` method uses TopicRepository
- Topics injected into LLM prompt as system message
- Character generates response based on topic guidance

**Example Topics**:
- `ask_user_hobby.md`: Personal interest discovery
- `complain_bored.md`: Boredom expression
- `observation_weather.md`: Weather-based conversation starter
- `tsundere_concern.md`: Character-specific personality trait

### Trigger System

**Purpose**: Ghost-initiated conversations based on time, events, or conditions

**Base Trigger** ([main/domain/triggers/Trigger.ts](main/domain/triggers/Trigger.ts)):
```typescript
interface TriggerContext {
  currentTime: Date;
  lastInteractionTime: Date;
  characterState?: any;
}

interface TriggerResult {
  shouldFire: boolean;
  message?: string;
  priority?: number;
}

abstract class BaseTrigger {
  abstract shouldFire(context: TriggerContext): TriggerResult;
  enable(): void;
  disable(): void;
  isInCooldown(currentTime: Date): boolean;
}
```

**Trigger Types**:

1. **IntervalTrigger** ([main/domain/triggers/IntervalTrigger.ts](main/domain/triggers/IntervalTrigger.ts))
   - Fires after idle period (default: 5 minutes)
   - Cooldown period to prevent spam (default: 10 minutes)
   - Configurable messages and priority
   - Example: Chit-chat when user is idle

2. **TimeTrigger** ([main/domain/triggers/TimeTrigger.ts](main/domain/triggers/TimeTrigger.ts))
   - Fires at specific times (e.g., "09:00", "18:00")
   - Cron-like scheduling
   - Daily recurring events
   - Example: Morning/evening greetings

3. **TrayActivationTrigger** ([main/domain/triggers/TrayActivationTrigger.ts](main/domain/triggers/TrayActivationTrigger.ts))
   - Fires when user clicks tray icon
   - Short cooldown (default: 30 seconds)
   - Example: "You called?" response

**Trigger Registry** ([main/infrastructure/triggers/TriggerRegistry.ts](main/infrastructure/triggers/TriggerRegistry.ts)):
- Manages collection of triggers
- Evaluates all enabled triggers
- Returns highest priority trigger that should fire
- Used in `UserActionHandler.checkTriggers()`

**Trigger Flow**:
```typescript
1. User idle for 5 minutes
2. IntervalTrigger.shouldFire() returns true
3. Ghost.doChitChat() called with trigger message
4. Topic selected and character responds
5. Trigger enters cooldown period
```

### Tool System

**Location**: `main/domain/tools/definitions/`

**Available Tools**:
- **WeatherTool**: OpenWeatherMap API integration
- **CryptoTool**: CoinMarketCap API integration
- **BrowserTool**: Web search and page fetching
- **AppTool**: Application control (quit, etc.)
- **UserTool**: User information queries
- **ScheduleTool**: Time and schedule queries

**Tool Integration**:
- Tools are LangChain-compatible and registered in `core_tools`
- Lightweight LLM (gpt-4o-mini / claude-3-5-haiku) decides tool usage
- Tool results injected into conversation context
- Tool configuration stored via `ToolConfigRepository`

### Message System

**AkagakuMessage** ([main/domain/message/AkagakuMessage.ts](main/domain/message/AkagakuMessage.ts)):
- Base abstraction for conversation messages
- Types: `AkagakuUserMessage`, `AkagakuCharacterMessage`, `AkagakuSystemMessage`
- Methods: `toChatLog()`, `toLangChainMessage()`

**Message Parsing**:
- **MessageParser** ([main/infrastructure/message/MessageParser.ts](main/infrastructure/message/MessageParser.ts)): Non-streaming parser
- **StreamingMessageParser** ([main/infrastructure/message/StreamingMessageParser.ts](main/infrastructure/message/StreamingMessageParser.ts)): Real-time streaming parser
- Service-specific parsing for OpenAI and Anthropic
- Extracts emoticon, message, and affection delta from LLM response

**Expected LLM Response Format**:
```
[emoticon: happy]
[message: Hello! How are you today?]
[add_affection: 5]
```

### Presentation Layer (IPC)

#### Handler Pattern
**Location**: [main/presentation/handlers/UserActionHandler.ts](main/presentation/handlers/UserActionHandler.ts)

**Responsibilities**:
- Window management (ghost, speech bubble, chat input, config, logs, character info)
- IPC event handling (`user-action`, `drag-start`, `move-window`, etc.)
- Ghost message orchestration
- Trigger evaluation
- Stream event coordination

**Key Methods**:
- `sendGhostMessage(input, isSystemMessage)`: Main conversation entry point
- `handleUserMessage(message)`: User input processing
- `checkTriggers()`: Evaluate and fire triggers
- `handleConfigRequest()`: Open config window
- `handleChangeSkin(skinId)`: Skin switching

**Window Configuration**:
- Main window: Ghost character (click-through, frameless, always on top)
- Speech bubble: Message display (fixed height 768px, configurable width)
- Chat input: User input dialog
- Config: Settings UI (900x800)
- Logs: Developer console
- Character Info: Character and skin selection

#### IPC Events
**Registry** ([main/presentation/ipc/IPCHandlerRegistry.ts](main/presentation/ipc/IPCHandlerRegistry.ts)):
- Centralized IPC event registration
- Handler pattern for clean separation of concerns

### Relationship & Affection System

**Entities**:
- **Affection** ([main/domain/value-objects/Affection.ts](main/domain/value-objects/Affection.ts)): Numeric relationship score (0-100)
- **Attitude** ([main/domain/value-objects/Attitude.ts](main/domain/value-objects/Attitude.ts)): Categorical attitude ("hostile", "cold", "neutral", "friendly", "affectionate")
- **Relationship** ([main/domain/entities/Relationship.ts](main/domain/entities/Relationship.ts)): Links Character, User, Affection, Attitude

**Mapping** (`affection_attitude_map.yaml`):
```yaml
conditions:
  - if_above: 80
    attitude: "affectionate"
  - if_above: 60
    attitude: "friendly"
  - if_above: 40
    attitude: "neutral"
  - if_above: 20
    attitude: "cold"
  - if_above: 0
    attitude: "hostile"
```

**Affection Updates**:
- LLM returns `[add_affection: ±N]` in response
- Delta applied to current affection score
- Attitude recalculated based on new affection
- Persisted via `RelationshipRepository`

### Performance Optimizations

**PerformanceMonitor** ([main/domain/ghost/graph/utils/PerformanceMonitor.ts](main/domain/ghost/graph/utils/PerformanceMonitor.ts)):
- Tracks LLM invocation timing
- Logs slow operations
- Context size monitoring

**ToolCallDetector** ([main/domain/ghost/graph/utils/ToolCallDetector.ts](main/domain/ghost/graph/utils/ToolCallDetector.ts)):
- Pattern-based fast path for obvious non-tool requests
- Skips LLM invocation when possible
- Fallback to LLM for complex decisions

**Streaming**:
- `StreamingEventEmitter` ([main/domain/ghost/graph/utils/StreamingEventEmitter.ts](main/domain/ghost/graph/utils/StreamingEventEmitter.ts)): Event-based streaming
- Real-time message updates to UI
- Token-by-token rendering

**Context Compression**:
- Minimal context sent to tool agent (no full conversation history)
- Only last 2 tool results in tool history
- Compact string formatting for prompts

## UI Components (Renderer)

**Pages** ([renderer/pages/](renderer/pages/)):
- `home.tsx`: Ghost character window (SVG-based character with touchable areas)
- `speechBubblePage.tsx`: Message display bubble
- `chatDialog.tsx`: User input modal
- `config.tsx`: Settings UI with advanced summarization configuration
- `logs.tsx`: Developer logs viewer
- `characterInfo.tsx`: Character and skin selection

**Configuration UI**:
- LLM provider selection (OpenAI, Anthropic)
- Model selection and temperature
- API key management
- Display scaling and speech bubble width
- **Advanced Summarization Settings**:
  - Enable/disable auto summarization
  - Storage limit slider (50-200)
  - Interactive drag bar for threshold and keepRecent
  - Visual bar graph with color-coded regions

## TypeScript Configuration

- Base path aliasing: `@shared/*` maps to `shared/*`
- Main tsconfig: [tsconfig.json](tsconfig.json)
- Renderer tsconfig: [renderer/tsconfig.json](renderer/tsconfig.json)

## Key Dependencies

**LLM & AI**:
- `@langchain/langgraph`: State machine for conversation flow
- `@langchain/openai`, `@langchain/anthropic`: LLM providers
- `@langchain/core`: Core LangChain abstractions
- `langchain`: Main LangChain library

**Storage**:
- `better-sqlite3`: SQLite database for chat history
- `electron-store`: Configuration persistence
- `js-yaml`: Character/topic YAML parsing

**Utilities**:
- `winston`: Logging
- `node-cron`: Scheduled triggers
- `axios`: HTTP requests
- `cheerio`: Web scraping (BrowserTool)

**UI**:
- `next`: React framework
- `tailwindcss`: Styling
- `react-icons`: Icon library

## Important Patterns & Conventions

1. **Agent Initialization**: Agents (`toolAgent`, `conversationAgent`) are created lazily on first invoke
2. **State Management**: LangGraph manages state through `GhostState` interface
3. **Retry Logic**: Response parsing failures trigger retries through `invocation_retry_policy`
4. **Affection Deltas**: Use delta values (`add_affection: ±N`), not absolute values
5. **Tool Integration**: Tools must be LangChain-compatible and registered in `core_tools`
6. **Message Preservation**: All messages stored permanently in SQLite; summaries compress context for LLM only
7. **Timestamp Integrity**: Summary timestamp must equal last summarized message timestamp
8. **Repository Pattern**: Always use repository interfaces from domain layer
9. **Clean Architecture**: Domain → Application → Infrastructure dependency direction
10. **Event-Driven UI**: Use IPC events and streaming for responsive UI updates

## Recent Major Changes

**2024-10 Recent Commits**:
1. **Summarization Refactor** (61391e8): Extracted summarization to dedicated class with Clean Architecture
2. **Topic-Based Chit-Chat** (a01d210): Implemented markdown-based topic system with AI integration
3. **SQLite Migration** (9a7ca18): Migrated chat history from electron-store to SQLite
4. **Skin System** (08ae2db): Added multi-skin support with AI context integration
5. **Trigger System** (645eef1, 42599ac): Implemented ghost-initiated conversation triggers
6. **IPC Refactor** (45452c7): Handler pattern for IPC with registry

## Development Guidelines

### ⚠️ CRITICAL: Command Execution Rules
**NEVER execute these commands without explicit user instruction**:
- `npm run dev` - Starts development server (long-running process)
- `npm start` - Starts application (long-running process)
- Any other long-running processes that occupy ports or background resources

**Why**: These commands interfere with user's development environment and create unwanted background processes.

**Only execute when**: User explicitly requests "run dev server", "start the app", etc.

### When Modifying Chat History
- **DO NOT** delete messages from database without explicit requirement
- Summary timestamp = last summarized message timestamp (NOT current time)
- Test with SQLite queries to verify timestamp-based filtering works correctly

### When Adding New Features
- Follow Clean Architecture: Domain → Application → Infrastructure
- Add repository interface in domain layer first
- Implement in infrastructure layer
- Use dependency injection in presentation layer

### When Modifying LLM Prompts
- Prompts are in [main/domain/ghost/graph/prompt/prompt.ts](main/domain/ghost/graph/prompt/prompt.ts)
- Test with both OpenAI and Anthropic providers
- Verify streaming response parsing
- Check LangSmith for actual prompt delivery

### When Adding Tools
- Implement in `main/domain/tools/definitions/`
- Register in `main/domain/tools/core/index.ts`
- Add configuration schema in `ToolConfigRepository`
- Test with lightweight LLM in ToolNode
