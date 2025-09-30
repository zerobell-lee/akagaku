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
│   ├── entities/              # Character, User, Relationship
│   ├── value-objects/         # Affection, Attitude, Emoticon
│   ├── repositories/          # Repository interfaces (ICharacterRepository, etc.)
│   ├── ghost/                 # LangGraph state machine definition
│   ├── message/               # Message domain models
│   └── tools/                 # Tool definitions
├── application/               # Use cases and application logic
│   ├── use-cases/            # SendMessage, GreetUser, UpdateRelationship
│   ├── ports/                # ILLMService, IMessageParser, IMessageConverter
│   └── dtos/                 # ConversationDTOs (SendMessageInput, ConversationOutput)
├── infrastructure/            # Framework implementations
│   ├── character/            # YamlCharacterRepository (implements ICharacterRepository)
│   ├── chat/                 # ElectronStoreChatHistoryRepository
│   ├── user/                 # ElectronStoreUserRepository, RelationshipRepository
│   ├── config/               # ConfigRepository
│   ├── llm/                  # LangChainAdapter (implements ILLMService)
│   └── ghost/                # GhostService (facade for use cases)
└── presentation/             # Electron main process (background.ts)
```

**Dependency Direction**: Infrastructure → Application → Domain

**Clean Architecture Progress**:
- ✅ **Phase 1-2 Complete**: Domain layer (entities, value objects, repository interfaces) and Application layer (use cases, ports, DTOs) established
- ⚠️ **Phase 3 Status**: GhostService created as infrastructure facade, but currently wraps existing Ghost class for backward compatibility
- 🔄 **Future Work**: Full use case extraction from Ghost class to complete Clean Architecture separation

### Core Architecture Pattern: LangGraph State Machine

The application uses **LangGraph** to implement a conversation flow as a state machine with the following nodes:

1. **ToolNode** ([main/domain/ghost/graph/nodes/ToolNode.ts](main/domain/ghost/graph/nodes/ToolNode.ts))
   - Handles tool invocation for the character using `toolAgent`
   - Processes user input through conversation context
   - Manages tool call history and determines when tool usage is complete
   - Returns `toolCallCompleted` flag and `toolCallFinalAnswer`

2. **ResponseNode** ([main/domain/ghost/graph/nodes/ResponseNode.ts](main/domain/ghost/graph/nodes/ResponseNode.ts))
   - Generates character responses using `conversationAgent`
   - Parses LLM responses with `AIResponseParser`
   - Updates affection/relationship scores based on interaction
   - Creates `AkagakuCharacterMessage` and adds to chat history
   - Handles retry logic on parse errors

3. **UpdateChatHistoryNode** ([main/domain/ghost/graph/nodes/UpdateNode.ts](main/domain/ghost/graph/nodes/UpdateNode.ts))
   - Persists conversation history to storage
   - Manages chat history limits

4. **UpdateUserSettingNode** ([main/domain/ghost/graph/nodes/UpdateNode.ts](main/domain/ghost/graph/nodes/UpdateNode.ts))
   - Updates user relationship data periodically

### GhostService (Infrastructure Layer)

The `GhostService` class ([main/infrastructure/ghost/GhostService.ts](main/infrastructure/ghost/GhostService.ts)) is a facade for conversation:
- Wraps the existing `Ghost` class to maintain Clean Architecture boundaries
- Provides stable interface for UI layer
- Delegates all logic to `Ghost` class internally
- Provides methods: `sayHello()`, `sayGoodbye()`, `doChitChat()`, `sendRawMessage()`

**Note**: Currently a simple wrapper for backward compatibility. Future refactoring will extract use cases from Ghost class.

### Message System

**AkagakuMessage** ([main/domain/message/AkagakuMessage.ts](main/domain/message/AkagakuMessage.ts)):
- Base message abstraction for the conversation system
- Two types: `AkagakuUserMessage` and `AkagakuCharacterMessage`
- `AkagakuMessageConverter`: Converts messages to LangChain format based on LLM service

**AIResponseParser** ([main/infrastructure/message/MessageParser.ts](main/infrastructure/message/MessageParser.ts)):
- Parses LLM responses into structured format
- Service-specific parsing for OpenAI and Anthropic

### Character System

**Character Configuration** ([main/infrastructure/character/CharacterRepository.ts](main/infrastructure/character/CharacterRepository.ts)):
- Characters are defined in YAML files under `data/character/{character_id}/`
- Required files:
  - `character_description.yaml`: Personality, dialogue style, background
  - `appearance.yaml`: Visual properties and graphics
  - `affection_attitude_map.yaml`: Relationship score mapping

### Process Flow

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

### Use Cases (Application Layer) - Prepared for Future Integration

Use cases have been defined following Clean Architecture principles:

1. **SendMessageUseCase** ([main/application/use-cases/SendMessageUseCase.ts](main/application/use-cases/SendMessageUseCase.ts))
   - Ready to orchestrate user message handling
   - Will coordinate repositories, LLM service, and domain entities
   - **Status**: Implementation complete, pending integration with LangGraph

2. **GreetUserUseCase** ([main/application/use-cases/GreetUserUseCase.ts](main/application/use-cases/GreetUserUseCase.ts))
   - Ready to handle first-time and returning user greetings
   - Will contextualize greetings based on chat history
   - **Status**: Implementation complete, pending integration with LangGraph

3. **UpdateRelationshipUseCase** ([main/application/use-cases/UpdateRelationshipUseCase.ts](main/application/use-cases/UpdateRelationshipUseCase.ts))
   - ✅ **Fully Functional**: Updates character-user relationship scores
   - Uses domain value objects (Affection, Attitude)
   - Persists through repository

### LangChain Adapter (Infrastructure Layer) - Prepared for Future Integration

**LangChainAdapter** ([main/infrastructure/llm/LangChainAdapter.ts](main/infrastructure/llm/LangChainAdapter.ts)):
- Implements `ILLMService`, `IMessageParser`, `IMessageConverter` ports
- Ready to wrap LangGraph state machine execution
- Parses LLM responses into structured format
- Converts between domain messages and LangChain messages
- **Status**: Implementation complete, pending full integration with use cases

### Repository Pattern

The application uses repository pattern for data access with interfaces in domain layer:
- `IConfigRepository` → `ConfigRepository`: Electron-store based configuration (API keys, model settings)
- `ICharacterRepository` → `YamlCharacterRepository`: YAML-based character loading
- `IChatHistoryRepository` → `ElectronStoreChatHistoryRepository`: Conversation history management
- `IUserRepository` → `ElectronStoreUserRepository`: User settings and preferences
- `IRelationshipRepository` → `ElectronStoreRelationshipRepository`: Character-user relationship scores

### Electron IPC Communication

The main process ([main/background.ts](main/background.ts)) handles:
- Window management (ghost window, speech bubble, chat input, config)
- IPC events: `user-action`, `drag-start`, `move-window`, `save_config`, `user-message`
- Ghost message orchestration through `sendGhostMessage()`

## TypeScript Configuration

- Base path aliasing: `@shared/*` maps to `shared/*`
- Main tsconfig: [tsconfig.json](tsconfig.json)
- Renderer tsconfig: [renderer/tsconfig.json](renderer/tsconfig.json)

## Key Dependencies

- `@langchain/langgraph`: State machine for conversation flow
- `@langchain/openai`, `@langchain/anthropic`: LLM providers
- `electron-store`: Persistent configuration
- `winston`: Logging
- `js-yaml`: Character definition parsing

## Important Patterns

1. **Agent Initialization**: Agents (`toolAgent`, `conversationAgent`) are created lazily on first invoke
2. **State Management**: LangGraph manages state through `GhostState` interface
3. **Retry Logic**: Response parsing failures trigger retries through `invocation_retry_policy`
4. **Affection System**: User interactions affect relationship scores, which influence character attitude
5. **Tool Integration**: Characters can use tools defined in `main/domain/tools/core/`