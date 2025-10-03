# Akagaku

Akagaku is a modern desktop companion application inspired by **Ukagaka (伺か)**, bringing interactive AI characters to your desktop with natural conversations powered by LLMs.

---

## 🎯 Overview

Akagaku creates an immersive desktop character experience where AI-powered characters with distinct personalities interact with you through natural language. Built with modern technologies like **LangChain**, **LangGraph**, and **Electron**, it offers a unique blend of desktop companion features and advanced AI capabilities.

### Key Features

- **🤖 AI-Powered Conversations**: Natural dialogue using OpenAI GPT or Anthropic Claude models
- **🎭 Character Personalities**: Each character has unique personality, background, and relationship system
- **🔧 Tool Integration**: Characters can check weather, crypto prices, open apps, and more
- **💬 Persistent Memory**: SQLite-based chat history with automatic summarization
- **🎨 Multiple Skins**: Customizable character appearances with different outfits
- **⚙️ Flexible Configuration**: Easy setup for API keys, model selection, and tool management
- **🔄 Auto-Triggers**: Characters initiate conversations based on time and context

---

## 🛠️ Tech Stack

- **Nextron**: Electron + Next.js framework for desktop applications
- **TypeScript**: Type-safe development across the entire codebase
- **LangChain & LangGraph**: State machine-based conversation flow with streaming support
- **SQLite**: Lightweight, persistent storage for chat history
- **Clean Architecture**: Domain-driven design with clear separation of concerns

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm**: v9 or higher
- **API Key**: OpenAI or Anthropic API key for LLM functionality

### Installation

1. **Clone the Repository**

```bash
git clone https://github.com/zerobell-lee/akagaku.git
cd akagaku
```

2. **Install Dependencies**

```bash
npm install
```

3. **Run Development Mode**

```bash
npm run dev
```

On first launch, you'll see an onboarding screen to configure your API key and preferences.

### Building for Production

```bash
npm run build
```

Built applications will be available in the `dist/` directory:
- macOS: `Akagaku-1.0.0-arm64.dmg`
- Windows: `Akagaku-Setup-1.0.0.exe` (if built on Windows)

---

## 📖 Configuration

### First-Time Setup

When you first run Akagaku, you'll go through a 4-step onboarding process:

1. **Welcome Screen**: Introduction to Akagaku
2. **AI Provider Selection**: Choose your LLM provider and enter API key
   - OpenAI (GPT-4, GPT-5)
   - Anthropic (Claude 3.5 Sonnet, Claude 4.0)
   - Azure OpenAI
   - Custom endpoint
3. **Tool Configuration** (Optional): Enable additional capabilities
   - Weather information (requires OpenWeatherMap API key)
   - Cryptocurrency prices (requires CoinMarketCap API key)
   - System tools (open apps, URLs, etc.)
4. **Complete**: Your character is ready!

### Manual Configuration

You can adjust settings anytime by right-clicking the character and selecting "Settings".

**Configuration options:**
- LLM provider and model selection
- API keys and custom endpoints
- Temperature and generation parameters
- Tool enablement and API keys
- Character appearance and skins

---

## 🎮 Usage

### Basic Interactions

- **Chat**: Click the speech bubble or press the chat button to start a conversation
- **Context Menu**: Right-click the character for actions:
  - Settings
  - Change Skin
  - Chat History
  - Character Info
  - Move to Tray
  - Exit

### Character Behaviors

- **Greetings**: Character greets you when the app starts
- **Auto Chit-Chat**: Initiates conversation after periods of inactivity (configurable)
- **Relationship System**: Character's affection and attitude evolve based on interactions
- **Memory**: Maintains conversation context with automatic summarization

### Keyboard Shortcuts

- **Enter**: Send message (in chat input)
- **Esc**: Close speech bubble

---

## 🗂️ Project Structure

```
akagaku/
├── main/                          # Electron main process
│   ├── domain/                   # Business logic (Clean Architecture)
│   │   ├── entities/            # Character, User, Relationship
│   │   ├── ghost/               # LangGraph conversation state machine
│   │   └── tools/               # Tool definitions and implementations
│   ├── application/              # Use cases and DTOs
│   ├── infrastructure/           # External integrations
│   │   ├── chat/                # SQLite chat history repository
│   │   ├── character/           # YAML-based character loading
│   │   ├── config/              # Configuration management
│   │   ├── llm/                 # LangChain adapters
│   │   └── database/            # SQLite setup and migrations
│   └── presentation/             # IPC handlers and window management
├── renderer/                      # Next.js UI (Electron renderer)
│   ├── pages/                   # React pages
│   ├── components/              # Reusable UI components
│   └── styles/                  # Tailwind CSS styling
├── data/                          # Character definitions and assets
│   └── character/
│       └── minkee/              # Default character
│           ├── character_description.yaml
│           ├── appearance.yaml
│           └── skins/           # Multiple outfit variations
├── scripts/                       # Utility scripts
│   └── akagaku-data.sh          # Data management script
└── shared/                        # Shared types between main/renderer
```

---

## 🔧 Data Management

Akagaku includes a powerful data management script for backing up and managing your data:

```bash
# Create backup
./scripts/akagaku-data.sh backup dev

# List backups
./scripts/akagaku-data.sh list dev

# Restore from backup
./scripts/akagaku-data.sh restore dev backup_20251003_220046

# Show environment info
./scripts/akagaku-data.sh info dev

# Copy data between environments (dev/prod)
./scripts/akagaku-data.sh switch dev prod

# Clean old backups (keep 5 most recent)
./scripts/akagaku-data.sh clean dev 5

# Reset all data (creates backup first)
./scripts/akagaku-data.sh reset dev
```

All user data is stored in `userData/` directory:
- **Development**: `~/Library/Application Support/Akagaku (development)/userData/`
- **Production**: `~/Library/Application Support/Akagaku/userData/`

---

## 🎨 Customization

### Adding New Characters

1. Create a new directory under `data/character/`
2. Add required YAML files:
   - `character_description.yaml`: Personality and background
   - `appearance.yaml`: Visual properties
   - `affection_attitude_map.yaml`: Relationship mapping
3. Add character images in `images/` subdirectory

### Creating New Skins

1. Add a new directory under `data/character/{character}/skins/`
2. Include `manifest.yaml` and `appearance.yaml`
3. Add expression images: `neutral.png`, `happy.png`, `sad.png`, etc.
4. Add `thumbnail.png` for skin selection UI

### Adding Custom Tools

1. Define tool metadata in `main/domain/tools/metadata/`
2. Implement tool factory in `main/domain/tools/factories/`
3. Register in `ToolRegistry` in `background.ts`

---

## 🐛 Troubleshooting

### Common Issues

**App won't start or shows error dialog:**
- Check if API key is configured correctly
- Verify internet connection
- Check console logs in developer tools

**Character not responding:**
- Verify API key is valid and has credits
- Check network connectivity
- Review chat history in logs window

**Speech bubble positioning issues:**
- Adjust `displayScale` in settings
- Try different screen configurations
- Check for multi-monitor setups

### Development Mode

Run with verbose logging:
```bash
NODE_ENV=development npm run dev
```

Access developer tools:
- Main window: `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows)
- Right-click any window → "Inspect Element"

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow code style**: Use TypeScript, follow Clean Architecture principles
4. **Write tests** if applicable
5. **Commit with clear messages**: Follow the existing commit message style
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Open a Pull Request** with a clear description

### Development Guidelines

- Follow **Clean Architecture** patterns
- Keep domain logic independent of frameworks
- Use **TypeScript** strict mode
- Document complex logic with comments
- Test thoroughly before submitting PR

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Inspired by **Ukagaka (伺か)** and the Japanese desktop mascot culture
- Built with **LangChain** and **LangGraph** for AI capabilities
- Character design and personality by the Akagaku team

---

## 📧 Contact

For questions, feedback, or collaboration inquiries:

**Email**: lee@zerobell.xyz
**GitHub Issues**: [Report a bug or request a feature](https://github.com/zerobell-lee/akagaku/issues)

---

## 🗺️ Roadmap

- [ ] Multi-character support with character switching
- [ ] Cloud sync for chat history and settings
- [ ] Plugin system for community-created tools
- [ ] Voice interaction with TTS/STT
- [ ] Mobile companion app
- [ ] Character marketplace

---

**Star ⭐ this repository if you find it useful!**
