# Design Guidelines: AI Context Manager

## Design Approach
**Selected Approach**: Reference-Based (Productivity-Focused)
**Primary Reference**: Cursor AI, Notion, Linear
**Justification**: This is a sophisticated productivity tool requiring clean, functional interface patterns that promote focus and efficiency in document management and AI interaction.

## Core Design Elements

### Color Palette
**Dark Mode Primary** (Application Default):
- Background: 220 15% 8%
- Surface: 220 13% 12%
- Border: 220 13% 20%
- Text Primary: 220 10% 95%
- Text Secondary: 220 8% 70%
- Accent Blue: 217 91% 60%
- Success Green: 142 76% 36%

**Light Mode**:
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Border: 220 13% 91%
- Text Primary: 220 9% 15%
- Text Secondary: 220 9% 46%

### Typography
**Primary**: Inter via Google Fonts CDN
**Monospace**: JetBrains Mono for code/syntax elements
**Hierarchy**:
- Headers: font-semibold
- Body: font-normal
- Code elements: font-mono text-sm

### Layout System
**Tailwind Spacing Units**: Primarily 2, 4, 6, 8, 12, 16
**Grid**: Use gap-4 and gap-6 for consistent spacing
**Containers**: max-w-7xl with responsive padding (px-4, px-6, px-8)

### Component Library

#### Navigation
- Sidebar navigation (collapsible)
- Clean tab system for document types
- Breadcrumb navigation for deep document hierarchies

#### Document Management
- **File Tree**: Expandable tree structure with type icons
- **Document Cards**: Clean cards with metadata display
- **Upload Zone**: Drag-and-drop with progress indicators

#### @Mention Interface
- **Dropdown**: Floating panel with search results
- **Mention Pills**: Rounded pills showing @[type:name|alias] with type-specific colors
- **Search Input**: Inline search with real-time filtering

#### AI Conversation
- **Chat Interface**: Clean message bubbles with timestamp
- **Context Indicators**: Small badges showing auto-completed contexts
- **Function Call Display**: Expandable sections showing AI actions

#### Text Editor
- **Rich Text Area**: Clean editor with @mention integration
- **Mention Autocomplete**: Facebook-style dropdown positioning
- **Syntax Highlighting**: For mention syntax in raw view

#### Data Display
- **Embedding Status**: Progress indicators and status badges
- **Document Metadata**: Clean info panels
- **Search Results**: List view with relevance scoring

#### Forms & Controls
- **Primary Buttons**: Blue accent with subtle shadows
- **Secondary Buttons**: Outline style with hover states
- **Input Fields**: Consistent border styling with focus states

### Key Interaction Patterns

1. **@Mention Flow**: Type "@" → Search dropdown appears → Select item → Auto-insert formatted syntax
2. **Context Completion**: Visual indicators show which documents were auto-added to conversation context
3. **Function Calling**: Expandable panels show AI actions with clear success/error states
4. **Document Editing**: Real-time embedding updates with status feedback

### Visual Hierarchy
- **Primary Actions**: Accent blue buttons
- **Document Status**: Color-coded indicators (green=ready, yellow=processing, red=error)
- **Type Differentiation**: Subtle color coding for person vs document types
- **Context Awareness**: Highlighted elements when referenced by AI

This design emphasizes clarity, efficiency, and sophisticated functionality while maintaining the clean aesthetic expected in modern productivity tools.